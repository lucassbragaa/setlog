import {
  AppData,
  AppSettings,
  EquipmentCategory,
  ExerciseTemplate,
  ExerciseType,
  MuscleGroup,
  Routine,
  RoutineExercise,
  RoutineFolder,
  SetType,
  TrainingSet,
  Workout,
} from './types';

const nowIso = () => new Date().toISOString();

export const muscleLabels: Record<MuscleGroup, string> = {
  abdominals: 'Abdômen',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  quadriceps: 'Quadríceps',
  hamstrings: 'Posteriores',
  calves: 'Panturrilhas',
  glutes: 'Glúteos',
  abductors: 'Abdutores',
  adductors: 'Adutores',
  lats: 'Dorsais',
  upper_back: 'Costas altas',
  traps: 'Trapézio',
  lower_back: 'Lombar',
  chest: 'Peito',
  cardio: 'Cardio',
  neck: 'Pescoço',
  full_body: 'Corpo todo',
  other: 'Outro',
};

export const equipmentLabels: Record<EquipmentCategory, string> = {
  none: 'Livre',
  barbell: 'Barra',
  dumbbell: 'Halter',
  kettlebell: 'Kettlebell',
  machine: 'Máquina',
  plate: 'Anilha',
  resistance_band: 'Elástico',
  suspension: 'Suspensão',
  cable: 'Cabo',
  smith_machine: 'Smith',
  other: 'Outro',
};

export const setTypeLabels: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Aquec.',
  failure: 'Falha',
  dropset: 'Drop',
};

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  weight_reps: 'Carga + reps',
  reps_only: 'Reps',
  bodyweight_reps: 'Peso corporal',
  bodyweight_assisted_reps: 'Assistido',
  duration: 'Tempo',
  weight_duration: 'Carga + tempo',
  distance_duration: 'Distância + tempo',
  short_distance_weight: 'Distância + carga',
};

const template = (
  id: string,
  title: string,
  primary_muscle_group: MuscleGroup,
  equipment: EquipmentCategory,
  secondary_muscle_groups: MuscleGroup[] = [],
  type: ExerciseType = 'weight_reps',
  aliases: string[] = [],
): ExerciseTemplate => ({
  id,
  title,
  type,
  primary_muscle_group,
  secondary_muscle_groups,
  equipment,
  is_custom: false,
  instructions: [
    'Configure o setup, faça a execução com controle e registre carga, reps e esforço.',
    'Use as notas do exercício para detalhes individuais de técnica, amplitude e setup.',
  ],
  aliases,
  created_at: nowIso(),
  updated_at: nowIso(),
});

