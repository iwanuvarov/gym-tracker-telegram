import { create } from 'zustand';

import { supabase } from '../lib/supabase';
import { initTelegramWebApp, type TelegramUser } from '../lib/telegram';

type Workout = {
  id: string;
  title: string;
  workout_date: string;
  created_at: string;
};

type StoreState = {
  telegramUser: TelegramUser | null;
  sessionUserId: string | null;
  workspaceId: string;
  workouts: Workout[];
  loading: boolean;
  authLoading: boolean;
  email: string;
  otpCode: string;
  message: string | null;
  error: string | null;
  init: () => Promise<void>;
  setWorkspaceId: (value: string) => void;
  setEmail: (value: string) => void;
  setOtpCode: (value: string) => void;
  requestOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  signOut: () => Promise<void>;
  loadWorkouts: () => Promise<void>;
  createWorkout: (title: string, workoutDate: string) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;
};

const WORKSPACE_KEY = 'gym.telegram.workspace-id';

const safeLocalStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // noop
    }
  },
};

const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
};

export const useMiniAppStore = create<StoreState>((set, get) => ({
  telegramUser: null,
  sessionUserId: null,
  workspaceId: '',
  workouts: [],
  loading: false,
  authLoading: false,
  email: '',
  otpCode: '',
  message: null,
  error: null,

  async init() {
    const telegramUser = initTelegramWebApp();
    const savedWorkspaceId = safeLocalStorage.get(WORKSPACE_KEY) ?? '';

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      set({ error: error.message });
      return;
    }

    set({
      telegramUser,
      workspaceId: savedWorkspaceId,
      sessionUserId: session?.user.id ?? null,
    });
  },

  setWorkspaceId(value) {
    safeLocalStorage.set(WORKSPACE_KEY, value);
    set({ workspaceId: value, workouts: [] });
  },

  setEmail(value) {
    set({ email: value });
  },

  setOtpCode(value) {
    set({ otpCode: value });
  },

  async requestOtp() {
    const email = get().email.trim().toLowerCase();
    if (!email) {
      set({ error: 'Enter email first.' });
      return;
    }

    set({ authLoading: true, error: null, message: null });
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        throw error;
      }
      set({ message: 'Code sent to email.' });
    } catch (error) {
      set({ error: formatError(error) });
    } finally {
      set({ authLoading: false });
    }
  },

  async verifyOtp() {
    const email = get().email.trim().toLowerCase();
    const token = get().otpCode.trim();
    if (!email || !token) {
      set({ error: 'Enter email and code.' });
      return;
    }

    set({ authLoading: true, error: null, message: null });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });
      if (error) {
        throw error;
      }
      set({
        sessionUserId: data.user?.id ?? null,
        otpCode: '',
        message: 'Authenticated.',
      });
    } catch (error) {
      set({ error: formatError(error) });
    } finally {
      set({ authLoading: false });
    }
  },

  async signOut() {
    set({ authLoading: true, error: null, message: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      set({ sessionUserId: null, workouts: [], message: 'Signed out.' });
    } catch (error) {
      set({ error: formatError(error) });
    } finally {
      set({ authLoading: false });
    }
  },

  async loadWorkouts() {
    const workspaceId = get().workspaceId.trim();
    if (!workspaceId) {
      set({ error: 'Set workspace id first.' });
      return;
    }

    set({ loading: true, error: null, message: null });
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('id,title,workout_date,created_at')
        .eq('workspace_id', workspaceId)
        .order('workout_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const workouts = (data ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        workout_date: item.workout_date,
        created_at: item.created_at,
      }));

      set({ workouts });
    } catch (error) {
      set({ error: formatError(error), workouts: [] });
    } finally {
      set({ loading: false });
    }
  },

  async createWorkout(title, workoutDate) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;

    if (!workspaceId) {
      set({ error: 'Set workspace id first.' });
      return;
    }
    if (!sessionUserId) {
      set({ error: 'Sign in first.' });
      return;
    }

    set({ loading: true, error: null, message: null });
    try {
      const { error } = await supabase.from('workouts').insert({
        workspace_id: workspaceId,
        title,
        workout_date: workoutDate,
        created_by: sessionUserId,
      });

      if (error) {
        throw error;
      }

      await get().loadWorkouts();
      set({ message: 'Workout created.' });
    } catch (error) {
      set({ error: formatError(error) });
    } finally {
      set({ loading: false });
    }
  },

  async deleteWorkout(id) {
    const workspaceId = get().workspaceId.trim();
    if (!workspaceId) {
      set({ error: 'Set workspace id first.' });
      return;
    }

    set({ loading: true, error: null, message: null });
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      set((state) => ({
        workouts: state.workouts.filter((workout) => workout.id !== id),
        message: 'Workout deleted.',
      }));
    } catch (error) {
      set({ error: formatError(error) });
    } finally {
      set({ loading: false });
    }
  },
}));
