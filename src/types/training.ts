export type SetType =
  | 'warmup'
  | 'approach'
  | 'working'
  | 'backoff'
  | 'drop'
  | 'restPause'
  | 'myoRep';

export type RangeOfMotion = 'full' | 'lengthenedPartial' | 'shortenedPartial' | 'custom';

export interface Tempo {
  eccentricSeconds?: number;
  bottomPauseSeconds?: number;
  concentricSeconds?: number;
  topPauseSeconds?: number;
}

export interface LoggedSet {
  id: string;
  order: number;
  type: SetType;
  loadKg: number;
  repetitions: number;
  rir?: number;
  rpe?: number;
  completedAt: string;
  restBeforeSeconds?: number;
  rangeOfMotion?: RangeOfMotion;
  tempo?: Tempo;
  techniqueQuality?: 1 | 2 | 3 | 4 | 5;
  assistedRepetitions?: number;
  partialRepetitions?: number;
  painScore?: number;
  notes?: string;
}

export interface ExerciseBlock {
  id: string;
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetRepRange: [number, number];
  targetRirRange: [number, number];
  targetRestSeconds: number;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  startedAt: string;
  exercises: ExerciseBlock[];
}
