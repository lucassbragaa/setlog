import type { WorkoutSession } from '../types/training';

export function localDateParts(iso: string) {
  const date = new Date(iso);
  return { day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isoWithLocalDate(iso: string, year: number, month: number, day: number): string {
  const original = new Date(iso);
  const safeMonth = Math.min(12, Math.max(1, month));
  const safeDay = Math.min(daysInMonth(year, safeMonth), Math.max(1, day));
  return new Date(
    year,
    safeMonth - 1,
    safeDay,
    original.getHours(),
    original.getMinutes(),
    original.getSeconds(),
    original.getMilliseconds(),
  ).toISOString();
}


export function nowOnLocalDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  ).toISOString();
}

export function moveSessionToStartedAt(session: WorkoutSession, startedAt: string): WorkoutSession {
  const offset = new Date(startedAt).getTime() - new Date(session.startedAt).getTime();
  const shift = (iso?: string) => iso ? new Date(new Date(iso).getTime() + offset).toISOString() : undefined;
  return {
    ...session,
    startedAt,
    endedAt: shift(session.endedAt),
    exercises: session.exercises.map(exercise => ({
      ...exercise,
      sets: exercise.sets.map(set => ({ ...set, completedAt: shift(set.completedAt) ?? set.completedAt })),
    })),
  };
}
