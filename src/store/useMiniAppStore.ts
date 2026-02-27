import { create } from 'zustand';

import { env } from '../lib/env';
import { supabase } from '../lib/supabase';
import {
  getTelegramInitData,
  getTelegramStartParam,
  initTelegramWebApp,
  type TelegramUser,
} from '../lib/telegram';

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

type WorkspaceRole = 'owner' | 'coach' | 'member';

type WorkspaceMember = {
  user_id: string;
  email: string;
  role: WorkspaceRole;
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

type WeeklyAnalyticsPoint = {
  weekStart: string;
  volume: number;
  workouts: number;
};

type ExerciseAnalyticsPoint = {
  exerciseId: string;
  exerciseName: string;
  setCount: number;
  volume: number;
};

type ExerciseProgressPoint = {
  exerciseId: string;
  exerciseName: string;
  currentMaxWeight: number;
  previousMaxWeight: number | null;
  deltaPercent: number | null;
};

type WorkspaceAnalytics = {
  periodDays: number;
  totalWorkouts: number;
  totalSets: number;
  totalVolume: number;
  weekly: WeeklyAnalyticsPoint[];
  topExercises: ExerciseAnalyticsPoint[];
  progress: ExerciseProgressPoint[];
};

type StoreState = {
  telegramUser: TelegramUser | null;
  sessionUserId: string | null;
  workspaceId: string;
  workspaces: Workspace[];
  workspaceMembers: WorkspaceMember[];
  coachInviteLink: string;
  workspaceSelectionRequired: boolean;

  workouts: Workout[];
  workoutSummariesById: Record<string, string>;
  exercisesByWorkout: Record<string, Exercise[]>;
  setsByExercise: Record<string, WorkoutSet[]>;
  exerciseSummaryById: Record<string, string>;

  templates: WorkoutTemplate[];
  templateExercisesByTemplateId: Record<string, WorkoutTemplateExercise[]>;
  analytics: WorkspaceAnalytics | null;

  loading: boolean;
  authLoading: boolean;
  message: string | null;
  error: string | null;

  init: () => Promise<void>;
  signInWithTelegram: () => Promise<void>;
  signOut: () => Promise<void>;

  refreshWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  loadWorkspaceMembers: () => Promise<void>;
  createCoachInviteLink: () => Promise<string>;
  removeWorkspaceMember: (userId: string) => Promise<void>;
  loadAnalytics: (periodDays?: number) => Promise<void>;

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

type ExerciseSummaryRow = {
  id: string;
  workout_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

type SetSummaryRow = {
  workout_id: string;
  exercise_id: string;
  reps: number | string;
  weight: number | string;
  created_at: string;
};

type TelegramAuthResponse = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  isNewUser: boolean;
};

type AuthBootstrapData = {
  workspaceId: string;
  workspaces: Workspace[];
  workspaceSelectionRequired: boolean;
  workouts: Workout[];
  workoutSummariesById: Record<string, string>;
  templates: WorkoutTemplate[];
  workspaceMembers: WorkspaceMember[];
  autoCreated: boolean;
};

type InviteAcceptanceResult = {
  workspaceId: string;
  message: string;
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

const sortExerciseSummaries = (exercises: ExerciseSummaryRow[]): ExerciseSummaryRow[] =>
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

const sortWorkspaceMembers = (workspaceMembers: WorkspaceMember[]): WorkspaceMember[] => {
  const roleRank: Record<WorkspaceRole, number> = {
    owner: 0,
    coach: 1,
    member: 2,
  };

  return [...workspaceMembers].sort((a, b) => {
    const roleDiff = roleRank[a.role] - roleRank[b.role];
    if (roleDiff !== 0) {
      return roleDiff;
    }

    const emailA = a.email.toLowerCase();
    const emailB = b.email.toLowerCase();
    if (emailA !== emailB) {
      return emailA.localeCompare(emailB);
    }

    return a.user_id.localeCompare(b.user_id);
  });
};

const formatWeight = (weight: number): string => {
  if (Number.isInteger(weight)) {
    return String(weight);
  }
  return weight.toFixed(2).replace(/\.?0+$/, '');
};

const normalizeExerciseName = (name: string): string =>
  name.trim().replace(/\s+/g, ' ').toLowerCase();

const prettifyExerciseName = (name: string): string => {
  const value = name.trim().replace(/\s+/g, ' ');
  return value.length > 0 ? value : 'Без названия';
};

const buildExerciseSummary = (sets: WorkoutSet[]): string => {
  if (sets.length === 0) {
    return 'Нет подходов';
  }

  return sets.map((setRow) => `${formatWeight(setRow.weight)}x${setRow.reps}`).join(', ');
};

const buildWorkoutSummary = (
  workoutExercises: Array<{ id: string; name: string }>,
  summaryByExerciseId: Record<string, string>,
): string => {
  if (workoutExercises.length === 0) {
    return 'Нет упражнений.';
  }

  const exerciseSummaries = workoutExercises
    .map((exercise) => {
      const summary = summaryByExerciseId[exercise.id];
      if (!summary || summary === 'Нет подходов') {
        return null;
      }
      return `${exercise.name}: ${summary}`;
    })
    .filter((value): value is string => Boolean(value));

  if (exerciseSummaries.length === 0) {
    return 'Подходы не заполнены.';
  }

  return exerciseSummaries.join(' • ');
};

const getWeekStartIso = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  const day = date.getUTCDay();
  const diffToMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diffToMonday);
  return date.toISOString().slice(0, 10);
};

const generateWeekRange = (fromIso: string, toIso: string): string[] => {
  const result: string[] = [];
  const cursor = new Date(`${getWeekStartIso(fromIso)}T00:00:00.000Z`);
  const last = new Date(`${getWeekStartIso(toIso)}T00:00:00.000Z`);

  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return result;
};

const inviteStartParamPrefix = 'invite_';

const extractInviteTokenFromStartParam = (startParam: string | null): string | null => {
  if (!startParam) {
    return null;
  }

  const normalized = startParam.trim();
  if (!normalized.startsWith(inviteStartParamPrefix)) {
    return null;
  }

  const token = normalized.slice(inviteStartParamPrefix.length).trim();
  if (!/^[a-zA-Z0-9_-]{16,200}$/.test(token)) {
    return null;
  }

  return token;
};

const buildCoachInviteLink = (token: string): string => {
  const startParam = `${inviteStartParamPrefix}${token}`;
  if (env.telegramBotUsername) {
    return `https://t.me/${env.telegramBotUsername}/app?startapp=${encodeURIComponent(startParam)}`;
  }

  return `${window.location.origin}/?tgWebAppStartParam=${encodeURIComponent(startParam)}`;
};

const acceptInviteFromStartParam = async (): Promise<InviteAcceptanceResult | null> => {
  const startParam = getTelegramStartParam();
  const inviteToken = extractInviteTokenFromStartParam(startParam);

  if (!inviteToken) {
    return null;
  }

  const { data, error } = await supabase.rpc('accept_workspace_invite', {
    invite_token: inviteToken,
  });

  if (error) {
    throw error;
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Не удалось принять приглашение тренера.');
  }

  return {
    workspaceId: data,
    message: 'Приглашение принято. Вы добавлены как тренер.',
  };
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

const fetchWorkspaceMembers = async (workspaceId: string): Promise<WorkspaceMember[]> => {
  const { data, error } = await supabase.rpc('list_workspace_members', {
    wid: workspaceId,
  });

  if (error) {
    throw error;
  }

  return sortWorkspaceMembers((data ?? []) as WorkspaceMember[]);
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

const fetchWorkoutSummaries = async (
  workspaceId: string,
  workoutIds: string[],
): Promise<Record<string, string>> => {
  if (workoutIds.length === 0) {
    return {};
  }

  const [exercisesResult, setsResult] = await Promise.all([
    supabase
      .from('exercises')
      .select('id,workout_id,name,sort_order,created_at')
      .eq('workspace_id', workspaceId)
      .in('workout_id', workoutIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('sets')
      .select('workout_id,exercise_id,reps,weight,created_at')
      .eq('workspace_id', workspaceId)
      .in('workout_id', workoutIds)
      .order('created_at', { ascending: true }),
  ]);

  if (exercisesResult.error) {
    throw exercisesResult.error;
  }

  if (setsResult.error) {
    throw setsResult.error;
  }

  const exercises = sortExerciseSummaries((exercisesResult.data ?? []) as ExerciseSummaryRow[]);
  const sets = (setsResult.data ?? []) as SetSummaryRow[];

  const setsByExerciseId = new Map<string, WorkoutSet[]>();
  sets.forEach((setRow) => {
    const current = setsByExerciseId.get(setRow.exercise_id) ?? [];
    current.push({
      id: '',
      workspace_id: workspaceId,
      workout_id: setRow.workout_id,
      exercise_id: setRow.exercise_id,
      reps: toNumber(setRow.reps),
      weight: toNumber(setRow.weight),
      note: null,
      created_at: setRow.created_at,
      updated_at: setRow.created_at,
      created_by: '',
    });
    setsByExerciseId.set(setRow.exercise_id, current);
  });

  const summaryByExerciseId: Record<string, string> = {};
  setsByExerciseId.forEach((exerciseSets, exerciseId) => {
    summaryByExerciseId[exerciseId] = buildExerciseSummary(sortWorkoutSets(exerciseSets));
  });

  const exercisesByWorkout = new Map<string, ExerciseSummaryRow[]>();
  exercises.forEach((exercise) => {
    const current = exercisesByWorkout.get(exercise.workout_id) ?? [];
    current.push(exercise);
    exercisesByWorkout.set(exercise.workout_id, current);
  });

  const workoutSummariesById: Record<string, string> = {};
  workoutIds.forEach((workoutId) => {
    const workoutExercises = exercisesByWorkout.get(workoutId) ?? [];
    workoutSummariesById[workoutId] = buildWorkoutSummary(workoutExercises, summaryByExerciseId);
  });

  return workoutSummariesById;
};

const fetchWorkspaceAnalytics = async (
  workspaceId: string,
  periodDays: number,
): Promise<WorkspaceAnalytics> => {
  const safePeriodDays = Math.max(7, periodDays);
  const todayIso = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(`${todayIso}T00:00:00.000Z`);
  fromDate.setUTCDate(fromDate.getUTCDate() - (safePeriodDays - 1));
  const fromIso = fromDate.toISOString().slice(0, 10);

  const { data: workoutsData, error: workoutsError } = await supabase
    .from('workouts')
    .select('id,workout_date')
    .eq('workspace_id', workspaceId)
    .gte('workout_date', fromIso)
    .order('workout_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (workoutsError) {
    throw workoutsError;
  }

  const workouts = (workoutsData ?? []) as Array<{ id: string; workout_date: string }>;
  const workoutIds = workouts.map((workout) => workout.id);

  if (workoutIds.length === 0) {
    const emptyWeeks = generateWeekRange(fromIso, todayIso).map((weekStart) => ({
      weekStart,
      volume: 0,
      workouts: 0,
    }));

    return {
      periodDays: safePeriodDays,
      totalWorkouts: 0,
      totalSets: 0,
      totalVolume: 0,
      weekly: emptyWeeks,
      topExercises: [],
      progress: [],
    };
  }

  const [exercisesResult, setsResult] = await Promise.all([
    supabase
      .from('exercises')
      .select('id,name,workout_id')
      .eq('workspace_id', workspaceId)
      .in('workout_id', workoutIds),
    supabase
      .from('sets')
      .select('exercise_id,workout_id,reps,weight,created_at')
      .eq('workspace_id', workspaceId)
      .in('workout_id', workoutIds)
      .order('created_at', { ascending: true }),
  ]);

  if (exercisesResult.error) {
    throw exercisesResult.error;
  }

  if (setsResult.error) {
    throw setsResult.error;
  }

  const exercises = (exercisesResult.data ?? []) as Array<{
    id: string;
    name: string;
    workout_id: string;
  }>;

  const sets = (setsResult.data ?? []) as SetSummaryRow[];

  const workoutDateById = new Map<string, string>();
  workouts.forEach((workout) => {
    workoutDateById.set(workout.id, workout.workout_date);
  });

  const exerciseNameById = new Map<string, string>();
  exercises.forEach((exercise) => {
    exerciseNameById.set(exercise.id, exercise.name);
  });

  const weeklyMap = new Map<string, WeeklyAnalyticsPoint>();
  generateWeekRange(fromIso, todayIso).forEach((weekStart) => {
    weeklyMap.set(weekStart, { weekStart, volume: 0, workouts: 0 });
  });

  workouts.forEach((workout) => {
    const weekStart = getWeekStartIso(workout.workout_date);
    const point = weeklyMap.get(weekStart);
    if (point) {
      point.workouts += 1;
    }
  });

  const exerciseStats = new Map<string, ExerciseAnalyticsPoint>();
  const exerciseWorkoutMaxMap = new Map<
    string,
    {
      exerciseNameKey: string;
      exerciseName: string;
      workoutId: string;
      workoutDate: string;
      maxWeight: number;
    }
  >();

  let totalVolume = 0;
  let totalSets = 0;

  sets.forEach((setRow) => {
    const workoutDate = workoutDateById.get(setRow.workout_id);
    if (!workoutDate) {
      return;
    }

    const reps = Math.max(0, toNumber(setRow.reps));
    const weight = Math.max(0, toNumber(setRow.weight));
    const volume = reps * weight;
    const weekStart = getWeekStartIso(workoutDate);

    const weekPoint = weeklyMap.get(weekStart);
    if (weekPoint) {
      weekPoint.volume += volume;
    }

    totalVolume += volume;
    totalSets += 1;

    const exerciseName = prettifyExerciseName(exerciseNameById.get(setRow.exercise_id) ?? 'Без названия');
    const currentExerciseStat = exerciseStats.get(setRow.exercise_id) ?? {
      exerciseId: setRow.exercise_id,
      exerciseName,
      setCount: 0,
      volume: 0,
    };
    currentExerciseStat.setCount += 1;
    currentExerciseStat.volume += volume;
    exerciseStats.set(setRow.exercise_id, currentExerciseStat);

    const progressKey = normalizeExerciseName(exerciseName);
    const exerciseWorkoutKey = `${progressKey}::${setRow.workout_id}`;
    const currentExerciseWorkout = exerciseWorkoutMaxMap.get(exerciseWorkoutKey) ?? {
      exerciseNameKey: progressKey,
      exerciseName,
      workoutId: setRow.workout_id,
      workoutDate,
      maxWeight: 0,
    };

    if (currentExerciseWorkout.exerciseName === 'Без названия' && exerciseName !== 'Без названия') {
      currentExerciseWorkout.exerciseName = exerciseName;
    }

    currentExerciseWorkout.maxWeight = Math.max(currentExerciseWorkout.maxWeight, weight);
    exerciseWorkoutMaxMap.set(exerciseWorkoutKey, currentExerciseWorkout);
  });

  const topExercises = [...exerciseStats.values()]
    .sort((a, b) => {
      if (b.volume !== a.volume) {
        return b.volume - a.volume;
      }
      return b.setCount - a.setCount;
    })
    .slice(0, 6);

  const exerciseWorkoutsByName = new Map<
    string,
    Array<{
      exerciseName: string;
      workoutId: string;
      workoutDate: string;
      maxWeight: number;
    }>
  >();
  exerciseWorkoutMaxMap.forEach((entry) => {
    const current = exerciseWorkoutsByName.get(entry.exerciseNameKey) ?? [];
    current.push({
      exerciseName: entry.exerciseName,
      workoutId: entry.workoutId,
      workoutDate: entry.workoutDate,
      maxWeight: entry.maxWeight,
    });
    exerciseWorkoutsByName.set(entry.exerciseNameKey, current);
  });

  const progress = [...exerciseWorkoutsByName.entries()]
    .map(([exerciseNameKey, entries]) => {
      const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = a.workoutDate.localeCompare(b.workoutDate);
        if (dateCompare !== 0) {
          return dateCompare;
        }
        return a.workoutId.localeCompare(b.workoutId);
      });

      if (sortedEntries.length === 0) {
        return null;
      }

      const firstEntry = sortedEntries.at(0);
      const lastEntry = sortedEntries.at(-1);
      if (!firstEntry || !lastEntry) {
        return null;
      }
      const currentMaxWeight = lastEntry.maxWeight;
      const hasComparisonBase =
        sortedEntries.length > 1 || firstEntry.workoutId !== lastEntry.workoutId;
      const previousMaxWeight = hasComparisonBase ? firstEntry.maxWeight : null;
      const deltaPercent =
        previousMaxWeight && previousMaxWeight > 0
          ? ((currentMaxWeight - previousMaxWeight) / previousMaxWeight) * 100
          : null;

      return {
        exerciseId: exerciseNameKey,
        exerciseName: lastEntry.exerciseName,
        currentMaxWeight,
        previousMaxWeight,
        deltaPercent,
      } as ExerciseProgressPoint;
    })
    .filter((value): value is ExerciseProgressPoint => value !== null)
    .sort((a, b) => b.currentMaxWeight - a.currentMaxWeight)
    .slice(0, 8);

  const weekly = [...weeklyMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return {
    periodDays: safePeriodDays,
    totalWorkouts: workouts.length,
    totalSets,
    totalVolume,
    weekly,
    topExercises,
    progress,
  };
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
): Promise<{
  workouts: Workout[];
  workoutSummariesById: Record<string, string>;
  templates: WorkoutTemplate[];
  workspaceMembers: WorkspaceMember[];
}> => {
  const [workouts, templates, workspaceMembers] = await Promise.all([
    fetchWorkouts(activeWorkspaceId),
    fetchTemplates(activeWorkspaceId),
    fetchWorkspaceMembers(activeWorkspaceId).catch(() => []),
  ]);

  let workoutSummariesById: Record<string, string> = {};
  try {
    workoutSummariesById = await fetchWorkoutSummaries(
      activeWorkspaceId,
      workouts.map((workout) => workout.id),
    );
  } catch {
    workoutSummariesById = {};
  }

  return { workouts, workoutSummariesById, templates, workspaceMembers };
};

const buildAuthBootstrapData = async (savedWorkspaceId: string): Promise<AuthBootstrapData> => {
  const resolution = await ensureWorkspace(savedWorkspaceId);

  let workouts: Workout[] = [];
  let workoutSummariesById: Record<string, string> = {};
  let templates: WorkoutTemplate[] = [];
  let workspaceMembers: WorkspaceMember[] = [];

  if (resolution.activeWorkspaceId) {
    const data = await loadWorkspaceScopedData(resolution.activeWorkspaceId);
    workouts = data.workouts;
    workoutSummariesById = data.workoutSummariesById;
    templates = data.templates;
    workspaceMembers = data.workspaceMembers;
    safeLocalStorage.set(WORKSPACE_KEY, resolution.activeWorkspaceId);
  } else {
    safeLocalStorage.remove(WORKSPACE_KEY);
  }

  return {
    workspaceId: resolution.activeWorkspaceId,
    workspaces: resolution.workspaces,
    workspaceSelectionRequired:
      resolution.workspaces.length > 1 && resolution.activeWorkspaceId.length === 0,
    workouts,
    workoutSummariesById,
    templates,
    workspaceMembers,
    autoCreated: resolution.autoCreated,
  };
};

const createTelegramSession = async (initData: string): Promise<TelegramAuthResponse> => {
  const { data, error } = await supabase.functions.invoke<TelegramAuthResponse>('telegram-auth', {
    body: { initData },
  });

  if (error) {
    throw error;
  }

  if (!data?.accessToken || !data.refreshToken || !data.userId) {
    throw new Error('Сервер авторизации вернул неполные данные сессии.');
  }

  const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
    access_token: data.accessToken,
    refresh_token: data.refreshToken,
  });

  if (setSessionError) {
    throw setSessionError;
  }

  const sessionUserId = sessionData.user?.id;
  if (!sessionUserId) {
    throw new Error('Не удалось активировать сессию после Telegram-авторизации.');
  }

  return {
    ...data,
    userId: sessionUserId,
  };
};

const initialNestedState = {
  workoutSummariesById: {} as Record<string, string>,
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
  workspaceMembers: [],
  coachInviteLink: '',
  workspaceSelectionRequired: false,

  workouts: [],
  templates: [],
  analytics: null,
  ...initialNestedState,

  loading: false,
  authLoading: false,
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
        workspaceMembers: [],
        coachInviteLink: '',
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        analytics: null,
        ...initialNestedState,
      });

      const initData = getTelegramInitData();
      if (telegramUser && initData) {
        await get().signInWithTelegram();
      }
      return;
    }

    set({ telegramUser, sessionUserId: session.user.id, loading: true, error: null });

    try {
      let acceptedInvite: InviteAcceptanceResult | null = null;
      try {
        acceptedInvite = await acceptInviteFromStartParam();
      } catch (innerError) {
        set({ error: formatError(innerError) });
      }

      const bootstrap = await buildAuthBootstrapData(acceptedInvite?.workspaceId ?? savedWorkspaceId);

      set({
        workspaceId: bootstrap.workspaceId,
        workspaces: bootstrap.workspaces,
        workspaceSelectionRequired: bootstrap.workspaceSelectionRequired,
        ...initialNestedState,
        workouts: bootstrap.workouts,
        workoutSummariesById: bootstrap.workoutSummariesById,
        templates: bootstrap.templates,
        workspaceMembers: bootstrap.workspaceMembers,
        coachInviteLink: '',
        analytics: null,
        message: acceptedInvite?.message ?? (bootstrap.autoCreated ? 'Создано новое пространство.' : null),
      });
    } catch (innerError) {
      set({
        workspaceId: '',
        workspaces: [],
        workspaceMembers: [],
        coachInviteLink: '',
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        analytics: null,
        ...initialNestedState,
        error: formatError(innerError),
      });
    } finally {
      set({ loading: false });
    }
  },

  async signInWithTelegram() {
    const telegramUser = get().telegramUser ?? initTelegramWebApp();
    const initData = getTelegramInitData();

    if (!telegramUser || !initData) {
      set({
        telegramUser: telegramUser ?? null,
        error: 'Откройте приложение внутри Telegram (через кнопку Web App у бота).',
      });
      return;
    }

    set({ authLoading: true, loading: true, error: null, message: null });

    try {
      const session = await createTelegramSession(initData);
      const savedWorkspaceId = safeLocalStorage.get(WORKSPACE_KEY) ?? '';

      let acceptedInvite: InviteAcceptanceResult | null = null;
      try {
        acceptedInvite = await acceptInviteFromStartParam();
      } catch (innerError) {
        set({ error: formatError(innerError) });
      }

      const bootstrap = await buildAuthBootstrapData(acceptedInvite?.workspaceId ?? savedWorkspaceId);

      set({
        telegramUser,
        sessionUserId: session.userId,
        workspaceId: bootstrap.workspaceId,
        workspaces: bootstrap.workspaces,
        workspaceSelectionRequired: bootstrap.workspaceSelectionRequired,
        ...initialNestedState,
        workouts: bootstrap.workouts,
        workoutSummariesById: bootstrap.workoutSummariesById,
        templates: bootstrap.templates,
        workspaceMembers: bootstrap.workspaceMembers,
        coachInviteLink: '',
        analytics: null,
        message:
          acceptedInvite?.message ??
          (bootstrap.autoCreated
            ? 'Вход через Telegram выполнен. Создано новое пространство.'
            : session.isNewUser
              ? 'Аккаунт Telegram подключен. Вход выполнен.'
              : 'Вход через Telegram выполнен.'),
      });
    } catch (innerError) {
      set({
        sessionUserId: null,
        workspaceId: '',
        workspaces: [],
        workspaceMembers: [],
        coachInviteLink: '',
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        analytics: null,
        ...initialNestedState,
        error: formatError(innerError),
      });
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
        workspaceMembers: [],
        coachInviteLink: '',
        workspaceSelectionRequired: false,
        workouts: [],
        templates: [],
        analytics: null,
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
      let workoutSummariesById: Record<string, string> = {};
      let templates: WorkoutTemplate[] = [];
      let workspaceMembers: WorkspaceMember[] = [];

      if (resolution.activeWorkspaceId) {
        const dataByWorkspace = await loadWorkspaceScopedData(resolution.activeWorkspaceId);
        workouts = dataByWorkspace.workouts;
        workoutSummariesById = dataByWorkspace.workoutSummariesById;
        templates = dataByWorkspace.templates;
        workspaceMembers = dataByWorkspace.workspaceMembers;
        safeLocalStorage.set(WORKSPACE_KEY, resolution.activeWorkspaceId);
      } else {
        safeLocalStorage.remove(WORKSPACE_KEY);
      }

      set({
        workspaceId: resolution.activeWorkspaceId,
        workspaces: resolution.workspaces,
        workspaceSelectionRequired:
          resolution.workspaces.length > 1 && resolution.activeWorkspaceId.length === 0,
        ...initialNestedState,
        workouts,
        workoutSummariesById,
        templates,
        workspaceMembers,
        coachInviteLink: '',
        analytics: null,
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
        ...initialNestedState,
        workouts: dataByWorkspace.workouts,
        workoutSummariesById: dataByWorkspace.workoutSummariesById,
        templates: dataByWorkspace.templates,
        workspaceMembers: dataByWorkspace.workspaceMembers,
        coachInviteLink: '',
        analytics: null,
      });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async loadWorkspaceMembers() {
    const workspaceId = get().workspaceId.trim();
    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const workspaceMembers = await fetchWorkspaceMembers(workspaceId);
      set({ workspaceMembers });
    } catch (innerError) {
      set({ error: formatError(innerError) });
    } finally {
      set({ loading: false });
    }
  },

  async createCoachInviteLink() {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { data, error } = await supabase.rpc('create_workspace_invite_for_coach', {
        wid: workspaceId,
        ttl_hours: 24 * 7,
      });

      if (error) {
        throw error;
      }

      if (typeof data !== 'string' || data.length === 0) {
        throw new Error('Сервер не вернул токен приглашения.');
      }

      const inviteLink = buildCoachInviteLink(data);

      const helperMessage = env.telegramBotUsername
        ? 'Ссылка готова. Отправьте её тренеру в Telegram.'
        : 'Ссылка готова. Для корректной deep link добавьте VITE_TELEGRAM_BOT_USERNAME.';

      const workspaceMembers = await fetchWorkspaceMembers(workspaceId);
      set({
        workspaceMembers,
        coachInviteLink: inviteLink,
        message: helperMessage,
      });

      return inviteLink;
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async removeWorkspaceMember(userId) {
    const workspaceId = get().workspaceId.trim();

    if (!workspaceId) {
      throw new Error('Сначала выберите пространство.');
    }

    set({ loading: true, error: null, message: null });

    try {
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const workspaceMembers = await fetchWorkspaceMembers(workspaceId);
      set({ workspaceMembers, message: 'Участник удален из пространства.' });
    } catch (innerError) {
      const message = formatError(innerError);
      set({ error: message });
      throw new Error(message);
    } finally {
      set({ loading: false });
    }
  },

  async loadAnalytics(periodDays = 56) {
    const workspaceId = get().workspaceId.trim();
    if (!workspaceId) {
      set({ error: 'Сначала выберите пространство.' });
      return;
    }

    set({ loading: true, error: null, message: null });

    try {
      const analytics = await fetchWorkspaceAnalytics(workspaceId, periodDays);
      set({ analytics });
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
      let workoutSummariesById: Record<string, string> = {};
      try {
        workoutSummariesById = await fetchWorkoutSummaries(
          workspaceId,
          workouts.map((workout) => workout.id),
        );
      } catch {
        workoutSummariesById = {};
      }

      set({ workouts, workoutSummariesById });
    } catch (innerError) {
      set({ error: formatError(innerError), workouts: [], workoutSummariesById: {} });
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
        workoutSummariesById: {
          ...state.workoutSummariesById,
          [createdWorkout.id]: 'Нет упражнений.',
        },
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
        const nextWorkoutSummariesById = { ...state.workoutSummariesById };
        delete nextWorkoutSummariesById[id];

        removedExercises.forEach((exercise) => {
          delete nextSetsByExercise[exercise.id];
          delete nextExerciseSummaryById[exercise.id];
        });

        return {
          workouts: state.workouts.filter((workout) => workout.id !== id),
          workoutSummariesById: nextWorkoutSummariesById,
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
        workoutSummariesById: {
          ...state.workoutSummariesById,
          [workoutId]: buildWorkoutSummary(exercises, nextSummaryByExerciseId),
        },
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
        const nextExercises = sortExercises([...current, createdExercise]);
        const nextExerciseSummaryById = {
          ...state.exerciseSummaryById,
          [createdExercise.id]: 'Нет подходов',
        };

        return {
          exercisesByWorkout: {
            ...state.exercisesByWorkout,
            [workoutId]: nextExercises,
          },
          exerciseSummaryById: nextExerciseSummaryById,
          workoutSummariesById: {
            ...state.workoutSummariesById,
            [workoutId]: buildWorkoutSummary(nextExercises, nextExerciseSummaryById),
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
        const nextExercises = currentExercises.filter((exercise) => exercise.id !== exerciseId);
        const nextSetsByExercise = { ...state.setsByExercise };
        const nextSummaryByExerciseId = { ...state.exerciseSummaryById };

        delete nextSetsByExercise[exerciseId];
        delete nextSummaryByExerciseId[exerciseId];

        return {
          exercisesByWorkout: {
            ...state.exercisesByWorkout,
            [workoutId]: nextExercises,
          },
          setsByExercise: nextSetsByExercise,
          exerciseSummaryById: nextSummaryByExerciseId,
          workoutSummariesById: {
            ...state.workoutSummariesById,
            [workoutId]: buildWorkoutSummary(nextExercises, nextSummaryByExerciseId),
          },
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
        workoutSummariesById: {
          ...state.workoutSummariesById,
          [workoutId]: buildWorkoutSummary(
            state.exercisesByWorkout[workoutId] ?? [],
            {
              ...state.exerciseSummaryById,
              [exerciseId]: buildExerciseSummary(sets),
            },
          ),
        },
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
        const nextExerciseSummaryById = {
          ...state.exerciseSummaryById,
          [exerciseId]: buildExerciseSummary(nextSets),
        };

        return {
          setsByExercise: {
            ...state.setsByExercise,
            [exerciseId]: nextSets,
          },
          exerciseSummaryById: nextExerciseSummaryById,
          workoutSummariesById: {
            ...state.workoutSummariesById,
            [workoutId]: buildWorkoutSummary(
              state.exercisesByWorkout[workoutId] ?? [],
              nextExerciseSummaryById,
            ),
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
        const nextExerciseSummaryById = {
          ...state.exerciseSummaryById,
          [exerciseId]: buildExerciseSummary(nextSets),
        };

        return {
          setsByExercise: {
            ...state.setsByExercise,
            [exerciseId]: nextSets,
          },
          exerciseSummaryById: nextExerciseSummaryById,
          workoutSummariesById: {
            ...state.workoutSummariesById,
            [workoutId]: buildWorkoutSummary(
              state.exercisesByWorkout[workoutId] ?? [],
              nextExerciseSummaryById,
            ),
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
          workoutSummariesById: {
            ...state.workoutSummariesById,
            [createdWorkout.id]:
              createdExercises.length > 0 ? 'Подходы не заполнены.' : 'Нет упражнений.',
          },
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
