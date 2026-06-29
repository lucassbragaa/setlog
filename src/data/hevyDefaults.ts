import type { AppSettings, ExerciseKind, ExerciseTemplate, MuscleGroup, RoutineFolder } from '../types/training';

export const defaultRoutineFolders: RoutineFolder[] = [
  {
    id: 'folder-personalized-ab',
    name: 'A/B personalizados',
    order: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'folder-custom',
    name: 'Meus treinos',
    order: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const defaultSettings: AppSettings = {
  unitSystem: 'metric',
  weekStart: 'monday',
  previousValuesMode: 'any-workout',
  showRpe: true,
  defaultRestSeconds: 120,
  barWeightKg: 20,
  plateInventory: [
    { weightKg: 20, count: 2 },
    { weightKg: 10, count: 2 },
    { weightKg: 5, count: 2 },
    { weightKg: 2.5, count: 2 },
    { weightKg: 1.25, count: 2 },
  ],
  githubSync: {
    enabled: false,
    owner: '',
    repo: 'setlog-data',
    branch: 'main',
    path: 'data/setlog.json',
  },
  theme: 'black-white',
};

type ExerciseSeed = {
  name: string;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  equipment?: ExerciseTemplate['equipment'];
  kind?: ExerciseKind;
  aliases?: string[];
};

export function slugifyExerciseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'exercicio';
}

function template(seed: ExerciseSeed): ExerciseTemplate {
  return {
    id: slugifyExerciseName(seed.name),
    name: seed.name,
    kind: seed.kind ?? 'weight-reps',
    primaryMuscles: seed.primaryMuscles,
    secondaryMuscles: seed.secondaryMuscles,
    equipment: seed.equipment ?? 'machine',
    aliases: seed.aliases,
    instructions: [
      'Ajuste setup, amplitude e estabilidade antes do set efetivo.',
      'Registre carga, reps e RPE/RIR de forma consistente para comparar progresso.',
    ],
  };
}

export const defaultExerciseTemplates: ExerciseTemplate[] = [
  template({ name: 'Remada curvada guiada', primaryMuscles: ['upper-back', 'lats'], secondaryMuscles: ['biceps'], equipment: 'machine' }),
  template({ name: 'Puxada neutra unilateral', primaryMuscles: ['lats'], secondaryMuscles: ['biceps', 'upper-back'], equipment: 'cable' }),
  template({ name: 'Supino inclinado', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders', 'triceps'], equipment: 'machine' }),
  template({ name: 'Crucifixo', primaryMuscles: ['chest'], secondaryMuscles: ['shoulders'], equipment: 'machine' }),
  template({ name: 'Desenvolvimento na maquina', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'], equipment: 'machine', aliases: ['Desenvolvimento na máquina'] }),
  template({ name: 'Elevacao lateral unilateral', primaryMuscles: ['shoulders'], equipment: 'cable', aliases: ['Elevação lateral unilateral'] }),
  template({ name: 'Crucifixo invertido', primaryMuscles: ['shoulders', 'upper-back'], equipment: 'machine' }),
  template({ name: 'Triceps na polia', primaryMuscles: ['triceps'], equipment: 'cable', aliases: ['Tríceps na polia'] }),
  template({ name: 'Hack squat', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: 'machine' }),
  template({ name: 'Leg press horizontal', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: 'machine' }),
  template({ name: 'Cadeira extensora', primaryMuscles: ['quads'], equipment: 'machine' }),
  template({ name: 'Stiff', primaryMuscles: ['hamstrings'], secondaryMuscles: ['glutes', 'lower-back'], equipment: 'barbell' }),
  template({ name: 'Cadeira flexora', primaryMuscles: ['hamstrings'], equipment: 'machine' }),
  template({ name: 'Rosca Scott', primaryMuscles: ['biceps'], equipment: 'machine' }),
  template({ name: 'Rosca inclinada unilateral no cabo', primaryMuscles: ['biceps'], equipment: 'cable' }),
  template({ name: 'Remada neutra', primaryMuscles: ['upper-back', 'lats'], secondaryMuscles: ['biceps'], equipment: 'machine' }),
  template({ name: 'Puxada pronada', primaryMuscles: ['lats'], secondaryMuscles: ['upper-back', 'biceps'], equipment: 'cable' }),
  template({ name: 'Supino reto', primaryMuscles: ['chest'], secondaryMuscles: ['triceps', 'shoulders'], equipment: 'machine' }),
  template({ name: 'Crucifixo no cross', primaryMuscles: ['chest'], equipment: 'cable' }),
  template({ name: 'Desenvolvimento com pino', primaryMuscles: ['shoulders'], secondaryMuscles: ['triceps'], equipment: 'machine' }),
  template({ name: 'Elevacao lateral', primaryMuscles: ['shoulders'], equipment: 'dumbbell', aliases: ['Elevação lateral'] }),
  template({ name: 'Cadeira abdutora', primaryMuscles: ['abductors', 'glutes'], equipment: 'machine' }),
  template({ name: 'Leg press', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: 'machine' }),
  template({ name: 'Cadeira extensora unilateral', primaryMuscles: ['quads'], equipment: 'machine' }),
  template({ name: 'Coice de gluteo', primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings'], equipment: 'cable', aliases: ['Coice de glúteo'] }),
  template({ name: 'Flexora em pe', primaryMuscles: ['hamstrings'], equipment: 'machine', aliases: ['Flexora em pé'] }),
  template({ name: 'Cadeira adutora', primaryMuscles: ['adductors'], equipment: 'machine' }),
  template({ name: 'Rosca concentrada', primaryMuscles: ['biceps'], equipment: 'dumbbell' }),
  template({ name: 'Rosca martelo', primaryMuscles: ['biceps', 'forearms'], equipment: 'dumbbell' }),
  template({ name: 'Remada supinada', primaryMuscles: ['upper-back', 'lats'], secondaryMuscles: ['biceps'], equipment: 'machine' }),
  template({ name: 'Puxada supinada', primaryMuscles: ['lats'], secondaryMuscles: ['biceps'], equipment: 'cable' }),
  template({ name: 'Pullover', primaryMuscles: ['lats'], secondaryMuscles: ['chest'], equipment: 'cable' }),
  template({ name: 'Supino declinado', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], equipment: 'machine' }),
  template({ name: 'Fly', primaryMuscles: ['chest'], equipment: 'machine' }),
  template({ name: 'Elevacao Y', primaryMuscles: ['shoulders', 'upper-back'], equipment: 'cable', aliases: ['Elevação Y'] }),
  template({ name: 'Triceps testa na maquina', primaryMuscles: ['triceps'], equipment: 'machine', aliases: ['Tríceps testa na máquina'] }),
  template({ name: 'Triceps coice', primaryMuscles: ['triceps'], equipment: 'cable', aliases: ['Tríceps coice'] }),
  template({ name: 'Agachamento pendulo', primaryMuscles: ['quads'], secondaryMuscles: ['glutes'], equipment: 'machine', aliases: ['Agachamento pêndulo'] }),
  template({ name: 'Mesa flexora', primaryMuscles: ['hamstrings'], equipment: 'machine' }),
  template({ name: 'Remada supinada dupla', primaryMuscles: ['upper-back', 'lats'], secondaryMuscles: ['biceps'], equipment: 'machine' }),
  template({ name: 'Elevacao lateral na maquina', primaryMuscles: ['shoulders'], equipment: 'machine', aliases: ['Elevação lateral na máquina'] }),
  template({ name: 'Face pull', primaryMuscles: ['shoulders', 'upper-back'], equipment: 'cable' }),
  template({ name: 'Triceps corda', primaryMuscles: ['triceps'], equipment: 'cable', aliases: ['Tríceps corda'] }),
  template({ name: 'Flexora sentada', primaryMuscles: ['hamstrings'], equipment: 'machine' }),
  template({ name: 'Rosca no cabo', primaryMuscles: ['biceps'], equipment: 'cable' }),
];
