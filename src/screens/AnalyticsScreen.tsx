import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { LineChart } from '../components/LineChart';
import { PRCard } from '../components/PRCard';
import {
  computePRs,
  computeStreak,
  exerciseTimeSeries,
  filterByTimeframe,
  normalizeExerciseKey,
  weeklyVolumeSummary,
  workoutHeatmap,
} from '../data/analytics';
import { PROGRAM_SEQUENCE, type ProgramCode } from '../data/cycles';
import { estimated1Rm, setVolumeKg } from '../data/setMetrics';
import { colors } from '../theme';
import type { ExerciseBlock, LoggedSet, Timeframe, WorkoutSession } from '../types/training';
import { Chip, commonStyles, ScreenTitle } from '../ui';

type Mode = 'overview' | 'program' | 'exercise';

type SessionStats = {
  cycle: number;
  volume: number;
  sets: number;
  averageRir: number;
  bestE1rm: number;
  session: WorkoutSession;
};

function workingSets(exercise: ExerciseBlock) {
  return exercise.sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function averageRir(sets: LoggedSet[]) {
  const setsWithRir = sets.filter(set => set.rir !== undefined);
  return setsWithRir.length ? setsWithRir.reduce((total, set) => total + (set.rir ?? 0), 0) / setsWithRir.length : 0;
}

function statsForSets(sets: LoggedSet[]) {
  const bestSet = sets.reduce<LoggedSet | null>((best, set) => {
    if (!best) return set;
    return estimated1Rm(set) > estimated1Rm(best) ? set : best;
  }, null);
  return {
    volume: sets.reduce((total, set) => total + setVolumeKg(set), 0),
    sets: sets.length,
    averageRir: averageRir(sets),
    bestE1rm: sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0),
    bestLoad: sets.reduce((best, set) => Math.max(best, set.loadKg), 0),
    bestReps: bestSet ? (bestSet.techniqueDetails?.segmentRepetitions[0] ?? bestSet.repetitions) : 0,
  };
}

function statsForSession(session: WorkoutSession): SessionStats {
  const sets = session.exercises.flatMap(workingSets);
  const stats = statsForSets(sets);
  return { cycle: session.cycleNumber ?? 0, volume: stats.volume, sets: stats.sets, averageRir: stats.averageRir, bestE1rm: stats.bestE1rm, session };
}

function percentChange(current: number, baseline: number): number | null {
  return baseline > 0 ? ((current - baseline) / baseline) * 100 : null;
}

function formatDelta(value: number | null) {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const TIMEFRAMES: { label: string; value: Timeframe }[] = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1A', value: '1y' },
  { label: 'Tudo', value: 'all' },
];

