import { completedSessions, normalizeExerciseKey } from './analytics';
import { estimated1Rm, setVolumeKg } from './setMetrics';
import type { ExerciseTemplate, LoggedSet, MuscleGroup, WorkoutSession } from '../types/training';

export type MuscleSetSummary = {
  muscle: MuscleGroup;
  directSets: number;
  secondarySets: number;
  totalWeightedSets: number;
};

export type SetRecord = {
  reps: number;
  loadKg: number;
  achievedAt: string;
  workoutId: string;
};

export type ExerciseRecordBook = {
  exerciseKey: string;
  exerciseName: string;
  bestLoadKg: number;
  bestEstimated1Rm: number;
  bestSetVolumeKg: number;
  bestSessionVolumeKg: number;
  bestReps: number;
  setRecords: SetRecord[];
};

function workingSetsForSessionExercise(sets: LoggedSet[]) {
  return sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function templateFor(exerciseId: string, templates: ExerciseTemplate[]) {
  return templates.find(item => item.id === exerciseId || item.aliases?.some(alias => normalizeExerciseKey({ exerciseId: alias, exerciseName: alias }) === exerciseId));
}

export function muscleSetDistribution(history: WorkoutSession[], templates: ExerciseTemplate[]): MuscleSetSummary[] {
  const map = new Map<MuscleGroup, MuscleSetSummary>();
  completedSessions(history).forEach(session => {
    session.exercises.forEach(exercise => {
      const key = normalizeExerciseKey(exercise);
      const template = templateFor(key, templates);
      if (!template) return;
      const sets = workingSetsForSessionExercise(exercise.sets).length;
      template.primaryMuscles.forEach(muscle => {
        const current = map.get(muscle) ?? { muscle, directSets: 0, secondarySets: 0, totalWeightedSets: 0 };
        current.directSets += sets;
        current.totalWeightedSets += sets;
        map.set(muscle, current);
      });
      (template.secondaryMuscles ?? []).forEach(muscle => {
        const current = map.get(muscle) ?? { muscle, directSets: 0, secondarySets: 0, totalWeightedSets: 0 };
        current.secondarySets += sets;
        current.totalWeightedSets += sets * 0.5;
        map.set(muscle, current);
      });
    });
  });
  return Array.from(map.values()).sort((a, b) => b.totalWeightedSets - a.totalWeightedSets);
}

export function exerciseRecordBooks(history: WorkoutSession[]): ExerciseRecordBook[] {
  const books = new Map<string, ExerciseRecordBook>();
  completedSessions(history).forEach(session => {
    session.exercises.forEach(exercise => {
      const key = normalizeExerciseKey(exercise);
      const sets = workingSetsForSessionExercise(exercise.sets);
      if (sets.length === 0) return;
      const current = books.get(key) ?? {
        exerciseKey: key,
        exerciseName: exercise.exerciseName,
        bestLoadKg: 0,
        bestEstimated1Rm: 0,
        bestSetVolumeKg: 0,
        bestSessionVolumeKg: 0,
        bestReps: 0,
        setRecords: [],
      };
      current.bestSessionVolumeKg = Math.max(current.bestSessionVolumeKg, sets.reduce((total, set) => total + setVolumeKg(set), 0));
      sets.forEach(set => {
        current.bestLoadKg = Math.max(current.bestLoadKg, set.loadKg);
        current.bestEstimated1Rm = Math.max(current.bestEstimated1Rm, estimated1Rm(set));
        current.bestSetVolumeKg = Math.max(current.bestSetVolumeKg, setVolumeKg(set));
        current.bestReps = Math.max(current.bestReps, set.repetitions);
        const existingIndex = current.setRecords.findIndex(record => record.reps === set.repetitions);
        const record: SetRecord = { reps: set.repetitions, loadKg: set.loadKg, achievedAt: session.startedAt, workoutId: session.id };
        if (existingIndex === -1) current.setRecords.push(record);
        else if (set.loadKg > current.setRecords[existingIndex].loadKg) current.setRecords[existingIndex] = record;
      });
      current.setRecords.sort((a, b) => a.reps - b.reps);
      books.set(key, current);
    });
  });
  return Array.from(books.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'pt-BR'));
}
