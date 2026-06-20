import type { WorkoutSession } from '../types/training';

export const demoSession: WorkoutSession = {
  id: 'session-demo',
  name: 'Push A',
  startedAt: new Date().toISOString(),
  exercises: [
    {
      id: 'block-bench',
      exerciseId: 'barbell-bench-press',
      exerciseName: 'Supino reto com barra',
      targetSets: 4,
      targetRepRange: [6, 8],
      targetRirRange: [1, 2],
      targetRestSeconds: 180,
      sets: [
        {
          id: 'set-1', order: 1, type: 'working', loadKg: 100, repetitions: 8,
          rir: 2, completedAt: new Date().toISOString(), rangeOfMotion: 'full', techniqueQuality: 5,
        },
        {
          id: 'set-2', order: 2, type: 'working', loadKg: 100, repetitions: 7,
          rir: 1, completedAt: new Date().toISOString(), restBeforeSeconds: 182,
          rangeOfMotion: 'full', techniqueQuality: 4,
        },
      ],
    },
  ],
};
