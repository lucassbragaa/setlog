import type { WorkoutSession } from '../types/training';

export const MAX_CYCLES = 16;
export const PROGRAM_SEQUENCE = ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4', 'B4'] as const;
export type ProgramCode = typeof PROGRAM_SEQUENCE[number];

export function isProgramCode(value: string): value is ProgramCode {
  return PROGRAM_SEQUENCE.includes(value as ProgramCode);
}

export function completedCodes(history: WorkoutSession[], cycleNumber: number): ProgramCode[] {
  const completed = new Set(
    history
      .filter(session => session.endedAt && session.cycleNumber === cycleNumber && isProgramCode(session.name))
      .map(session => session.name as ProgramCode),
  );
  return PROGRAM_SEQUENCE.filter(code => completed.has(code));
}

export function currentCycleNumber(history: WorkoutSession[]): number {
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle += 1) {
    if (completedCodes(history, cycle).length < PROGRAM_SEQUENCE.length) return cycle;
  }
  return MAX_CYCLES;
}

export function totalCycleCompletions(history: WorkoutSession[]): number {
  return Array.from({ length: MAX_CYCLES }, (_, index) => completedCodes(history, index + 1).length)
    .reduce((total, value) => total + value, 0);
}

export function nextProgramCode(history: WorkoutSession[]): ProgramCode {
  const done = completedCodes(history, currentCycleNumber(history));
  return PROGRAM_SEQUENCE.find(code => !done.includes(code)) ?? PROGRAM_SEQUENCE[0];
}
