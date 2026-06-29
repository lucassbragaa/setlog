export type SetType =
  | 'warmup'
  | 'approach'
  | 'working'
  | 'failure'
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

export interface PreviousSetSnapshot {
  source: 'any-workout' | 'same-routine';
  workoutId: string;
  workoutName: string;
  completedAt: string;
  loadKg?: number;
  repetitions?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rir?: number;
  rpe?: number;
}

export interface LoggedSet {
  id: string;
  order: number;
  type: SetType;
  loadKg: number;
  repetitions: number;
  durationSeconds?: number;
  distanceMeters?: number;
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
  previous?: PreviousSetSnapshot;
  techniqueDetails?: LoggedTechniqueDetails;
}

export interface ProgramExercise {
  exerciseId: string;
  exerciseTemplateId?: string;
  exerciseName: string;
  targetSets: number;
  targetRepRange: [number, number];
  targetRirRange: [number, number];
  targetRestSeconds: number;
  setPrescriptions?: SetPrescription[];
  notes?: string;
  supersetGroupId?: string;
  routineNote?: string;
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
  notes?: string;
  perceivedEffort?: 1 | 2 | 3 | 4 | 5;
  visibility?: 'private' | 'public' | 'followers';
}


export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  split?: 'Upper' | 'Lower';
  folderId?: string;
  order?: number;
  exercises: ProgramExercise[];
}



export type MuscleGroup =
  | 'neck'
  | 'traps'
  | 'shoulders'
  | 'chest'
  | 'upper-back'
  | 'lats'
  | 'lower-back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'cardio'
  | 'full-body';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'smith-machine'
  | 'bodyweight'
  | 'assisted-bodyweight'
  | 'band'
  | 'kettlebell'
  | 'cardio-machine'
  | 'other';

export type ExerciseKind =
  | 'weight-reps'
  | 'bodyweight-reps'
  | 'assisted-bodyweight'
  | 'weighted-bodyweight'
  | 'duration'
  | 'distance-duration';

export interface ExerciseTemplate {
  id: string;
  name: string;
  kind: ExerciseKind;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  equipment: EquipmentType;
  instructions?: string[];
  aliases?: string[];
  isCustom?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoutineFolder {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt?: string;
}

export type PreviousValuesMode = 'any-workout' | 'same-routine';
export type UnitSystem = 'metric' | 'imperial';
export type WeekStart = 'monday' | 'sunday';

export interface PlateInventoryItem {
  weightKg: number;
  count: number;
}

export interface GitHubSyncSettings {
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  lastSyncedAt?: string;
  lastSha?: string;
  lastStatus?: string;
}

export interface AppSettings {
  unitSystem: UnitSystem;
  weekStart: WeekStart;
  previousValuesMode: PreviousValuesMode;
  showRpe: boolean;
  defaultRestSeconds: number;
  barWeightKg: number;
  plateInventory: PlateInventoryItem[];
  githubSync: GitHubSyncSettings;
  theme: 'black-white';
}

export type BodyMeasurementKey =
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'leftArm'
  | 'rightArm'
  | 'waist'
  | 'hips'
  | 'leftThigh'
  | 'rightThigh'
  | 'leftCalf'
  | 'rightCalf';

export interface BodyMeasurementEntry {
  id: string;
  measuredAt: string;
  bodyWeightKg?: number;
  bodyFatPercent?: number;
  circumferencesCm?: Partial<Record<BodyMeasurementKey, number>>;
  photoDataUrl?: string;
  notes?: string;
}

export interface AppSchemaMeta {
  version: 3;
  migratedAt?: string;
  sourceVersion?: number;
}

export interface AppData {
  schema: AppSchemaMeta;
  activeSession: WorkoutSession;
  history: WorkoutSession[];
  programs: ProgramTemplate[];
  routineFolders: RoutineFolder[];
  exerciseTemplates: ExerciseTemplate[];
  measurements: BodyMeasurementEntry[];
  settings: AppSettings;
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
