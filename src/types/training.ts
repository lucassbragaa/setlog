export type SetType =
  | 'warmup'
  | 'approach'
  | 'working'
  | 'topSet'
  | 'backoff'
  | 'drop'
  | 'restPause'
  | 'myoRep'
  | 'muscleRound'
  | 'widowmaker'
  | 'breathingCluster';

export type RangeOfMotion = 'full' | 'lengthenedPartial' | 'shortenedPartial' | 'custom';

export interface Tempo {
  eccentricSeconds?: number;
  bottomPauseSeconds?: number;
  concentricSeconds?: number;
  topPauseSeconds?: number;
}

export interface SetPrescription {
  technique: SetType;
  repRange: [number, number];
  rirRange: [number, number];
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

export interface ProgramExercise {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetRepRange: [number, number];
  targetRirRange: [number, number];
  targetRestSeconds: number;
  setPrescriptions?: SetPrescription[];
  notes?: string;
}

export interface ExerciseBlock extends ProgramExercise {
  id: string;
  sets: LoggedSet[];
}

export interface WorkoutSession {
  id: string;
  name: string;
  startedAt: string;
  endedAt?: string;
  programId?: string;
  cycleNumber?: number;
  exercises: ExerciseBlock[];
}

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  split?: 'Upper' | 'Lower';
  exercises: ProgramExercise[];
}

export interface AppData {
  activeSession: WorkoutSession;
  history: WorkoutSession[];
  programs: ProgramTemplate[];
}
