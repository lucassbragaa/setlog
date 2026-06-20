import type { ProgramExercise, SetPrescription, SetType } from '../types/training';

export const techniqueOptions: { value: SetType; label: string }[] = [
  { value: 'working', label: 'Straight set' },
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
  return techniqueOptions.find(option => option.value === type)?.label ?? 'Straight set';
}

export function emptyPrescription(): SetPrescription {
  return { technique: 'working', repRange: [0, 0], rirRange: [0, 0] };
}

export function prescriptionsFor(exercise: ProgramExercise): SetPrescription[] {
  return exercise.setPrescriptions ?? [];
}

export function exerciseWithPrescriptions(
  exercise: ProgramExercise,
  setPrescriptions: SetPrescription[],
): ProgramExercise {
  if (setPrescriptions.length === 0) {
    return {
      ...exercise,
      targetSets: 0,
      targetRepRange: [0, 0],
      targetRirRange: [0, 0],
      setPrescriptions: [],
    };
  }
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

export function removeLegacyGuess<T extends ProgramExercise>(exercise: T): T {
  if (exercise.setPrescriptions !== undefined) return exercise;
  return {
    ...exercise,
    targetSets: 0,
    targetRepRange: [0, 0],
    targetRirRange: [0, 0],
    setPrescriptions: [],
  };
}
