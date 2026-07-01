import { AppData, ExerciseTemplate, MuscleGroup, TrainingSet, Workout, WorkoutExercise } from './types';

export const completedSets = (sets: TrainingSet[]) => sets.filter(set => Boolean(set.completed_at));

export const setVolume = (set: TrainingSet) => {
  if (set.weight_kg === null || set.reps === null) return 0;
  return set.weight_kg * set.reps;
};

export const workoutVolume = (workout: Workout) =>
  workout.exercises.reduce((total, exercise) => total + exercise.sets.reduce((sum, set) => sum + setVolume(set), 0), 0);

export const workoutSetCount = (workout: Workout) =>
  workout.exercises.reduce((total, exercise) => total + completedSets(exercise.sets).length, 0);

export const workoutDurationSeconds = (workout: Workout) => {
  const start = new Date(workout.start_time).getTime();
  const end = workout.end_time ? new Date(workout.end_time).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
};

export const formatDuration = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export const previousSetsForExercise = (
  data: AppData,
  exerciseTemplateId: string,
  routineId: string | null,
): TrainingSet[] => {
  const sortedWorkouts = [...data.workouts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  const workout = sortedWorkouts.find(savedWorkout => {
    if (data.settings.previous_values_mode === 'same_routine' && routineId !== null && savedWorkout.routine_id !== routineId) {
      return false;
    }

    return savedWorkout.exercises.some(exercise => exercise.exercise_template_id === exerciseTemplateId);
  });

  const exercise = workout?.exercises.find(savedExercise => savedExercise.exercise_template_id === exerciseTemplateId);
  return exercise ? completedSets(exercise.sets) : [];
};

export const estimateOneRepMax = (set: TrainingSet) => {
  if (!set.weight_kg || !set.reps) return 0;
  return set.weight_kg * (1 + set.reps / 30);
};

export const bestSetLabel = (sets: TrainingSet[]) => {
  const best = [...sets].sort((a, b) => setVolume(b) - setVolume(a))[0];
  if (!best || best.weight_kg === null || best.reps === null) return '—';
  return `${best.weight_kg} kg × ${best.reps}`;
};

export const exerciseHistory = (data: AppData, templateId: string) =>
  data.workouts
    .flatMap(workout =>
      workout.exercises
        .filter(exercise => exercise.exercise_template_id === templateId)
        .map(exercise => ({
          workout,
          exercise,
          sets: completedSets(exercise.sets),
        })),
    )
    .filter(entry => entry.sets.length > 0)
    .sort((a, b) => new Date(b.workout.start_time).getTime() - new Date(a.workout.start_time).getTime());

export const exerciseStats = (data: AppData, templateId: string) => {
  const history = exerciseHistory(data, templateId);
  const sets = history.flatMap(entry => entry.sets);
  const heaviest = [...sets].sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0))[0];
  const bestOneRepMax = [...sets].sort((a, b) => estimateOneRepMax(b) - estimateOneRepMax(a))[0];
  const totalVolume = sets.reduce((total, set) => total + setVolume(set), 0);

  return {
    sessions: history.length,
    totalSets: sets.length,
    totalVolume,
    heaviestLabel: heaviest?.weight_kg ? `${heaviest.weight_kg} kg` : '—',
    bestSet: bestSetLabel(sets),
    oneRepMaxLabel: bestOneRepMax ? `${Math.round(estimateOneRepMax(bestOneRepMax))} kg` : '—',
    history,
  };
};

export const muscleDistribution = (data: AppData) => {
  const templateById = new Map(data.exercise_templates.map(template => [template.id, template]));
  const counts = new Map<MuscleGroup, number>();

  data.workouts.forEach(workout => {
    workout.exercises.forEach(exercise => {
      const template = templateById.get(exercise.exercise_template_id);
      if (!template) return;

      counts.set(template.primary_muscle_group, (counts.get(template.primary_muscle_group) ?? 0) + completedSets(exercise.sets).length);
    });
  });

  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

export const completedWorkouts = (data: AppData) =>
  [...data.workouts].sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

export const addTemplateToWorkout = (workout: Workout, template: ExerciseTemplate): Workout => ({
  ...workout,
  updated_at: new Date().toISOString(),
  exercises: [
    ...workout.exercises,
    {
      id: `workout-exercise-${Date.now()}`,
      index: workout.exercises.length + 1,
      exercise_template_id: template.id,
      title: template.title,
      superset_id: null,
      rest_seconds: null,
      notes: '',
      sets: [],
    },
  ],
});

export const renumberWorkoutExercises = (exercises: WorkoutExercise[]) =>
  exercises.map((exercise, index) => ({ ...exercise, index: index + 1 }));
