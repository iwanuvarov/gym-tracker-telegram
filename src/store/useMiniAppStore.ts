import { create } from 'zustand';

import { supabase } from '../lib/supabase';
import { initTelegramWebApp, type TelegramUser } from '../lib/telegram';

type Workout = {
  id: string;
  workspace_id: string;
  title: string;
  workout_date: string;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type Workspace = {
  id: string;
  name: string;
  created_at: string;
};

type Exercise = {
  id: string;
  workspace_id: string;
  workout_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type WorkoutSet = {
  id: string;
  workspace_id: string;
  workout_id: string;
  exercise_id: string;
  reps: number;
  weight: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type WorkoutTemplate = {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type WorkoutTemplateExercise = {
  id: string;
  workspace_id: string;
  template_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string;
};

type StoreState = {
  telegramUser: TelegramUser | null;
  sessionUserId: string | null;
  workspaceId: string;
  workspaces: Workspace[];
  workspaceSelectionRequired: boolean;

  workouts: Workout[];
  exercisesByWorkout: Record<string, Exercise[]>;
  setsByExercise: Record<string, WorkoutSet[]>;
  exerciseSummaryById: Record<string, string>;

  templates: WorkoutTemplate[];
  templateExercisesByTemplateId: Record<string, WorkoutTemplateExercise[]>;

  loading: boolean;
  authLoading: boolean;
  email: string;
  otpCode: string;
  message: string | null;
  error: string | null;

  init: () => Promise<void>;
  setEmail: (value: string) => void;
  setOtpCode: (value: string) => void;
  requestOtp: () => Promise<void>;
  verifyOtp: () => Promise<void>;
  signOut: () => Promise<void>;

  refreshWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;

  loadWorkouts: () => Promise<void>;
  createWorkout: (title: string, workoutDate: string) => Promise<Workout>;
  renameWorkout: (payload: { workoutId: string; title: string; workoutDate: string }) => Promise<Workout>;
  deleteWorkout: (id: string) => Promise<void>;

  loadExercises: (workoutId: string) => Promise<void>;
  createExercise: (payload: { workoutId: string; name: string }) => Promise<Exercise>;
  deleteExercise: (payload: { workoutId: string; exerciseId: string }) => Promise<void>;

  loadSets: (payload: { workoutId: string; exerciseId: string }) => Promise<void>;
  createSet: (payload: {
    workoutId: string;
    exerciseId: string;
    reps: number;
    weight: number;
    note?: string;
  }) => Promise<WorkoutSet>;
  deleteSet: (payload: { workoutId: string; exerciseId: string; setId: string }) => Promise<void>;

  loadTemplates: () => Promise<void>;
  createTemplate: (name: string) => Promise<WorkoutTemplate>;
  renameTemplate: (payload: { templateId: string; name: string }) => Promise<WorkoutTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;

  loadTemplateExercises: (templateId: string) => Promise<void>;
  addTemplateExercise: (payload: { templateId: string; name: string }) => Promise<WorkoutTemplateExercise>;
  deleteTemplateExercise: (payload: { templateId: string; templateExerciseId: string }) => Promise<void>;

  createWorkoutFromTemplate: (payload: {
    templateId: string;
    workoutDate: string;
    titleOverride?: string;
  }) => Promise<Workout>;
};

type WorkspaceResolution = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  autoCreated: boolean;
};

type RawWorkoutSet = Omit<WorkoutSet, 'reps' | 'weight'> & {
  reps: number | string;
  weight: number | string;
};

const WORKOUT_SELECT_COLUMNS =
  'id,workspace_id,title,workout_date,created_at,updated_at,created_by';
const EXERCISE_SELECT_COLUMNS =
  'id,workspace_id,workout_id,name,sort_order,created_at,updated_at,created_by';
const SET_SELECT_COLUMNS =
  'id,workspace_id,workout_id,exercise_id,reps,weight,note,created_at,updated_at,created_by';
const TEMPLATE_SELECT_COLUMNS = 'id,workspace_id,name,created_at,updated_at,created_by';
const TEMPLATE_EXERCISE_SELECT_COLUMNS =
  'id,workspace_id,template_id,name,sort_order,created_at,updated_at,created_by';

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
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // noop
    }
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isValidIsoDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const toNumber = (value: number | string): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSet = (row: RawWorkoutSet): WorkoutSet => ({
  ...row,
  reps: toNumber(row.reps),
  weight: toNumber(row.weight),
});

const sortWorkouts = (workouts: Workout[]): Workout[] =>
  [...workouts].sort((a, b) => {
    if (a.workout_date === b.workout_date) {
      return b.created_at.localeCompare(a.created_at);
    }
    return b.workout_date.localeCompare(a.workout_date);
  });

const sortExercises = (exercises: Exercise[]): Exercise[] =>
  [...exercises].sort((a, b) => {
    if (a.sort_order === b.sort_order) {
      return a.created_at.localeCompare(b.created_at);
    }
    return a.sort_order - b.sort_order;
  });

const sortWorkoutSets = (sets: WorkoutSet[]): WorkoutSet[] =>
  [...sets].sort((a, b) => a.created_at.localeCompare(b.created_at));

const sortTemplates = (templates: WorkoutTemplate[]): WorkoutTemplate[] =>
  [...templates].sort((a, b) => b.created_at.localeCompare(a.created_at));

const sortTemplateExercises = (
  templateExercises: WorkoutTemplateExercise[],
): WorkoutTemplateExercise[] =>
  [...templateExercises].sort((a, b) => {
    if (a.sort_order === b.sort_order) {
      return a.created_at.localeCompare(b.created_at);
    }
    return a.sort_order - b.sort_order;
  });

const formatWeight = (weight: number): string => {
  if (Number.isInteger(weight)) {
    return String(weight);
  }
  return String(weight);
};

const buildExerciseSummary = (sets: WorkoutSet[]): string => {
  if (sets.length === 0) {
    return 'Нет подходов';
  }

  return sets.map((setRow) => `${formatWeight(setRow.weight)}x${setRow.reps}`).join(', ');
};

const extractErrorText = (error: unknown): { message: string; details: string; code: string } => {
  if (error instanceof Error) {
    return { message: error.message, details: '', code: '' };
  }

  if (isRecord(error)) {
    const message = typeof error.message === 'string' ? error.message : '';
    const details = typeof error.details === 'string' ? error.details : '';
    const code = typeof error.code === 'string' ? error.code : '';
    return { message, details, code };
  }

  return { message: '', details: '', code: '' };
};

const formatError = (error: unknown): string => {
  const { message, details, code } = extractErrorText(error);
  const lower = `${message} ${details}`.toLowerCase();

  if (lower.includes('invalid input syntax for type uuid')) {
    return 'Некорректный формат ID пространства. Выберите пространство из списка.';
  }

  if (lower.includes('row-level security')) {
    return 'Нет доступа к данным выбранного пространства.';
  }

  if (lower.includes('check constraint') || lower.includes('must be greater than or equal')) {
    return 'Проверьте значения: подходы и вес должны быть неотрицательными.';
  }

  if (!message) {
    return 'Неизвестная ошибка. Проверьте данные и попробуйте снова.';
  }

  const suffix = code ? ` (код ${code})` : '';
  return details ? `${message}${suffix}. ${details}` : `${message}${suffix}`;
};

const fetchWorkspaces = async (): Promise<Workspace[]> => {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id,name,created_at')
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as Workspace[];
};

const fetchWorkouts = async (workspaceId: string): Promise<Workout[]> => {
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('workout_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return sortWorkouts((data ?? []) as Workout[]);
};

const fetchTemplates = async (workspaceId: string): Promise<WorkoutTemplate[]> => {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(TEMPLATE_SELECT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return sortTemplates((data ?? []) as WorkoutTemplate[]);
};

const fetchExercises = async (workspaceId: string, workoutId: string): Promise<Exercise[]> => {
  const { data, error } = await supabase
    .from('exercises')
    .select(EXERCISE_SELECT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('workout_id', workoutId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return sortExercises((data ?? []) as Exercise[]);
};

const fetchSets = async (
  workspaceId: string,
  workoutId: string,
  exerciseId: string,
): Promise<WorkoutSet[]> => {
  const { data, error } = await supabase
    .from('sets')
    .select(SET_SELECT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('workout_id', workoutId)
    .eq('exercise_id', exerciseId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const normalized = ((data ?? []) as RawWorkoutSet[]).map(normalizeSet);
  return sortWorkoutSets(normalized);
};

const fetchTemplateExercises = async (
  workspaceId: string,
  templateId: string,
): Promise<WorkoutTemplateExercise[]> => {
  const { data, error } = await supabase
    .from('workout_template_exercises')
    .select(TEMPLATE_EXERCISE_SELECT_COLUMNS)
    .eq('workspace_id', workspaceId)
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return sortTemplateExercises((data ?? []) as WorkoutTemplateExercise[]);
};

const fetchExerciseSummaries = async (
  workspaceId: string,
  workoutId: string,
): Promise<Record<string, string>> => {
  const { data, error } = await supabase
    .from('sets')
    .select('exercise_id,reps,weight,created_at')
    .eq('workspace_id', workspaceId)
    .eq('workout_id', workoutId)
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const setsByExercise = new Map<string, WorkoutSet[]>();
  const rows = (data ?? []) as Array<{
    exercise_id: string;
    reps: number | string;
    weight: number | string;
    created_at: string;
  }>;

  rows.forEach((row) => {
    const current = setsByExercise.get(row.exercise_id) ?? [];
    current.push({
      id: '',
      workspace_id: workspaceId,
      workout_id: workoutId,
      exercise_id: row.exercise_id,
      reps: toNumber(row.reps),
      weight: toNumber(row.weight),
      note: null,
      created_at: row.created_at,
      updated_at: row.created_at,
      created_by: '',
    });
    setsByExercise.set(row.exercise_id, current);
  });

  const summaries: Record<string, string> = {};
  setsByExercise.forEach((sets, exerciseId) => {
    summaries[exerciseId] = buildExerciseSummary(sortWorkoutSets(sets));
  });

  return summaries;
};

const ensureWorkspace = async (savedWorkspaceId: string): Promise<WorkspaceResolution> => {
  let workspaces = await fetchWorkspaces();
  let autoCreated = false;

  if (workspaces.length === 0) {
    const { data, error } = await supabase.rpc('create_workspace_with_owner', {
      name: 'Общее пространство',
    });

    if (error) {
      throw error;
    }

    autoCreated = true;
    workspaces = await fetchWorkspaces();

    if (workspaces.length === 0 && typeof data === 'string') {
      workspaces = [
        {
          id: data,
          name: 'Общее пространство',
          created_at: new Date().toISOString(),
        },
      ];
    }
  }

  const hasSavedWorkspace =
    savedWorkspaceId.length > 0 && workspaces.some((workspace) => workspace.id === savedWorkspaceId);

  const activeWorkspaceId = hasSavedWorkspace
    ? savedWorkspaceId
    : workspaces.length === 1
      ? (workspaces[0]?.id ?? '')
      : '';

  return { workspaces, activeWorkspaceId, autoCreated };
};

const loadWorkspaceScopedData = async (
  activeWorkspaceId: string,
): Promise<{ workouts: Workout[]; templates: WorkoutTemplate[] }> => {
  const [workouts, templates] = await Promise.all([
    fetchWorkouts(activeWorkspaceId),
    fetchTemplates(activeWorkspaceId),
  ]);

  return { workouts, templates };
};

const initialNestedState = {
  exercisesByWorkout: {} as Record<string, Exercise[]>,
  setsByExercise: {} as Record<string, WorkoutSet[]>,
  exerciseSummaryById: {} as Record<string, string>,
  templateExercisesByTemplateId: {} as Record<string, WorkoutTemplateExercise[]>,
};

export const useMiniAppStore = create<StoreState>((set, get) => ({
  telegramUser: null,
  sessionUserId: null,
  workspaceId: '',
  workspaces: [],
  workspaceSelectionRequired: false,

  workouts: [],
  templates: [],
  ...initialNestedState,

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
      set({ error: formatError(error) });
      return;
    }

    if (!session?.user.id) {
      set({
        telegramUser,
        sessionUserId: null,
        workspaceId: '',
        workspaces: [],
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        ...initialNestedState,
      });
      return;
    }

    set({ telegramUser, sessionUserId: session.user.id, loading: true, error: null });

    try {
      const resolution = await ensureWorkspace(savedWorkspaceId);

      let workouts: Workout[] = [];
      let templates: WorkoutTemplate[] = [];

      if (resolution.activeWorkspaceId) {
        const data = await loadWorkspaceScopedData(resolution.activeWorkspaceId);
        workouts = data.workouts;
        templates = data.templates;
        safeLocalStorage.set(WORKSPACE_KEY, resolution.activeWorkspaceId);
      } else {
        safeLocalStorage.remove(WORKSPACE_KEY);
      }

      set({
        workspaceId: resolution.activeWorkspaceId,
        workspaces: resolution.workspaces,
        workspaceSelectionRequired:
          resolution.workspaces.length > 1 && resolution.activeWorkspaceId.length === 0,
        workouts,
        templates,
        ...initialNestedState,
        message: resolution.autoCreated ? 'Создано новое пространство.' : null,
      });
    } catch (innerError) {
      set({
        workspaceId: '',
        workspaces: [],
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        ...initialNestedState,
        error: formatError(innerError),
      });
    } finally {
      set({ loading: false });
    }
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
      set({ error: 'Введите email.' });
      return;
    }

    set({ authLoading: true, error: null, message: null });
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) {
        throw error;
      }
      set({ message: 'Код отправлен на email.' });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ authLoading: false });
    }
  },

  async verifyOtp() {
    const email = get().email.trim().toLowerCase();
    const token = get().otpCode.trim();

    if (!email || !token) {
      set({ error: 'Введите email и код.' });
      return;
    }

    set({ authLoading: true, loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        throw error;
      }

      const userId = data.user?.id;
      if (!userId) {
        throw new Error('Сессия не создана после подтверждения кода.');
      }

      const savedWorkspaceId = safeLocalStorage.get(WORKSPACE_KEY) ?? '';
      const resolution = await ensureWorkspace(savedWorkspaceId);

      let workouts: Workout[] = [];
      let templates: WorkoutTemplate[] = [];

      if (resolution.activeWorkspaceId) {
        const dataByWorkspace = await loadWorkspaceScopedData(resolution.activeWorkspaceId);
        workouts = dataByWorkspace.workouts;
        templates = dataByWorkspace.templates;
        safeLocalStorage.set(WORKSPACE_KEY, resolution.activeWorkspaceId);
      } else {
        safeLocalStorage.remove(WORKSPACE_KEY);
      }

      set({
        sessionUserId: userId,
        otpCode: '',
        workspaceId: resolution.activeWorkspaceId,
        workspaces: resolution.workspaces,
        workspaceSelectionRequired:
          resolution.workspaces.length > 1 && resolution.activeWorkspaceId.length === 0,
        workouts,
        templates,
        ...initialNestedState,
        message: resolution.autoCreated
          ? 'Вход выполнен. Создано новое пространство.'
          : 'Вход выполнен.',
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ authLoading: false, loading: false });
    }
  },

  async signOut() {
    set({ authLoading: true, error: null, message: null });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      safeLocalStorage.remove(WORKSPACE_KEY);

      set({
        sessionUserId: null,
        workspaceId: '',
        workspaces: [],
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        ...initialNestedState,
        message: 'Вы вышли из аккаунта.',
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ authLoading: false });
    }
  },

  async refreshWorkspaces() {
    const sessionUserId = get().sessionUserId;
    if (!sessionUserId) {
      set({ error: 'Сначала выполните вход.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const resolution = await ensureWorkspace(get().workspaceId);

      let workouts: Workout[] = [];
      let templates: WorkoutTemplate[] = [];

      if (resolution.activeWorkspaceId) {
        const dataByWorkspace = await loadWorkspaceScopedData(resolution.activeWorkspaceId);
        workouts = dataByWorkspace.workouts;
        templates = dataByWorkspace.templates;
        safeLocalStorage.set(WORKSPACE_KEY, resolution.activeWorkspaceId);
      } else {
        safeLocalStorage.remove(WORKSPACE_KEY);
      }

      set({
        workspaceId: resolution.activeWorkspaceId,
        workspaces: resolution.workspaces,
        workspaceSelectionRequired:
          resolution.workspaces.length > 1 && resolution.activeWorkspaceId.length === 0,
        workouts,
        templates,
        ...initialNestedState,
        message: resolution.autoCreated ? 'Создано новое пространство.' : null,
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async selectWorkspace(id) {
    const sessionUserId = get().sessionUserId;
    if (!sessionUserId) {
      set({ error: 'Сначала выполните вход.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const dataByWorkspace = await loadWorkspaceScopedData(id);
      safeLocalStorage.set(WORKSPACE_KEY, id);

      set({
        workspaceId: id,
        workspaceSelectionRequired: false,
        workouts: dataByWorkspace.workouts,
        templates: dataByWorkspace.templates,
        ...initialNestedState,
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async loadWorkouts() {
    const workspaceId = get().workspaceId.trim();
    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });
    try {
      const workouts = await fetchWorkouts(workspaceId);
      set({ workouts });
    } catch (innerError) {
      set({ error: formatError(innerError), workouts: [] });
    } finally {
      set({ loading: false });
    }
  },

  async createWorkout(title, workoutDate) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;
    const cleanTitle = title.trim();
    const cleanDate = workoutDate.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!sessionUserId) {
      throw new Error('Сначала выполните вход.');
    }

    if (!cleanTitle) {
      throw new Error('Введите название тренировки.');
    }

    if (!isValidIsoDate(cleanDate)) {
      throw new Error('Дата должна быть в формате YYYY-MM-DD.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          workspace_id: workspaceId,
          title: cleanTitle,
          workout_date: cleanDate,
          created_by: sessionUserId,
        })
        .select(WORKOUT_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const createdWorkout = data as Workout;

      set((state) => ({
        workouts: sortWorkouts([createdWorkout, ...state.workouts]),
        message: 'Тренировка создана.',
      }));

      return createdWorkout;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async renameWorkout({ workoutId, title, workoutDate }) {
    const workspaceId = get().workspaceId.trim();
    const cleanTitle = title.trim();
    const cleanDate = workoutDate.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!cleanTitle) {
      throw new Error('Название тренировки не может быть пустым.');
    }

    if (!isValidIsoDate(cleanDate)) {
      throw new Error('Дата должна быть в формате YYYY-MM-DD.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase
        .from('workouts')
        .update({
          title: cleanTitle,
          workout_date: cleanDate,
        })
        .eq('id', workoutId)
        .eq('workspace_id', workspaceId)
        .select(WORKOUT_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const updatedWorkout = data as Workout;

      set((state) => ({
        workouts: sortWorkouts(
          state.workouts.map((workout) => (workout.id === workoutId ? updatedWorkout : workout)),
        ),
        message: 'Тренировка обновлена.',
      }));

      return updatedWorkout;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async deleteWorkout(id) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
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

      set((state) => {
        const nextExercisesByWorkout = { ...state.exercisesByWorkout };
        const removedExercises = nextExercisesByWorkout[id] ?? [];
        delete nextExercisesByWorkout[id];

        const nextSetsByExercise = { ...state.setsByExercise };
        const nextExerciseSummaryById = { ...state.exerciseSummaryById };

        removedExercises.forEach((exercise) => {
          delete nextSetsByExercise[exercise.id];
          delete nextExerciseSummaryById[exercise.id];
        });

        return {
          workouts: state.workouts.filter((workout) => workout.id !== id),
          exercisesByWorkout: nextExercisesByWorkout,
          setsByExercise: nextSetsByExercise,
          exerciseSummaryById: nextExerciseSummaryById,
          message: 'Тренировка удалена.',
        };
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async loadExercises(workoutId) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const [exercises, summaries] = await Promise.all([
        fetchExercises(workspaceId, workoutId),
        fetchExerciseSummaries(workspaceId, workoutId),
      ]);

      const nextSummaryByExerciseId: Record<string, string> = { ...get().exerciseSummaryById };
      exercises.forEach((exercise) => {
        nextSummaryByExerciseId[exercise.id] = summaries[exercise.id] ?? 'Нет подходов';
      });

      set((state) => ({
        exercisesByWorkout: {
          ...state.exercisesByWorkout,
          [workoutId]: exercises,
        },
        exerciseSummaryById: nextSummaryByExerciseId,
      }));
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async createExercise({ workoutId, name }) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;
    const cleanName = name.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!sessionUserId) {
      throw new Error('Сначала выполните вход.');
    }

    if (!cleanName) {
      throw new Error('Введите название упражнения.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data: maxSortData, error: maxSortError } = await supabase
        .from('exercises')
        .select('sort_order')
        .eq('workspace_id', workspaceId)
        .eq('workout_id', workoutId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxSortError) {
        throw maxSortError;
      }

      const nextSortOrder = (maxSortData?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('exercises')
        .insert({
          workspace_id: workspaceId,
          workout_id: workoutId,
          name: cleanName,
          sort_order: nextSortOrder,
          created_by: sessionUserId,
        })
        .select(EXERCISE_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const createdExercise = data as Exercise;

      set((state) => {
        const current = state.exercisesByWorkout[workoutId] ?? [];
        return {
          exercisesByWorkout: {
            ...state.exercisesByWorkout,
            [workoutId]: sortExercises([...current, createdExercise]),
          },
          exerciseSummaryById: {
            ...state.exerciseSummaryById,
            [createdExercise.id]: 'Нет подходов',
          },
          message: 'Упражнение добавлено.',
        };
      });

      return createdExercise;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async deleteExercise({ workoutId, exerciseId }) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId)
        .eq('workout_id', workoutId)
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      set((state) => {
        const currentExercises = state.exercisesByWorkout[workoutId] ?? [];
        const nextSetsByExercise = { ...state.setsByExercise };
        const nextSummaryByExerciseId = { ...state.exerciseSummaryById };

        delete nextSetsByExercise[exerciseId];
        delete nextSummaryByExerciseId[exerciseId];

        return {
          exercisesByWorkout: {
            ...state.exercisesByWorkout,
            [workoutId]: currentExercises.filter((exercise) => exercise.id !== exerciseId),
          },
          setsByExercise: nextSetsByExercise,
          exerciseSummaryById: nextSummaryByExerciseId,
          message: 'Упражнение удалено.',
        };
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async loadSets({ workoutId, exerciseId }) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const sets = await fetchSets(workspaceId, workoutId, exerciseId);
      set((state) => ({
        setsByExercise: {
          ...state.setsByExercise,
          [exerciseId]: sets,
        },
        exerciseSummaryById: {
          ...state.exerciseSummaryById,
          [exerciseId]: buildExerciseSummary(sets),
        },
      }));
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async createSet({ workoutId, exerciseId, reps, weight, note }) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!sessionUserId) {
      throw new Error('Сначала выполните вход.');
    }

    if (!Number.isFinite(reps) || reps < 0 || !Number.isFinite(weight) || weight < 0) {
      throw new Error('Проверьте значения: повторения и вес должны быть неотрицательными.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase
        .from('sets')
        .insert({
          workspace_id: workspaceId,
          workout_id: workoutId,
          exercise_id: exerciseId,
          reps,
          weight,
          note: note?.trim() ? note.trim() : null,
          created_by: sessionUserId,
        })
        .select(SET_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const createdSet = normalizeSet(data as RawWorkoutSet);

      set((state) => {
        const currentSets = state.setsByExercise[exerciseId] ?? [];
        const nextSets = sortWorkoutSets([...currentSets, createdSet]);

        return {
          setsByExercise: {
            ...state.setsByExercise,
            [exerciseId]: nextSets,
          },
          exerciseSummaryById: {
            ...state.exerciseSummaryById,
            [exerciseId]: buildExerciseSummary(nextSets),
          },
          message: 'Подход добавлен.',
        };
      });

      return createdSet;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async deleteSet({ workoutId, exerciseId, setId }) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const { error } = await supabase
        .from('sets')
        .delete()
        .eq('id', setId)
        .eq('workspace_id', workspaceId)
        .eq('workout_id', workoutId)
        .eq('exercise_id', exerciseId);

      if (error) {
        throw error;
      }

      set((state) => {
        const currentSets = state.setsByExercise[exerciseId] ?? [];
        const nextSets = currentSets.filter((setRow) => setRow.id !== setId);

        return {
          setsByExercise: {
            ...state.setsByExercise,
            [exerciseId]: nextSets,
          },
          exerciseSummaryById: {
            ...state.exerciseSummaryById,
            [exerciseId]: buildExerciseSummary(nextSets),
          },
          message: 'Подход удален.',
        };
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async loadTemplates() {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const templates = await fetchTemplates(workspaceId);
      set({ templates });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async createTemplate(name) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;
    const cleanName = name.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!sessionUserId) {
      throw new Error('Сначала выполните вход.');
    }

    if (!cleanName) {
      throw new Error('Введите название шаблона.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .insert({
          workspace_id: workspaceId,
          name: cleanName,
          created_by: sessionUserId,
        })
        .select(TEMPLATE_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const createdTemplate = data as WorkoutTemplate;

      set((state) => ({
        templates: sortTemplates([createdTemplate, ...state.templates]),
        message: 'Шаблон создан.',
      }));

      return createdTemplate;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async renameTemplate({ templateId, name }) {
    const workspaceId = get().workspaceId.trim();
    const cleanName = name.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!cleanName) {
      throw new Error('Название шаблона не может быть пустым.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .update({ name: cleanName })
        .eq('id', templateId)
        .eq('workspace_id', workspaceId)
        .select(TEMPLATE_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const updatedTemplate = data as WorkoutTemplate;

      set((state) => ({
        templates: sortTemplates(
          state.templates.map((template) => (template.id === templateId ? updatedTemplate : template)),
        ),
        message: 'Шаблон обновлен.',
      }));

      return updatedTemplate;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async deleteTemplate(templateId) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', templateId)
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      set((state) => {
        const nextTemplateExercisesByTemplateId = { ...state.templateExercisesByTemplateId };
        delete nextTemplateExercisesByTemplateId[templateId];

        return {
          templates: state.templates.filter((template) => template.id !== templateId),
          templateExercisesByTemplateId: nextTemplateExercisesByTemplateId,
          message: 'Шаблон удален.',
        };
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async loadTemplateExercises(templateId) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const templateExercises = await fetchTemplateExercises(workspaceId, templateId);
      set((state) => ({
        templateExercisesByTemplateId: {
          ...state.templateExercisesByTemplateId,
          [templateId]: templateExercises,
        },
      }));
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async addTemplateExercise({ templateId, name }) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;
    const cleanName = name.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!sessionUserId) {
      throw new Error('Сначала выполните вход.');
    }

    if (!cleanName) {
      throw new Error('Введите название упражнения для шаблона.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data: maxSortData, error: maxSortError } = await supabase
        .from('workout_template_exercises')
        .select('sort_order')
        .eq('workspace_id', workspaceId)
        .eq('template_id', templateId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (maxSortError) {
        throw maxSortError;
      }

      const nextSortOrder = (maxSortData?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('workout_template_exercises')
        .insert({
          workspace_id: workspaceId,
          template_id: templateId,
          name: cleanName,
          sort_order: nextSortOrder,
          created_by: sessionUserId,
        })
        .select(TEMPLATE_EXERCISE_SELECT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      const createdTemplateExercise = data as WorkoutTemplateExercise;

      set((state) => {
        const current = state.templateExercisesByTemplateId[templateId] ?? [];

        return {
          templateExercisesByTemplateId: {
            ...state.templateExercisesByTemplateId,
            [templateId]: sortTemplateExercises([...current, createdTemplateExercise]),
          },
          message: 'Упражнение в шаблон добавлено.',
        };
      });

      return createdTemplateExercise;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async deleteTemplateExercise({ templateId, templateExerciseId }) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const { error } = await supabase
        .from('workout_template_exercises')
        .delete()
        .eq('id', templateExerciseId)
        .eq('template_id', templateId)
        .eq('workspace_id', workspaceId);

      if (error) {
        throw error;
      }

      set((state) => {
        const current = state.templateExercisesByTemplateId[templateId] ?? [];
        return {
          templateExercisesByTemplateId: {
            ...state.templateExercisesByTemplateId,
            [templateId]: current.filter((item) => item.id !== templateExerciseId),
          },
          message: 'Упражнение из шаблона удалено.',
        };
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async createWorkoutFromTemplate({ templateId, workoutDate, titleOverride }) {
    const workspaceId = get().workspaceId.trim();
    const sessionUserId = get().sessionUserId;
    const cleanDate = workoutDate.trim();
    const cleanTitleOverride = titleOverride?.trim() ?? '';

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    if (!sessionUserId) {
      throw new Error('Сначала выполните вход.');
    }

    if (!isValidIsoDate(cleanDate)) {
      throw new Error('Дата должна быть в формате YYYY-MM-DD.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data: templateData, error: templateError } = await supabase
        .from('workout_templates')
        .select(TEMPLATE_SELECT_COLUMNS)
        .eq('id', templateId)
        .eq('workspace_id', workspaceId)
        .single();

      if (templateError) {
        throw templateError;
      }

      const template = templateData as WorkoutTemplate;

      const templateExercises = await fetchTemplateExercises(workspaceId, templateId);

      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          workspace_id: workspaceId,
          title: cleanTitleOverride || template.name,
          workout_date: cleanDate,
          created_by: sessionUserId,
        })
        .select(WORKOUT_SELECT_COLUMNS)
        .single();

      if (workoutError) {
        throw workoutError;
      }

      const createdWorkout = workoutData as Workout;
      let createdExercises: Exercise[] = [];

      if (templateExercises.length > 0) {
        const { data: createdExercisesData, error: createdExercisesError } = await supabase
          .from('exercises')
          .insert(
            templateExercises.map((templateExercise) => ({
              workspace_id: workspaceId,
              workout_id: createdWorkout.id,
              name: templateExercise.name,
              sort_order: templateExercise.sort_order,
              created_by: sessionUserId,
            })),
          )
          .select(EXERCISE_SELECT_COLUMNS);

        if (createdExercisesError) {
          throw createdExercisesError;
        }

        createdExercises = sortExercises((createdExercisesData ?? []) as Exercise[]);
      }

      set((state) => {
        const nextExerciseSummaryById = { ...state.exerciseSummaryById };
        createdExercises.forEach((exercise) => {
          nextExerciseSummaryById[exercise.id] = 'Нет подходов';
        });

        return {
          workouts: sortWorkouts([createdWorkout, ...state.workouts]),
          exercisesByWorkout: {
            ...state.exercisesByWorkout,
            [createdWorkout.id]: createdExercises,
          },
          exerciseSummaryById: nextExerciseSummaryById,
          message: 'Тренировка создана из шаблона.',
        };
      });

      return createdWorkout;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },
}));
