import { defaultExerciseTemplates, defaultRoutineFolders, defaultSettings, slugifyExerciseName } from './hevyDefaults';
import { removeLegacyGuess } from './techniques';
import type { AppData, ExerciseTemplate, ProgramExercise, ProgramTemplate, WorkoutSession } from '../types/training';

const DEFAULT_TARGET = {
  targetSets: 0,
  targetRepRange: [0, 0] as [number, number],
  targetRirRange: [0, 0] as [number, number],
  setPrescriptions: [],
  targetRestSeconds: defaultSettings.defaultRestSeconds,
};

function exercise(name: string): ProgramExercise {
  const exerciseId = slugifyExerciseName(name);
  return { exerciseId, exerciseTemplateId: exerciseId, exerciseName: name, ...DEFAULT_TARGET };
}

function personalizedProgram(code: string, split: 'Upper' | 'Lower', exerciseNames: string[], order: number): ProgramTemplate {
  return {
    id: `personalized-${code.toLowerCase()}`,
    name: code,
    split,
    folderId: 'folder-personalized-ab',
    order,
    description: `${split} - treino personalizado`,
    exercises: exerciseNames.map(exercise),
  };
}

export const defaultPrograms: ProgramTemplate[] = [
  personalizedProgram('A1', 'Upper', [
    'Remada curvada guiada', 'Puxada neutra unilateral', 'Supino inclinado', 'Crucifixo',
    'Desenvolvimento na maquina', 'Elevacao lateral unilateral', 'Crucifixo invertido', 'Triceps na polia',
  ], 1),
  personalizedProgram('B1', 'Lower', [
    'Hack squat', 'Leg press horizontal', 'Cadeira extensora', 'Stiff', 'Cadeira flexora',
    'Rosca Scott', 'Rosca inclinada unilateral no cabo',
  ], 2),
  personalizedProgram('A2', 'Upper', [
    'Remada neutra', 'Puxada pronada', 'Supino reto', 'Crucifixo no cross',
    'Desenvolvimento com pino', 'Elevacao lateral', 'Crucifixo invertido', 'Triceps na polia',
  ], 3),
  personalizedProgram('B2', 'Lower', [
    'Cadeira abdutora', 'Cadeira flexora', 'Leg press', 'Cadeira extensora unilateral',
    'Coice de gluteo', 'Flexora em pe', 'Cadeira adutora', 'Rosca concentrada', 'Rosca martelo',
  ], 4),
  personalizedProgram('A3', 'Upper', [
    'Remada supinada', 'Puxada supinada', 'Pullover', 'Supino declinado', 'Fly',
    'Elevacao lateral', 'Elevacao Y', 'Triceps testa na maquina', 'Triceps coice',
  ], 5),
  personalizedProgram('B3', 'Lower', [
    'Hack squat', 'Agachamento pendulo', 'Cadeira extensora', 'Stiff', 'Mesa flexora',
    'Rosca Scott', 'Rosca inclinada unilateral',
  ], 6),
  personalizedProgram('A4', 'Upper', [
    'Remada supinada dupla', 'Puxada neutra unilateral', 'Supino reto', 'Fly',
    'Desenvolvimento na maquina', 'Elevacao lateral na maquina', 'Face pull', 'Triceps corda',
  ], 7),
  personalizedProgram('B4', 'Lower', [
    'Leg press', 'Cadeira extensora', 'Stiff', 'Flexora sentada', 'Rosca no cabo', 'Rosca martelo',
  ], 8),
];

export const exerciseLibrary = defaultExerciseTemplates.map(item => ({
  id: item.id,
  name: item.name,
  sets: 0,
  reps: [0, 0] as [number, number],
  rir: [0, 0] as [number, number],
  rest: defaultSettings.defaultRestSeconds,
  template: item,
}));

export function mergeExerciseTemplates(storedTemplates?: ExerciseTemplate[]): ExerciseTemplate[] {
  const map = new Map(defaultExerciseTemplates.map(item => [item.id, item]));
  (storedTemplates ?? []).forEach(item => {
    map.set(item.id, { ...map.get(item.id), ...item });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function mergeRoutineFolders(storedFolders = defaultRoutineFolders) {
  const map = new Map(defaultRoutineFolders.map(item => [item.id, item]));
  storedFolders.forEach(item => map.set(item.id, { ...map.get(item.id), ...item }));
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

export function mergeDefaultPrograms(storedPrograms: ProgramTemplate[]): ProgramTemplate[] {
  const customPrograms = storedPrograms.filter(program => program.id.startsWith('custom-'));
  const personalizedPrograms = defaultPrograms.map(program => {
    const stored = storedPrograms.find(item => item.id === program.id);
    return stored
      ? { ...program, ...stored, folderId: stored.folderId ?? program.folderId, order: stored.order ?? program.order, exercises: stored.exercises.map(removeLegacyGuess) }
      : program;
  });
  return [
    ...personalizedPrograms,
    ...customPrograms.map((program, index) => ({
      ...program,
      folderId: program.folderId ?? 'folder-custom',
      order: program.order ?? personalizedPrograms.length + index + 1,
      exercises: program.exercises.map(removeLegacyGuess),
    })),
  ];
}

export function sessionFromProgram(program: ProgramTemplate, cycleNumber?: number): WorkoutSession {
  const now = Date.now();
  return {
    id: `session-${now}`,
    name: program.name,
    programId: program.id,
    cycleNumber,
    startedAt: new Date(now).toISOString(),
    visibility: 'private',
    exercises: program.exercises.map((item, index) => ({
      ...item,
      id: `block-${now}-${index}`,
      exerciseTemplateId: item.exerciseTemplateId ?? item.exerciseId,
      sets: [],
    })),
  };
}

function historySession(id: string, daysAgo: number, weight: number, reps: number): WorkoutSession {
  const started = new Date(Date.now() - daysAgo * 86400000);
  return {
    id,
    name: 'A1',
    programId: 'personalized-a1',
    startedAt: started.toISOString(),
    endedAt: new Date(started.getTime() + 4200000).toISOString(),
    visibility: 'private',
    exercises: [{
      id: `${id}-bench`, exerciseId: 'supino-inclinado', exerciseTemplateId: 'supino-inclinado', exerciseName: 'Supino inclinado',
      targetSets: 3, targetRepRange: [8, 12], targetRirRange: [1, 2], targetRestSeconds: 120,
      sets: [0, 1, 2].map(index => ({
        id: `${id}-set-${index}`, order: index + 1, type: 'working' as const, loadKg: weight,
        repetitions: Math.max(1, reps - index), rir: Math.max(0, 2 - index), completedAt: started.toISOString(),
        rangeOfMotion: 'full' as const, techniqueQuality: 4 as const,
      })),
    }],
  };
}

export function createDefaultData(): AppData {
  return {
    schema: { version: 3 },
    activeSession: sessionFromProgram(defaultPrograms[0]),
    history: [historySession('history-1', 3, 100, 8), historySession('history-2', 10, 97.5, 8)],
    programs: defaultPrograms,
    routineFolders: defaultRoutineFolders,
    exerciseTemplates: defaultExerciseTemplates,
    measurements: [],
    settings: defaultSettings,
  };
}
