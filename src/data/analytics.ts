import { estimated1Rm, setVolumeKg } from './setMetrics';
import type {
  CalendarDay,
  ExerciseBlock,
  ExercisePR,
  LoggedSet,
  SeriesPoint,
  StreakInfo,
  Timeframe,
  WeeklyVolumeSummary,
  WorkoutSession,
} from '../types/training';

export function normalizeExerciseKey(exercise: Pick<ExerciseBlock, 'exerciseId' | 'exerciseName'>): string {
  return (exercise.exerciseId || exercise.exerciseName)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function workingSets(exercise: ExerciseBlock): LoggedSet[] {
  return exercise.sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function localDateString(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localDateString(d.toISOString());
}

function startOfWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return localDateString(d.toISOString());
}

export function filterByTimeframe(sessions: WorkoutSession[], timeframe: Timeframe): WorkoutSession[] {
  if (timeframe === 'all') return sessions;
  const days = timeframe === '1m' ? 30 : timeframe === '3m' ? 90 : timeframe === '6m' ? 180 : 365;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();
  return sessions.filter(s => s.startedAt >= cutoffIso);
}

export function computePRs(history: WorkoutSession[]): Map<string, ExercisePR> {
  const map = new Map<string, ExercisePR>();
  const completed = history.filter(s => s.endedAt);
  for (const session of completed) {
    for (const exercise of session.exercises) {
      const key = normalizeExerciseKey(exercise);
      const sets = workingSets(exercise);
      if (sets.length === 0) continue;
      const bestE1rm = sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
      const bestWeight = sets.reduce((best, set) => Math.max(best, set.loadKg), 0);
      const sessionVolume = sets.reduce((total, set) => total + setVolumeKg(set), 0);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { exerciseKey: key, exerciseName: exercise.exerciseName, bestE1rm, bestWeight, bestVolume: sessionVolume, achievedAt: session.startedAt });
      } else {
        map.set(key, {
          ...existing,
          bestE1rm: Math.max(existing.bestE1rm, bestE1rm),
          bestWeight: Math.max(existing.bestWeight, bestWeight),
          bestVolume: Math.max(existing.bestVolume, sessionVolume),
          achievedAt: bestE1rm > existing.bestE1rm ? session.startedAt : existing.achievedAt,
        });
      }
    }
  }
  return map;
}

export function exerciseTimeSeries(
  history: WorkoutSession[],
  exerciseKey: string,
  metric: 'e1rm' | 'volume' | 'weight',
  timeframe: Timeframe,
): SeriesPoint[] {
  const filtered = filterByTimeframe(history.filter(s => s.endedAt), timeframe);
  const points: SeriesPoint[] = [];
  for (const session of [...filtered].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const matched = session.exercises.filter(e => normalizeExerciseKey(e) === exerciseKey);
    const sets = matched.flatMap(workingSets);
    if (sets.length === 0) continue;
    let value: number;
    if (metric === 'e1rm') value = sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
    else if (metric === 'volume') value = sets.reduce((total, set) => total + setVolumeKg(set), 0);
    else value = sets.reduce((best, set) => Math.max(best, set.loadKg), 0);
    const d = new Date(session.startedAt);
    points.push({
      date: session.startedAt,
      value,
      label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    });
  }
  return points;
}

export function workoutHeatmap(history: WorkoutSession[], weeks: number): CalendarDay[][] {
  const completed = history.filter(s => s.endedAt);
  const volumeByDate = new Map<string, { count: number; volume: number }>();
  for (const session of completed) {
    const date = localDateString(session.startedAt);
    const sessionVolume = session.exercises.flatMap(workingSets).reduce((total, set) => total + setVolumeKg(set), 0);
    const existing = volumeByDate.get(date);
    if (existing) {
      volumeByDate.set(date, { count: existing.count + 1, volume: existing.volume + sessionVolume });
    } else {
      volumeByDate.set(date, { count: 1, volume: sessionVolume });
    }
  }

  const today = localDateString(new Date().toISOString());
  const endWeek = startOfWeekMonday(today);
  const startDate = addDays(endWeek, -(weeks - 1) * 7);

  const result: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(startDate, w * 7 + d);
      const info = volumeByDate.get(date);
      week.push({
        date,
        hasWorkout: Boolean(info),
        sessionCount: info?.count ?? 0,
        totalVolume: info?.volume ?? 0,
      });
    }
    result.push(week);
  }
  return result;
}

export function computeStreak(history: WorkoutSession[]): StreakInfo {
  const completed = history.filter(s => s.endedAt);
  if (completed.length === 0) return { currentStreak: 0, longestStreak: 0, lastWorkoutDate: null };

  const dates = [...new Set(completed.map(s => localDateString(s.startedAt)))].sort().reverse();
  const today = localDateString(new Date().toISOString());
  const yesterday = addDays(today, -1);

  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;
  let prev: string | null = null;

  for (const date of [...dates].reverse()) {
    if (!prev) {
      streak = 1;
    } else {
      const expected = addDays(prev, 1);
      streak = date === expected ? streak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, streak);
    prev = date;
  }

  const lastDate = dates[0] ?? null;
  if (lastDate === today || lastDate === yesterday) {
    let cs = 1;
    for (let i = 1; i < dates.length; i++) {
      const expected = addDays(dates[i - 1], -1);
      if (dates[i] === expected) cs++;
      else break;
    }
    currentStreak = cs;
  }

  return { currentStreak, longestStreak, lastWorkoutDate: lastDate };
}

export function weeklyVolumeSummary(history: WorkoutSession[], weeks: number): WeeklyVolumeSummary[] {
  const completed = history.filter(s => s.endedAt);
  const today = localDateString(new Date().toISOString());
  const endWeek = startOfWeekMonday(today);
  const result: WeeklyVolumeSummary[] = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDays(endWeek, -w * 7);
    const weekEnd = addDays(weekStart, 6);
    const weekSessions = completed.filter(s => {
      const d = localDateString(s.startedAt);
      return d >= weekStart && d <= weekEnd;
    });
    const totalVolume = weekSessions.flatMap(s => s.exercises.flatMap(workingSets)).reduce((total, set) => total + setVolumeKg(set), 0);
    const setCount = weekSessions.flatMap(s => s.exercises.flatMap(workingSets)).length;
    const d = new Date(weekStart + 'T12:00:00');
    const weekLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    result.push({ weekStart, weekLabel, totalVolume, sessionCount: weekSessions.length, setCount });
  }
  return result;
}

export function lastSessionSetsForExercise(
  history: WorkoutSession[],
  exerciseKey: string,
  excludeSessionId: string,
): LoggedSet[] | null {
  const sessions = [...history]
    .filter(s => s.endedAt && s.id !== excludeSessionId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  for (const session of sessions) {
    const matched = session.exercises.filter(e => normalizeExerciseKey(e) === exerciseKey);
    const sets = matched.flatMap(e => e.sets);
    if (sets.length > 0) return sets;
  }
  return null;
}

export function sessionDurationMinutes(session: WorkoutSession): number | null {
  if (!session.endedAt) return null;
  return Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
}
