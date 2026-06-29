import { estimated1Rm, primaryRepetitions, setVolumeKg } from './setMetrics';
import type { CalendarDay, ExerciseBlock, ExercisePR, LoggedSet, SeriesPoint, Timeframe, WeeklyVolumeSummary, WorkoutSession } from '../types/training';

const DAY_MS = 24 * 60 * 60 * 1000;

type ExerciseLike = Pick<ExerciseBlock, 'exerciseId' | 'exerciseName'>;

type ExerciseMetric = 'e1rm' | 'volume' | 'weight';

function workingSets(exercise: ExerciseBlock): LoggedSet[] {
  return exercise.sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function weekStart(date: Date): Date {
  const day = startOfLocalDay(date);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

export function normalizeExerciseKey(exercise: ExerciseLike): string {
  return (exercise.exerciseId || exercise.exerciseName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function completedSessions(history: WorkoutSession[]): WorkoutSession[] {
  return history.filter(session => Boolean(session.endedAt)).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

export function filterByTimeframe(sessions: WorkoutSession[], timeframe: Timeframe): WorkoutSession[] {
  if (timeframe === 'all') return sessions;
  const months = timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : 12;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  return sessions.filter(session => new Date(session.startedAt) >= cutoff);
}

export function computePRs(history: WorkoutSession[]): Map<string, ExercisePR> {
  const prs = new Map<string, ExercisePR>();
  completedSessions(history).forEach(session => {
    session.exercises.forEach(exercise => {
      const sets = workingSets(exercise);
      if (sets.length === 0) return;
      const key = normalizeExerciseKey(exercise);
      const bestE1rm = sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
      const bestWeight = sets.reduce((best, set) => Math.max(best, set.loadKg), 0);
      const bestVolume = sets.reduce((total, set) => total + setVolumeKg(set), 0);
      const current = prs.get(key);
      if (!current || bestE1rm > current.bestE1rm || bestVolume > current.bestVolume) {
        prs.set(key, {
          exerciseKey: key,
          exerciseName: exercise.exerciseName,
          bestE1rm,
          bestWeight,
          bestVolume,
          achievedAt: session.startedAt,
        });
      }
    });
  });
  return prs;
}

export function exerciseTimeSeries(history: WorkoutSession[], key: string, metric: ExerciseMetric, timeframe: Timeframe): SeriesPoint[] {
  return filterByTimeframe(completedSessions(history), timeframe)
    .map(session => {
      const matching = session.exercises.filter(exercise => normalizeExerciseKey(exercise) === key);
      const sets = matching.flatMap(workingSets);
      if (sets.length === 0) return null;
      const value = metric === 'volume'
        ? sets.reduce((total, set) => total + setVolumeKg(set), 0)
        : metric === 'weight'
          ? sets.reduce((best, set) => Math.max(best, set.loadKg), 0)
          : sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
      return {
        date: session.startedAt,
        value,
        label: new Date(session.startedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      };
    })
    .filter((item): item is SeriesPoint => Boolean(item));
}

export function workoutHeatmap(history: WorkoutSession[], weeks = 12): CalendarDay[][] {
  const map = new Map<string, CalendarDay>();
  completedSessions(history).forEach(session => {
    const key = dateKey(new Date(session.startedAt));
    const current = map.get(key) ?? { date: key, hasWorkout: false, sessionCount: 0, totalVolume: 0 };
    const volume = session.exercises.flatMap(workingSets).reduce((total, set) => total + setVolumeKg(set), 0);
    map.set(key, { date: key, hasWorkout: true, sessionCount: current.sessionCount + 1, totalVolume: current.totalVolume + volume });
  });

  const end = startOfLocalDay(new Date());
  const start = weekStart(new Date(end.getTime() - (weeks - 1) * 7 * DAY_MS));
  return Array.from({ length: weeks }, (_, weekIndex) => {
    return Array.from({ length: 7 }, (_, dayIndex) => {
      const day = new Date(start);
      day.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const key = dateKey(day);
      return map.get(key) ?? { date: key, hasWorkout: false, sessionCount: 0, totalVolume: 0 };
    });
  });
}

export function computeStreak(history: WorkoutSession[]) {
  const days = Array.from(new Set(completedSessions(history).map(session => dateKey(new Date(session.startedAt))))).sort();
  if (days.length === 0) return { currentStreak: 0, longestStreak: 0, lastWorkoutDate: null };

  let longestStreak = 1;
  let running = 1;
  for (let index = 1; index < days.length; index += 1) {
    const prev = new Date(days[index - 1] + 'T00:00:00');
    const current = new Date(days[index] + 'T00:00:00');
    if ((current.getTime() - prev.getTime()) / DAY_MS === 1) running += 1;
    else running = 1;
    longestStreak = Math.max(longestStreak, running);
  }

  const today = dateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dateKey(yesterdayDate);
  let currentStreak = 0;
  if (days[days.length - 1] === today || days[days.length - 1] === yesterday) {
    currentStreak = 1;
    for (let index = days.length - 2; index >= 0; index -= 1) {
      const next = new Date(days[index + 1] + 'T00:00:00');
      const current = new Date(days[index] + 'T00:00:00');
      if ((next.getTime() - current.getTime()) / DAY_MS === 1) currentStreak += 1;
      else break;
    }
  }

  return { currentStreak, longestStreak, lastWorkoutDate: days[days.length - 1] };
}

export function weeklyVolumeSummary(history: WorkoutSession[], weeks = 8): WeeklyVolumeSummary[] {
  const now = new Date();
  const firstWeek = weekStart(new Date(now.getTime() - (weeks - 1) * 7 * DAY_MS));
  const summaries = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(firstWeek);
    start.setDate(firstWeek.getDate() + index * 7);
    return {
      weekStart: dateKey(start),
      weekLabel: start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      totalVolume: 0,
      sessionCount: 0,
      setCount: 0,
    };
  });
  const map = new Map(summaries.map(item => [item.weekStart, item]));
  completedSessions(history).forEach(session => {
    const key = dateKey(weekStart(new Date(session.startedAt)));
    const target = map.get(key);
    if (!target) return;
    const sets = session.exercises.flatMap(workingSets);
    target.totalVolume += sets.reduce((total, set) => total + setVolumeKg(set), 0);
    target.setCount += sets.length;
    target.sessionCount += 1;
  });
  return summaries;
}

export function lastSessionSetsForExercise(history: WorkoutSession[], key: string, excludeId?: string): LoggedSet[] {
  const found = completedSessions(history).slice().reverse().find(session => {
    if (excludeId && session.id === excludeId) return false;
    return session.exercises.some(exercise => normalizeExerciseKey(exercise) === key && workingSets(exercise).length > 0);
  });
  if (!found) return [];
  return found.exercises.filter(exercise => normalizeExerciseKey(exercise) === key).flatMap(workingSets);
}

export function sessionDurationMinutes(session: WorkoutSession): number | null {
  if (!session.endedAt) return null;
  return Math.max(1, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
}

export function setCountForSession(session: WorkoutSession): number {
  return session.exercises.flatMap(workingSets).length;
}

export function volumeForSession(session: WorkoutSession): number {
  return session.exercises.flatMap(workingSets).reduce((total, set) => total + setVolumeKg(set), 0);
}

export function primaryRepsForBestSet(sets: LoggedSet[]): number {
  const best = sets.reduce<LoggedSet | null>((currentBest, set) => {
    if (!currentBest) return set;
    return estimated1Rm(set) > estimated1Rm(currentBest) ? set : currentBest;
  }, null);
  return best ? primaryRepetitions(best) : 0;
}
