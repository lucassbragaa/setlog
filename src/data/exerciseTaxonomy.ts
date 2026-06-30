import type { ExerciseTemplate, MuscleGroup } from '../types/training';

export const muscleOrder: MuscleGroup[] = [
  'chest',
  'lats',
  'upper-back',
  'traps',
  'shoulders',
  'triceps',
  'biceps',
  'forearms',
  'quads',
  'hamstrings',
  'glutes',
  'adductors',
  'abductors',
  'calves',
  'abs',
  'lower-back',
  'neck',
  'full-body',
  'cardio',
];

export const muscleLabels: Record<MuscleGroup, string> = {
  neck: 'Pescoço',
  traps: 'Trapézio',
  shoulders: 'Ombros',
  chest: 'Peito',
  'upper-back': 'Costas altas',
  lats: 'Dorsais',
  'lower-back': 'Lombar',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  abs: 'Abdômen',
  glutes: 'Glúteos',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores',
  calves: 'Panturrilhas',
  adductors: 'Adutores',
  abductors: 'Abdutores',
  cardio: 'Cardio',
  'full-body': 'Corpo todo',
};

export function exerciseMuscles(template?: Pick<ExerciseTemplate, 'primaryMuscles' | 'secondaryMuscles'>): MuscleGroup[] {
  if (!template) return [];
  return Array.from(new Set([...template.primaryMuscles, ...(template.secondaryMuscles ?? [])]));
}

export function primaryMuscle(template?: Pick<ExerciseTemplate, 'primaryMuscles'>): MuscleGroup {
  return template?.primaryMuscles[0] ?? 'full-body';
}

export function muscleLabel(muscle: MuscleGroup) {
  return muscleLabels[muscle] ?? muscle;
}

export function matchesMuscle(template: Pick<ExerciseTemplate, 'primaryMuscles' | 'secondaryMuscles'> | undefined, muscle: MuscleGroup | 'all') {
  if (muscle === 'all') return true;
  return exerciseMuscles(template).includes(muscle);
}