export const seedExerciseTemplates: ExerciseTemplate[] = [
  template('bench-press-barbell', 'Supino reto com barra', 'chest', 'barbell', ['triceps', 'shoulders'], 'weight_reps', ['bench press']),
  template('incline-bench-press-barbell', 'Supino inclinado com barra', 'chest', 'barbell', ['shoulders', 'triceps']),
  template('incline-dumbbell-press', 'Supino inclinado com halteres', 'chest', 'dumbbell', ['shoulders', 'triceps']),
  template('decline-bench-press', 'Supino declinado', 'chest', 'barbell', ['triceps']),
  template('machine-chest-press', 'Chest press máquina', 'chest', 'machine', ['triceps', 'shoulders']),
  template('pec-deck', 'Crucifixo máquina / Pec deck', 'chest', 'machine'),
  template('cable-fly', 'Crucifixo no cabo', 'chest', 'cable'),
  template('dumbbell-fly', 'Crucifixo com halteres', 'chest', 'dumbbell'),
  template('push-up', 'Flexão de braços', 'chest', 'none', ['triceps', 'shoulders'], 'bodyweight_reps'),
  template('lat-pulldown', 'Puxada alta pronada', 'lats', 'cable', ['biceps', 'upper_back']),
  template('neutral-grip-pulldown', 'Puxada neutra', 'lats', 'cable', ['biceps']),
  template('single-arm-lat-pulldown', 'Puxada unilateral', 'lats', 'cable', ['biceps']),
  template('pull-up', 'Barra fixa', 'lats', 'none', ['biceps', 'upper_back'], 'bodyweight_reps'),
  template('assisted-pull-up', 'Barra fixa assistida', 'lats', 'machine', ['biceps'], 'bodyweight_assisted_reps'),
  template('seated-cable-row', 'Remada baixa no cabo', 'upper_back', 'cable', ['lats', 'biceps']),
  template('chest-supported-row', 'Remada apoiada', 'upper_back', 'machine', ['lats', 'biceps']),
  template('bent-over-row', 'Remada curvada com barra', 'upper_back', 'barbell', ['lats', 'lower_back', 'biceps']),
  template('single-arm-dumbbell-row', 'Remada unilateral com halter', 'lats', 'dumbbell', ['upper_back', 'biceps']),
  template('t-bar-row', 'Remada T-bar', 'upper_back', 'machine', ['lats', 'biceps']),
  template('face-pull', 'Face pull', 'traps', 'cable', ['shoulders', 'upper_back']),
  template('rear-delt-fly', 'Crucifixo inverso', 'shoulders', 'machine', ['traps']),
  template('overhead-press', 'Desenvolvimento com barra', 'shoulders', 'barbell', ['triceps']),
  template('dumbbell-shoulder-press', 'Desenvolvimento com halteres', 'shoulders', 'dumbbell', ['triceps']),
  template('machine-shoulder-press', 'Desenvolvimento máquina', 'shoulders', 'machine', ['triceps']),
  template('lateral-raise', 'Elevação lateral', 'shoulders', 'dumbbell'),
  template('cable-lateral-raise', 'Elevação lateral no cabo', 'shoulders', 'cable'),
  template('front-raise', 'Elevação frontal', 'shoulders', 'dumbbell'),
  template('upright-row', 'Remada alta', 'shoulders', 'barbell', ['traps']),
  template('barbell-curl', 'Rosca direta com barra', 'biceps', 'barbell', ['forearms']),
  template('dumbbell-curl', 'Rosca alternada', 'biceps', 'dumbbell', ['forearms']),
  template('incline-dumbbell-curl', 'Rosca inclinada com halteres', 'biceps', 'dumbbell'),
  template('preacher-curl', 'Rosca Scott', 'biceps', 'machine'),
  template('cable-curl', 'Rosca no cabo', 'biceps', 'cable'),
  template('hammer-curl', 'Rosca martelo', 'biceps', 'dumbbell', ['forearms']),
  template('triceps-pushdown', 'Tríceps polia', 'triceps', 'cable'),
  template('rope-pushdown', 'Tríceps corda', 'triceps', 'cable'),
  template('overhead-cable-extension', 'Tríceps acima da cabeça no cabo', 'triceps', 'cable'),
  template('skull-crusher', 'Tríceps testa', 'triceps', 'barbell'),
  template('dip', 'Paralelas', 'triceps', 'none', ['chest', 'shoulders'], 'bodyweight_reps'),
  template('back-squat', 'Agachamento livre', 'quadriceps', 'barbell', ['glutes', 'hamstrings']),
  template('front-squat', 'Agachamento frontal', 'quadriceps', 'barbell', ['glutes']),
  template('hack-squat', 'Hack squat', 'quadriceps', 'machine', ['glutes']),
  template('leg-press', 'Leg press', 'quadriceps', 'machine', ['glutes', 'hamstrings']),
  template('leg-extension', 'Cadeira extensora', 'quadriceps', 'machine'),
  template('bulgarian-split-squat', 'Agachamento búlgaro', 'quadriceps', 'dumbbell', ['glutes']),
  template('lunge', 'Avanço / passada', 'quadriceps', 'dumbbell', ['glutes']),
  template('romanian-deadlift', 'Stiff / levantamento romeno', 'hamstrings', 'barbell', ['glutes', 'lower_back']),
  template('deadlift', 'Levantamento terra', 'lower_back', 'barbell', ['glutes', 'hamstrings', 'traps']),
  template('seated-leg-curl', 'Mesa flexora', 'hamstrings', 'machine'),
  template('lying-leg-curl', 'Cadeira flexora deitada', 'hamstrings', 'machine'),
  template('standing-leg-curl', 'Flexora em pé', 'hamstrings', 'machine'),
  template('hip-thrust', 'Hip thrust', 'glutes', 'barbell', ['hamstrings']),
  template('glute-kickback', 'Glúteo coice', 'glutes', 'cable'),
  template('hip-abduction', 'Abdutora', 'abductors', 'machine', ['glutes']),
  template('hip-adduction', 'Adutora', 'adductors', 'machine'),
  template('standing-calf-raise', 'Panturrilha em pé', 'calves', 'machine'),
  template('seated-calf-raise', 'Panturrilha sentado', 'calves', 'machine'),
  template('cable-crunch', 'Abdominal no cabo', 'abdominals', 'cable'),
  template('plank', 'Prancha', 'abdominals', 'none', [], 'duration'),
  template('hanging-leg-raise', 'Elevação de pernas suspenso', 'abdominals', 'none', [], 'bodyweight_reps'),
  template('treadmill-run', 'Esteira', 'cardio', 'machine', [], 'distance_duration'),
  template('bike', 'Bicicleta ergométrica', 'cardio', 'machine', [], 'distance_duration'),
];

