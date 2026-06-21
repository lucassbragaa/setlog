import type { LoggedSet } from '../types/training';

export function primaryRepetitions(set: LoggedSet): number {
  return set.techniqueDetails?.segmentRepetitions[0] ?? set.repetitions;
}

export function setVolumeKg(set: LoggedSet): number {
  const segments = set.techniqueDetails?.segmentRepetitions;
  const dropPercent = set.techniqueDetails?.loadDropPercent;
  if (set.type === 'drop' && segments?.length && dropPercent !== undefined) {
    const multiplier = Math.max(0, 1 - dropPercent / 100);
    return segments.reduce((total, repetitions, index) => (
      total + set.loadKg * Math.pow(multiplier, index) * repetitions
    ), 0);
  }
  return set.loadKg * set.repetitions;
}

export function estimated1Rm(set: LoggedSet): number {
  return set.loadKg * (1 + primaryRepetitions(set) / 30);
}
