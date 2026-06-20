import type { AppData, ProgramTemplate, WorkoutSession } from '../types/training';

export const exerciseLibrary = [
  { id: 'barbell-bench-press', name: 'Supino reto com barra', sets: 4, reps: [6, 8] as [number, number], rir: [1, 2] as [number, number], rest: 180 },
  { id: 'incline-dumbbell-press', name: 'Supino inclinado com halteres', sets: 3, reps: [8, 12] as [number, number], rir: [1, 2] as [number, number], rest: 150 },
  { id: 'cable-fly', name: 'Crucifixo na polia', sets: 3, reps: [10, 15] as [number, number], rir: [1, 2] as [number, number], rest: 90 },
  { id: 'lat-pulldown', name: 'Puxada alta', sets: 4, reps: [6, 10] as [number, number], rir: [1, 2] as [number, number], rest: 150 },
  { id: 'barbell-row', name: 'Remada curvada', sets: 3, reps: [6, 10] as [number, number], rir: [1, 2] as [number, number], rest: 180 },
  { id: 'squat', name: 'Agachamento livre', sets: 4, reps: [5, 8] as [number, number], rir: [1, 3] as [number, number], rest: 240 },
  { id: 'leg-press', name: 'Leg press', sets: 3, reps: [8, 12] as [number, number], rir: [1, 2] as [number, number], rest: 180 },
  { id: 'romanian-deadlift', name: 'Levantamento romeno', sets: 3, reps: [6, 10] as [number, number], rir: [1, 2] as [number, number], rest: 180 },
];

export const defaultPrograms: ProgramTemplate[] = [
  {
    id: 'push-a', name: 'Push A', description: 'Peito, deltoides e tríceps',
    exercises: exerciseLibrary.slice(0, 3).map(item => ({ exerciseId: item.id, exerciseName: item.name, targetSets: item.sets, targetRepRange: item.reps, targetRirRange: item.rir, targetRestSeconds: item.rest })),
  },
  {
    id: 'pull-a', name: 'Pull A', description: 'Costas e bíceps',
    exercises: exerciseLibrary.slice(3, 5).map(item => ({ exerciseId: item.id, exerciseName: item.name, targetSets: item.sets, targetRepRange: item.reps, targetRirRange: item.rir, targetRestSeconds: item.rest })),
  },
  {
    id: 'legs-a', name: 'Legs A', description: 'Quadríceps, glúteos e posteriores',
    exercises: exerciseLibrary.slice(5).map(item => ({ exerciseId: item.id, exerciseName: item.name, targetSets: item.sets, targetRepRange: item.reps, targetRirRange: item.rir, targetRestSeconds: item.rest })),
  },
];

export function sessionFromProgram(program: ProgramTemplate): WorkoutSession {
  const now = Date.now();
  return {
    id: `session-${now}`,
    name: program.name,
    startedAt: new Date(now).toISOString(),
    exercises: program.exercises.map((exercise, index) => ({
      ...exercise,
      id: `block-${now}-${index}`,
      sets: [],
    })),
  };
}

function historySession(id: string, daysAgo: number, weight: number, reps: number): WorkoutSession {
  const started = new Date(Date.now() - daysAgo * 86400000);
  return {
    id,
    name: 'Push A',
    startedAt: started.toISOString(),
    endedAt: new Date(started.getTime() + 4200000).toISOString(),
    exercises: [{
      id: `${id}-bench`, exerciseId: 'barbell-bench-press', exerciseName: 'Supino reto com barra',
      targetSets: 4, targetRepRange: [6, 8], targetRirRange: [1, 2], targetRestSeconds: 180,
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
