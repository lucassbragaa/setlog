import type { AppData, ProgramExercise, ProgramTemplate, WorkoutSession } from '../types/training';

const DEFAULT_TARGET = {
  targetSets: 3,
  targetRepRange: [8, 12] as [number, number],
  targetRirRange: [1, 2] as [number, number],
  targetRestSeconds: 120,
};

function exercise(name: string): ProgramExercise {
  const exerciseId = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return { exerciseId, exerciseName: name, ...DEFAULT_TARGET };
}

function personalizedProgram(code: string, split: 'Upper' | 'Lower', exerciseNames: string[]): ProgramTemplate {
  return {
    id: `personalized-${code.toLowerCase()}`,
    name: code,
    split,
    description: `${split} · treino personalizado`,
    exercises: exerciseNames.map(exercise),
  };
}

export const defaultPrograms: ProgramTemplate[] = [
  personalizedProgram('A1', 'Upper', [
    'Remada curvada guiada', 'Puxada neutra unilateral', 'Supino inclinado', 'Crucifixo',
    'Desenvolvimento na máquina', 'Elevação lateral unilateral', 'Crucifixo invertido', 'Tríceps na polia',
  ]),
  personalizedProgram('B1', 'Lower', [
    'Hack squat', 'Leg press horizontal', 'Cadeira extensora', 'Stiff', 'Cadeira flexora',
    'Rosca Scott', 'Rosca inclinada unilateral no cabo',
  ]),
  personalizedProgram('A2', 'Upper', [
    'Remada neutra', 'Puxada pronada', 'Supino reto', 'Crucifixo no cross',
    'Desenvolvimento com pino', 'Elevação lateral', 'Crucifixo invertido', 'Tríceps na polia',
  ]),
  personalizedProgram('B2', 'Lower', [
    'Cadeira abdutora', 'Cadeira flexora', 'Leg press', 'Cadeira extensora unilateral',
    'Coice de glúteo', 'Flexora em pé', 'Cadeira adutora', 'Rosca concentrada', 'Rosca martelo',
  ]),
  personalizedProgram('A3', 'Upper', [
    'Remada supinada', 'Puxada supinada', 'Pullover', 'Supino declinado', 'Fly',
    'Elevação lateral', 'Elevação Y', 'Tríceps testa na máquina', 'Tríceps coice',
  ]),
  personalizedProgram('B3', 'Lower', [
    'Hack squat', 'Agachamento pêndulo', 'Cadeira extensora', 'Stiff', 'Mesa flexora',
    'Rosca Scott', 'Rosca inclinada unilateral',
  ]),
  personalizedProgram('A4', 'Upper', [
    'Remada supinada dupla', 'Puxada neutra unilateral', 'Supino reto', 'Fly',
    'Desenvolvimento na máquina', 'Elevação lateral na máquina', 'Face pull', 'Tríceps corda',
  ]),
  personalizedProgram('B4', 'Lower', [
    'Leg press', 'Cadeira extensora', 'Stiff', 'Flexora sentada', 'Rosca no cabo', 'Rosca martelo',
  ]),
];

export const exerciseLibrary = Array.from(
  new Map(
    defaultPrograms.flatMap(program => program.exercises).map(item => [item.exerciseId, item]),
  ).values(),
).map(item => ({
  id: item.exerciseId,
  name: item.exerciseName,
  sets: item.targetSets,
  reps: item.targetRepRange,
  rir: item.targetRirRange,
  rest: item.targetRestSeconds,
}));

export function mergeDefaultPrograms(storedPrograms: ProgramTemplate[]): ProgramTemplate[] {
  const customPrograms = storedPrograms.filter(program => program.id.startsWith('custom-'));
  return [...defaultPrograms, ...customPrograms];
}

export function sessionFromProgram(program: ProgramTemplate): WorkoutSession {
  const now = Date.now();
  return {
    id: `session-${now}`,
    name: program.name,
    startedAt: new Date(now).toISOString(),
    exercises: program.exercises.map((item, index) => ({
      ...item,
      id: `block-${now}-${index}`,
      sets: [],
    })),
  };
}

function historySession(id: string, daysAgo: number, weight: number, reps: number): WorkoutSession {
  const started = new Date(Date.now() - daysAgo * 86400000);
  return {
    id,
    name: 'A1',
    startedAt: started.toISOString(),
    endedAt: new Date(started.getTime() + 4200000).toISOString(),
    exercises: [{
      id: `${id}-bench`, exerciseId: 'supino-inclinado', exerciseName: 'Supino inclinado',
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
    activeSession: sessionFromProgram(defaultPrograms[0]),
    history: [historySession('history-1', 3, 100, 8), historySession('history-2', 10, 97.5, 8)],
    programs: defaultPrograms,
  };
}
