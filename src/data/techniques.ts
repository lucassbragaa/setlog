import type { ProgramExercise, SetPrescription, SetType } from '../types/training';

export const techniqueOptions: { value: SetType; label: string }[] = [
  { value: 'working', label: 'Série normal' },
  { value: 'topSet', label: 'Top set' },
  { value: 'backoff', label: 'Backoff' },
  { value: 'muscleRound', label: 'Muscle round' },
  { value: 'widowmaker', label: 'Widowmaker' },
  { value: 'restPause', label: 'Rest-pause' },
  { value: 'breathingCluster', label: 'Breathing clusters' },
  { value: 'drop', label: 'Drop set' },
  { value: 'myoRep', label: 'Myo-reps' },
  { value: 'approach', label: 'Aproximação' },
  { value: 'warmup', label: 'Aquecimento' },
];

export function techniqueLabel(type: SetType): string {
  return techniqueOptions.find(option => option.value === type)?.label ?? 'Série normal';
}

export function prescriptionsFor(exercise: ProgramExercise): SetPrescription[] {
  if (exercise.setPrescriptions?.length) return exercise.setPrescriptions;
  return Array.from({ length: Math.max(1, exercise.targetSets) }, () => ({
    technique: 'working' as const,
    repRange: [...exercise.targetRepRange] as [number, number],
    rirRange: [...exercise.targetRirRange] as [number, number],
  }));
}

export function exerciseWithPrescriptions(
  exercise: ProgramExercise,
  setPrescriptions: SetPrescription[],
): ProgramExercise {
  const reps = setPrescriptions.flatMap(item => item.repRange);
  const rirs = setPrescriptions.flatMap(item => item.rirRange);
  return {
    ...exercise,
    targetSets: setPrescriptions.length,
    targetRepRange: [Math.min(...reps), Math.max(...reps)],
    targetRirRange: [Math.min(...rirs), Math.max(...rirs)],
    setPrescriptions,
  };
}