const blankSet = (id: string, index: number, type: SetType = 'normal'): TrainingSet => ({
  id,
  index,
  type,
  weight_kg: null,
  reps: null,
  distance_meters: null,
  duration_seconds: null,
  custom_metric: null,
  rpe: null,
});

const routineExercise = (
  id: string,
  index: number,
  exercise_template_id: string,
  title: string,
  setCount = 3,
  rest_seconds = 120,
): RoutineExercise => ({
  id,
  index,
  exercise_template_id,
  title,
  superset_id: null,
  rest_seconds,
  notes: '',
  sets: Array.from({ length: setCount }, (_, setIndex) => blankSet(`${id}-set-${setIndex + 1}`, setIndex + 1)),
});

const routine = (id: string, title: string, exercises: RoutineExercise[]): Routine => ({
  id,
  title,
  folder_id: 1,
  created_at: nowIso(),
  updated_at: nowIso(),
  exercises,
});

export const seedRoutineFolders: RoutineFolder[] = [
  {
    id: 1,
    index: 1,
    title: 'My Routines',
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

export const seedRoutines: Routine[] = [
  routine('routine-push', 'Push Day', [
    routineExercise('push-1', 1, 'bench-press-barbell', 'Supino reto com barra', 4),
    routineExercise('push-2', 2, 'incline-dumbbell-press', 'Supino inclinado com halteres', 3),
    routineExercise('push-3', 3, 'machine-shoulder-press', 'Desenvolvimento máquina', 3),
    routineExercise('push-4', 4, 'cable-lateral-raise', 'Elevação lateral no cabo', 4, 75),
    routineExercise('push-5', 5, 'triceps-pushdown', 'Tríceps polia', 3, 75),
  ]),
  routine('routine-pull', 'Pull Day', [
    routineExercise('pull-1', 1, 'lat-pulldown', 'Puxada alta pronada', 4),
    routineExercise('pull-2', 2, 'chest-supported-row', 'Remada apoiada', 3),
    routineExercise('pull-3', 3, 'rear-delt-fly', 'Crucifixo inverso', 3, 75),
    routineExercise('pull-4', 4, 'incline-dumbbell-curl', 'Rosca inclinada com halteres', 3, 75),
    routineExercise('pull-5', 5, 'hammer-curl', 'Rosca martelo', 3, 75),
  ]),
  routine('routine-legs', 'Leg Day', [
    routineExercise('legs-1', 1, 'hack-squat', 'Hack squat', 4),
    routineExercise('legs-2', 2, 'leg-press', 'Leg press', 3),
    routineExercise('legs-3', 3, 'romanian-deadlift', 'Stiff / levantamento romeno', 3),
    routineExercise('legs-4', 4, 'leg-extension', 'Cadeira extensora', 3, 75),
    routineExercise('legs-5', 5, 'seated-leg-curl', 'Mesa flexora', 3, 75),
    routineExercise('legs-6', 6, 'standing-calf-raise', 'Panturrilha em pé', 4, 60),
  ]),
];

export const defaultSettings: AppSettings = {
  unit: 'kg',
  previous_values_mode: 'any_workout',
  default_rest_seconds: 120,
  rpe_enabled: true,
  plate_calculator_enabled: true,
  warmup_calculator_enabled: true,
  bar_weight_kg: 20,
  available_plates_kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

export const cloneRoutineToWorkout = (routineToClone: Routine): Workout => {
  const timestamp = nowIso();

  return {
    id: `workout-${Date.now()}`,
    title: routineToClone.title,
    routine_id: routineToClone.id,
    description: '',
    start_time: timestamp,
    end_time: null,
    created_at: timestamp,
    updated_at: timestamp,
    exercises: routineToClone.exercises.map((exercise, exerciseIndex) => ({
      ...exercise,
      id: `workout-exercise-${Date.now()}-${exerciseIndex}`,
      sets: exercise.sets.map((set, setIndex) => ({
        ...set,
        id: `workout-set-${Date.now()}-${exerciseIndex}-${setIndex}`,
        weight_kg: null,
        reps: null,
        distance_meters: null,
        duration_seconds: null,
        custom_metric: null,
        rpe: null,
        completed_at: undefined,
      })),
    })),
  };
};

export const emptyWorkout = (): Workout => {
  const timestamp = nowIso();

  return {
    id: `workout-${Date.now()}`,
    title: 'Empty Workout',
    routine_id: null,
    description: '',
    start_time: timestamp,
    end_time: null,
    created_at: timestamp,
    updated_at: timestamp,
    exercises: [],
  };
};

export const defaultAppData = (): AppData => ({
  schema_version: 1,
  routines: seedRoutines,
  routine_folders: seedRoutineFolders,
  exercise_templates: seedExerciseTemplates,
  workouts: [],
  active_workout: null,
  body_measurements: [],
  settings: defaultSettings,
});
