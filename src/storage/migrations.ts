import { defaultRoutineFolders, defaultSettings, slugifyExerciseName } from '../data/hevyDefaults';
import { mergeDefaultPrograms, mergeExerciseTemplates, mergeRoutineFolders } from '../data/appDefaults';
import type { AppData, ExerciseBlock, ProgramExercise, ProgramTemplate, WorkoutSession } from '../types/training';

type LegacyAppData = Partial<AppData> & {
  activeSession?: WorkoutSession;
  history?: WorkoutSession[];
  programs?: ProgramTemplate[];
};

function normalizeExercise<T extends ProgramExercise | ExerciseBlock>(exercise: T): T {
  const exerciseId = exercise.exerciseId || slugifyExerciseName(exercise.exerciseName);
  return {
    ...exercise,
    exerciseId,
    exerciseTemplateId: exercise.exerciseTemplateId ?? exerciseId,
    targetSets: exercise.targetSets ?? 0,
    targetRepRange: exercise.targetRepRange ?? [0, 0],
    targetRirRange: exercise.targetRirRange ?? [0, 0],
    targetRestSeconds: exercise.targetRestSeconds ?? defaultSettings.defaultRestSeconds,
    setPrescriptions: exercise.setPrescriptions ?? [],
  };
}

function normalizeSession(session: WorkoutSession): WorkoutSession {
  return {
    ...session,
    visibility: session.visibility ?? 'private',
    exercises: session.exercises.map(exercise => ({
      ...normalizeExercise(exercise),
      sets: exercise.sets.map((set, index) => ({
        ...set,
        order: set.order ?? index + 1,
        type: set.type ?? 'working',
        loadKg: set.loadKg ?? 0,
        repetitions: set.repetitions ?? 0,
        completedAt: set.completedAt ?? session.startedAt,
      })),
    })),
  };
}

function normalizeProgram(program: ProgramTemplate, index: number): ProgramTemplate {
  return {
    ...program,
    folderId: program.folderId ?? (program.id.startsWith('custom-') ? 'folder-custom' : 'folder-personalized-ab'),
    order: program.order ?? index + 1,
    exercises: program.exercises.map(normalizeExercise),
  };
}

export function upgradeAppData(input: LegacyAppData): AppData | null {
  if (!input.activeSession || !Array.isArray(input.history) || !Array.isArray(input.programs)) return null;
  const programs = mergeDefaultPrograms(input.programs.map(normalizeProgram));
  return {
    schema: {
      version: 3,
      sourceVersion: input.schema?.version ?? 2,
      migratedAt: input.schema?.version === 3 ? input.schema.migratedAt : new Date().toISOString(),
    },
    activeSession: normalizeSession(input.activeSession),
    history: input.history.map(normalizeSession),
    programs,
    routineFolders: mergeRoutineFolders(input.routineFolders ?? defaultRoutineFolders),
    exerciseTemplates: mergeExerciseTemplates(input.exerciseTemplates),
    measurements: input.measurements ?? [],
    settings: { ...defaultSettings, ...input.settings, theme: 'black-white' },
  };
}

export function isUpgradeableAppData(value: unknown): value is LegacyAppData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as LegacyAppData;
  return Boolean(candidate.activeSession)
    && Array.isArray(candidate.history)
    && Array.isArray(candidate.programs);
}
