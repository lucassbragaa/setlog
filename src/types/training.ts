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

export interface TechniqueConfig {
  /** Total de blocos, contando o bloco inicial. */
  blocks?: number;
  /** Meta de reps dos blocos depois do primeiro. */
  secondaryRepRange?: [number, number];
  /** Pausa curta dentro do mesmo set. */
  intraSetRestSeconds?: number;
  /** Redução de carga entre quedas. */
  loadDropPercent?: number;
  /** Respirações profundas entre blocos, quando esse é o marcador usado. */
  breathsBetweenBlocks?: number;
}

export interface SetPrescription {
  technique: SetType;
  repRange: [number, number];
  rirRange: [number, number];
  techniqueConfig?: TechniqueConfig;
}

export interface LoggedTechniqueDetails {
  /** Reps reais do bloco inicial e dos blocos subsequentes. */
  segmentRepetitions: number[];
  intraSetRestSeconds?: number;
  loadDropPercent?: number;
  breathsBetweenBlocks?: number;
  durationSeconds?: number;
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
  techniqueDetails?: LoggedTechniqueDetails;
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

export type Timeframe = '1m' | '3m' | '6m' | '1y' | 'all';

export interface ExercisePR {
  exerciseKey: string;
  exerciseName: string;
  bestE1rm: number;
  bestWeight: number;
  bestVolume: number;
  achievedAt: string;
}

export interface SeriesPoint {
  date: string;
  value: number;
  label: string;
}

export interface CalendarDay {
  date: string;
  hasWorkout: boolean;
  sessionCount: number;
  totalVolume: number;
}

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string | null;
}

export interface WeeklyVolumeSummary {
  weekStart: string;
  weekLabel: string;
  totalVolume: number;
  sessionCount: number;
  setCount: number;
}