function TimeframeSelector({ value, onChange }: { value: Timeframe; onChange: (v: Timeframe) => void }) {
  return (
    <View style={styles.timeframeRow}>
      {TIMEFRAMES.map(tf => (
        <TouchableOpacity key={tf.value} onPress={() => onChange(tf.value)} style={[styles.tfChip, value === tf.value && styles.tfChipActive]}>
          <Text style={[styles.tfLabel, value === tf.value && styles.tfLabelActive]}>{tf.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function Metric({ label, value, detail, positive }: { label: string; value: string; detail: string; positive?: boolean | null }) {
  const deltaColor = positive === null || positive === undefined ? colors.textDim : positive ? colors.success : colors.danger;
  const showArrow = positive !== null && positive !== undefined && detail !== '—';
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 5 }}>
        {showArrow && <Text style={{ color: deltaColor, fontSize: 9, fontWeight: '800' }}>{positive ? '↑' : '↓'}</Text>}
        <Text style={[styles.metricDetail, { color: deltaColor }]}>{detail}</Text>
      </View>
    </View>
  );
}

function deltaPositive(value: number | null): boolean | null {
  if (value === null) return null;
  return value >= 0;
}

function OverviewTab({ sessions }: { sessions: WorkoutSession[] }) {
  const heatmapData = useMemo(() => workoutHeatmap(sessions, 12), [sessions]);
  const streak = useMemo(() => computeStreak(sessions), [sessions]);
  const prs = useMemo(() => computePRs(sessions), [sessions]);
  const weekly = useMemo(() => weeklyVolumeSummary(sessions, 8), [sessions]);
  const completed = sessions.filter(s => s.endedAt);

  const totalVolume = completed.reduce((total, s) => total + s.exercises.flatMap(workingSets).reduce((t, set) => t + setVolumeKg(set), 0), 0);
  const topExercises = useMemo(() => {
    const byKey = new Map<string, { name: string; volume: number }>();
    for (const s of completed) {
      for (const ex of s.exercises) {
        const key = normalizeExerciseKey(ex);
        const vol = workingSets(ex).reduce((t, set) => t + setVolumeKg(set), 0);
        const cur = byKey.get(key);
        byKey.set(key, { name: ex.exerciseName, volume: (cur?.volume ?? 0) + vol });
      }
    }
    return [...byKey.values()].sort((a, b) => b.volume - a.volume).slice(0, 5);
  }, [completed]);

  const maxTopVol = topExercises[0]?.volume ?? 1;
  const maxWeekVol = Math.max(...weekly.map(w => w.totalVolume), 1);

  return (
    <>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Frequência · 12 semanas</Text>
        <View style={{ marginTop: 12 }}>
          <CalendarHeatmap data={heatmapData} streak={streak.currentStreak} />
        </View>
      </View>

      <View style={styles.grid}>
        <Metric label="TREINOS TOTAL" value={String(completed.length)} detail="sessões finalizadas" />
        <Metric label="VOLUME TOTAL" value={(totalVolume / 1000).toFixed(1) + ' t'} detail="toneladas movidas" />
        <Metric label="STREAK ATUAL" value={streak.currentStreak + ' dias'} detail={'maior: ' + streak.longestStreak} />
        <Metric label="EXERCÍCIOS" value={String(prs.size)} detail="no histórico" />
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Volume semanal · 8 semanas</Text>
        {weekly.map(w => (
          <View key={w.weekStart} style={styles.chartRow}>
            <Text style={styles.cycleLabel}>{w.weekLabel}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${Math.max(3, (w.totalVolume / maxWeekVol) * 100)}%` as `${number}%` }]} />
            </View>
            <Text style={styles.barValue}>{w.sessionCount > 0 ? Math.round(w.totalVolume).toLocaleString('pt-BR') + ' kg' : '—'}</Text>
          </View>
        ))}
      </View>

      {topExercises.length > 0 && (
        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Top exercícios por volume</Text>
          {topExercises.map((ex, i) => (
            <View key={ex.name} style={styles.chartRow}>
              <Text style={styles.cycleLabel}>{i + 1}.</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { width: `${Math.max(3, (ex.volume / maxTopVol) * 100)}%` as `${number}%` }]} />
                </View>
              </View>
              <Text style={styles.barValue}>{(ex.volume / 1000).toFixed(1) + ' t'}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function ProgramTab({ sessions }: { sessions: WorkoutSession[] }) {
  const [selected, setSelected] = useState<ProgramCode>('A1');

  const latestSessionByCycle = sessions
    .filter(session => session.endedAt && session.name === selected && session.cycleNumber)
    .reduce<Map<number, WorkoutSession>>((map, session) => {
      const cycle = session.cycleNumber as number;
      const current = map.get(cycle);
      if (!current || (session.endedAt ?? '') > (current.endedAt ?? '')) map.set(cycle, session);
      return map;
    }, new Map());

  const selectedSessions = Array.from(latestSessionByCycle.values())
    .sort((a, b) => (a.cycleNumber ?? 0) - (b.cycleNumber ?? 0))
    .map(statsForSession);

  const latest = selectedSessions[selectedSessions.length - 1];
  const previous = selectedSessions[selectedSessions.length - 2];
  const first = selectedSessions[0];
  const volumeVsPrevious = latest && previous ? percentChange(latest.volume, previous.volume) : null;
  const volumeVsFirst = latest && first ? percentChange(latest.volume, first.volume) : null;
  const e1rmVsPrevious = latest && previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null;

  const previousExercises = new Map((previous?.session.exercises ?? []).map(exercise => [exercise.exerciseName, exercise]));

  const volumeSeries = selectedSessions.map(item => ({
    date: item.session.startedAt,
    value: item.volume,
    label: 'C' + item.cycle,
  }));
  const e1rmSeries = selectedSessions.map(item => ({
    date: item.session.startedAt,
    value: item.bestE1rm,
    label: 'C' + item.cycle,
  }));

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {PROGRAM_SEQUENCE.map(code => <Chip key={code} label={code} selected={selected === code} onPress={() => setSelected(code)} />)}
      </ScrollView>

      {latest ? (
        <>
          <View style={styles.grid}>
            <Metric label={`VOLUME · CICLO ${latest.cycle}`} value={latest.volume.toLocaleString('pt-BR') + ' kg'} detail={formatDelta(volumeVsPrevious) + ' vs. ant.'} positive={deltaPositive(volumeVsPrevious)} />
            <Metric label="MELHOR e1RM" value={latest.bestE1rm.toFixed(1) + ' kg'} detail={formatDelta(e1rmVsPrevious) + ' vs. ant.'} positive={deltaPositive(e1rmVsPrevious)} />
            <Metric label="RIR MÉDIO" value={latest.averageRir.toFixed(1)} detail={latest.sets + ' sets de trabalho'} />
            <Metric label="DESDE CICLO 1" value={formatDelta(volumeVsFirst)} detail="variação do volume" positive={deltaPositive(volumeVsFirst)} />
          </View>

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Volume por ciclo</Text>
            <LineChart
              data={volumeSeries}
              valueLabel={v => Math.round(v).toLocaleString('pt-BR') + ' kg'}
            />
          </View>

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Melhor e1RM por ciclo</Text>
            <LineChart
              data={e1rmSeries}
              valueLabel={v => v.toFixed(1) + ' kg'}
            />
          </View>

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Exercícios no ciclo {latest.cycle}</Text>
            {latest.session.exercises.map(exercise => {
              const currentSets = workingSets(exercise);
              const currentVolume = currentSets.reduce((total, set) => total + setVolumeKg(set), 0);
              const currentE1rm = currentSets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
              const oldExercise = previousExercises.get(exercise.exerciseName);
              const oldVolume = oldExercise ? workingSets(oldExercise).reduce((total, set) => total + setVolumeKg(set), 0) : 0;
              const delta = percentChange(currentVolume, oldVolume);
              return (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={commonStyles.muted}>{currentSets.length} sets · e1RM {currentE1rm ? currentE1rm.toFixed(1) : '—'} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.exerciseVolume}>{currentVolume.toLocaleString('pt-BR')} kg</Text>
                    <Text style={[styles.delta, (delta ?? 0) >= 0 ? styles.positive : styles.negative]}>{formatDelta(delta)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Ainda não há ciclos para {selected}</Text>
          <Text style={[commonStyles.muted, { marginTop: 8 }]}>Finalize esse treino para o primeiro ponto aparecer.</Text>
        </View>
      )}
    </>
  );
}

function ExerciseTab({ sessions }: { sessions: WorkoutSession[] }) {
  const [selectedExerciseKey, setSelectedExerciseKey] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    sessions.filter(session => session.endedAt).forEach(session => {
      session.exercises.forEach(exercise => {
        if (workingSets(exercise).length === 0) return;
        const key = normalizeExerciseKey(exercise);
        const current = map.get(key);
        map.set(key, { key, name: current?.name ?? exercise.exerciseName, count: (current?.count ?? 0) + 1 });
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [sessions]);

  const activeExerciseKey = selectedExerciseKey || exerciseOptions[0]?.key || '';
  const activeExerciseName = exerciseOptions.find(item => item.key === activeExerciseKey)?.name ?? 'Exercício';

  const e1rmSeries = useMemo(() => exerciseTimeSeries(sessions, activeExerciseKey, 'e1rm', timeframe), [sessions, activeExerciseKey, timeframe]);
  const volumeSeries = useMemo(() => exerciseTimeSeries(sessions, activeExerciseKey, 'volume', timeframe), [sessions, activeExerciseKey, timeframe]);

  const prs = useMemo(() => computePRs(sessions), [sessions]);
  const pr = prs.get(activeExerciseKey);

  const filteredSessions = useMemo(() => filterByTimeframe(sessions.filter(s => s.endedAt), timeframe), [sessions, timeframe]);
  const exerciseSeries = useMemo(() => {
    if (!activeExerciseKey) return [];
    return filteredSessions
      .map(session => {
        const matched = session.exercises.filter(exercise => normalizeExerciseKey(exercise) === activeExerciseKey);
        const sets = matched.flatMap(workingSets);
        if (sets.length === 0) return null;
        const stats = statsForSets(sets);
        const programLabel = `${session.name}${session.cycleNumber ? ` · C${session.cycleNumber}` : ''}`;
        return { key: session.id + '-' + activeExerciseKey, dateLabel: formatDate(session.startedAt), programLabel, session, ...stats };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => a.session.startedAt.localeCompare(b.session.startedAt));
  }, [activeExerciseKey, filteredSessions]);

  const latest = exerciseSeries[exerciseSeries.length - 1];
  const previous = exerciseSeries[exerciseSeries.length - 2];
  const first = exerciseSeries[0];

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {exerciseOptions.map(option => <Chip key={option.key} label={`${option.name} (${option.count})`} selected={activeExerciseKey === option.key} onPress={() => setSelectedExerciseKey(option.key)} />)}
      </ScrollView>

      <TimeframeSelector value={timeframe} onChange={setTimeframe} />

      {latest ? (
        <>
          <View style={styles.grid}>
            <Metric label="ÚLTIMO VOLUME" value={latest.volume.toLocaleString('pt-BR') + ' kg'} detail={formatDelta(previous ? percentChange(latest.volume, previous.volume) : null) + ' vs. ant.'} positive={deltaPositive(previous ? percentChange(latest.volume, previous.volume) : null)} />
            <Metric label="MELHOR e1RM" value={latest.bestE1rm.toFixed(1) + ' kg'} detail={formatDelta(previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null) + ' vs. ant.'} positive={deltaPositive(previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null)} />
            <Metric label="MELHOR CARGA" value={latest.bestLoad.toFixed(1) + ' kg'} detail={`${latest.bestReps} reps no melhor set`} />
            <Metric label="DESDE O INÍCIO" value={formatDelta(first ? percentChange(latest.volume, first.volume) : null)} detail="variação do volume" positive={deltaPositive(first ? percentChange(latest.volume, first.volume) : null)} />
          </View>

          {pr && <PRCard pr={pr} />}

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Melhor e1RM · {activeExerciseName}</Text>
            <LineChart data={e1rmSeries} valueLabel={v => v.toFixed(1) + ' kg'} />
          </View>

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Volume por sessão</Text>
            <LineChart data={volumeSeries} valueLabel={v => Math.round(v).toLocaleString('pt-BR') + ' kg'} />
          </View>

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Histórico · {activeExerciseName}</Text>
            {exerciseSeries.slice().reverse().map(item => (
              <View key={item.key} style={styles.exerciseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{item.dateLabel} · {item.programLabel}</Text>
                  <Text style={commonStyles.muted}>{item.sets} sets · RIR médio {item.averageRir.toFixed(1)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.exerciseVolume}>{item.volume.toLocaleString('pt-BR')} kg</Text>
                  <Text style={styles.delta}>e1RM {item.bestE1rm.toFixed(1)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Sem dados no período selecionado</Text>
          <Text style={[commonStyles.muted, { marginTop: 8 }]}>Tente um período maior ou finalize treinos com sets.</Text>
        </View>
      )}
    </>
  );
}

export function AnalyticsScreen({ sessions }: { sessions: WorkoutSession[] }) {
  const [mode, setMode] = useState<Mode>('overview');

  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="ANÁLISES" title="Análises" subtitle="Visão geral, por treino ou por exercício" />

      <View style={styles.modeTabs}>
        <Chip label="Geral" selected={mode === 'overview'} onPress={() => setMode('overview')} />
        <Chip label="Por treino" selected={mode === 'program'} onPress={() => setMode('program')} />
        <Chip label="Por exercício" selected={mode === 'exercise'} onPress={() => setMode('exercise')} />
      </View>

      {mode === 'overview' && <OverviewTab sessions={sessions} />}
      {mode === 'program' && <ProgramTab sessions={sessions} />}
      {mode === 'exercise' && <ExerciseTab sessions={sessions} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modeTabs: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2 },
  filters: { gap: 7, paddingVertical: 10, paddingRight: 20 },
  timeframeRow: { flexDirection: 'row', gap: 6, marginTop: 2, marginBottom: 6 },
  tfChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  tfChipActive: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  tfLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  tfLabelActive: { color: colors.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metric: { width: '48%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16 },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  metricValue: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  metricDetail: { color: colors.textDim, fontSize: 9 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  cycleLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', width: 40 },
  barTrack: { flex: 1, height: 26, backgroundColor: colors.elevated, borderRadius: 13, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: colors.accent, borderRadius: 13 },
  barValue: { color: colors.text, fontSize: 10, fontWeight: '700', width: 74, textAlign: 'right' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11, marginTop: 8 },
  exerciseName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  exerciseVolume: { color: colors.text, fontSize: 11, fontWeight: '800' },
  delta: { color: colors.textDim, fontSize: 9, fontWeight: '800', marginTop: 3 },
  positive: { color: colors.success },
  negative: { color: colors.danger },
});
