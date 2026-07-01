export type SetType = 'normal' | 'warmup' | 'failure' | 'dropset';

export type ExerciseType =
  | 'weight_reps'
  | 'reps_only'
  | 'bodyweight_reps'
  | 'bodyweight_assisted_reps'
  | 'duration'
  | 'weight_duration'
  | 'distance_duration'
  | 'short_distance_weight';

export type MuscleGroup =
  | 'abdominals'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quadriceps'
  | 'hamstrings'
  | 'calves'
  | 'glutes'
  | 'abductors'
  | 'adductors'
  | 'lats'
  | 'upper_back'
  | 'traps'
  | 'lower_back'
  | 'chest'
  | 'cardio'
  | 'neck'
  | 'full_body'
  | 'other';

export type EquipmentCategory =
  | 'none'
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'machine'
  | 'plate'
  | 'resistance_band'
  | 'suspension'
  | 'cable'
  | 'smith_machine'
  | 'other';

export interface ExerciseTemplate {
  id: string;
  title: string;
  type: ExerciseType;
  primary_muscle_group: MuscleGroup;
  secondary_muscle_groups: MuscleGroup[];
  equipment: EquipmentCategory;
  is_custom: boolean;
  instructions: string[];
  aliases: string[];
  created_at: string;
  updated_at: string;
}

export interface TrainingSet {
  id: string;
  index: number;
  type: SetType;
  weight_kg: number | null;
  reps: number | null;
  distance_meters: number | null;
  duration_seconds: number | null;
  custom_metric: number | null;
  rpe: number | null;
  completed_at?: string;
}

export interface RoutineExercise {
  id: string;
  index: number;
  exercise_template_id: string;
  title: string;
  superset_id: number | null;
  rest_seconds: number | null;
  notes: string;
  sets: TrainingSet[];
}

export interface RoutineFolder {
  id: number;
  index: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Routine {
  id: string;
  title: string;
  folder_id: number | null;
  created_at: string;
  updated_at: string;
  exercises: RoutineExercise[];
}

export interface WorkoutExercise extends RoutineExercise {}

export interface Workout {
  id: string;
  title: string;
  routine_id: string | null;
  description: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
  updated_at: string;
  exercises: WorkoutExercise[];
}

export interface BodyMeasurement {
  date: string;
  weight_kg: number | null;
  lean_mass_kg: number | null;
  fat_percent: number | null;
  neck_cm: number | null;
  shoulder_cm: number | null;
  chest_cm: number | null;
  left_bicep_cm: number | null;
  right_bicep_cm: number | null;
  left_forearm_cm: number | null;
  right_forearm_cm: number | null;
  abdomen: number | null;
  waist: number | null;
  hips: number | null;
  left_thigh: number | null;
  right_thigh: number | null;
  left_calf: number | null;
  right_calf: number | null;
  photo_uri: string | null;
}

export interface AppSettings {
  unit: 'kg' | 'lb';
  previous_values_mode: 'any_workout' | 'same_routine';
  default_rest_seconds: number;
  rpe_enabled: boolean;
  plate_calculator_enabled: boolean;
  warmup_calculator_enabled: boolean;
  bar_weight_kg: number;
  available_plates_kg: number[];
}

export interface AppData {
  schema_version: 1;
  routines: Routine[];
  routine_folders: RoutineFolder[];
  exercise_templates: ExerciseTemplate[];
  workouts: Workout[];
  active_workout: Workout | null;
  body_measurements: BodyMeasurement[];
  settings: AppSettings;
}
