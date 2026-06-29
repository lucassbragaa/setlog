import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { CalendarHeatmap } from '../components/CalendarHeatmap';
import { LineChart } from '../components/LineChart';
import { PRCard } from '../components/PRCard';
import {
  completedSessions,
  computePRs,
  computeStreak,
  exerciseTimeSeries,
  filterByTimeframe,
  normalizeExerciseKey,
  setCountForSession,
  volumeForSession,
  weeklyVolumeSummary,
  workoutHeatmap,
} from '../data/analytics';
import { PROGRAM_SEQUENCE, type ProgramCode } from '../data/cycles';
import { muscleSetDistribution } from '../data/hevyAnalytics';
import { estimated1Rm, setVolumeKg } from '../data/setMetrics';
import { colors, radius, type } from '../theme';
import type { ExerciseBlock, ExerciseTemplate, LoggedSet, Timeframe, WorkoutSession } from '../types/training';
import { Chip, commonStyles, ScreenTitle } from '../ui';

type Mode = 'overview' | 'program' | 'exercise';
type SessionStats = { cycle: number; volume: number; sets: number; averageRir: number; bestE1rm: number; session: WorkoutSession };
type ExerciseStats = { key: string; dateLabel: string; programLabel: string; volume: number; sets: number; averageRir: number; bestE1rm: number; bestLoad: number; session: WorkoutSession };

const timeframes: { value: Timeframe; label: string }[] = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1A' },
  { value: 'all', label: 'Tudo' },
];

function workingSets(exercise: ExerciseBlock) {
  return exercise.sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function averageRir(sets: LoggedSet[]) {
  const withRir = sets.filter(set => set.rir !== undefined);
  return withRir.length ? withRir.reduce((total, set) => total + (set.rir ?? 0), 0) / withRir.length : 0;
}

function statsForSets(sets: LoggedSet[]) {
  return {
    volume: sets.reduce((total, set) => total + setVolumeKg(set), 0),
    sets: sets.length,
    averageRir: averageRir(sets),
    bestE1rm: sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0),
    bestLoad: sets.reduce((best, set) => Math.max(best, set.loadKg), 0),
  };
}

function statsForSession(session: WorkoutSession): SessionStats {
  const sets = session.exercises.flatMap(workingSets);
  const stats = statsForSets(sets);
  return { cycle: session.cycleNumber ?? 0, session, ...stats };
}

function percentChange(current: number, baseline: number): number | null {
  return baseline > 0 ? ((current - baseline) / baseline) * 100 : null;
}

function formatDelta(value: number | null) {
  if (value === null) return '--';
  return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function kg(value: number) {
  return Math.round(value).toLocaleString('pt-BR') + ' kg';
}

export function AnalyticsScreen({ sessions, exerciseTemplates = [] }: { sessions: WorkoutSession[]; exerciseTemplates?: ExerciseTemplate[] }) {
  const [mode, setMode] = useState<Mode>('overview');
  const [selected, setSelected] = useState<ProgramCode>('A1');
  const [timeframe, setTimeframe] = useState<Timeframe>('6m');
  const [selectedExerciseKey, setSelectedExerciseKey] = useState('');

  const completed = useMemo(() => completedSessions(sessions), [sessions]);
  const prs = useMemo(() => computePRs(sessions), [sessions]);
  const heatmap = useMemo(() => workoutHeatmap(sessions, 12), [sessions]);
  const weekly = useMemo(() => weeklyVolumeSummary(sessions, 8), [sessions]);
  const streak = useMemo(() => computeStreak(sessions), [sessions]);
  const muscleSummary = useMemo(() => muscleSetDistribution(sessions, exerciseTemplates), [sessions, exerciseTemplates]);

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number; volume: number }>();
    completed.forEach(session => {
      session.exercises.forEach(exercise => {
        const sets = workingSets(exercise);
        if (sets.length === 0) return;
        const key = normalizeExerciseKey(exercise);
        const current = map.get(key);
        map.set(key, {
          key,
          name: current?.name ?? exercise.exerciseName,
          count: (current?.count ?? 0) + 1,
          volume: (current?.volume ?? 0) + sets.reduce((total, set) => total + setVolumeKg(set), 0),
        });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume || a.name.localeCompare(b.name, 'pt-BR'));
  }, [completed]);

  const activeExerciseKey = selectedExerciseKey || exerciseOptions[0]?.key || '';
  const activeExerciseName = exerciseOptions.find(item => item.key === activeExerciseKey)?.name ?? 'Exercicio';

  return (
    <ScrollView contentContainerStyle={commonStyles.screen} showsVerticalScrollIndicator={false}>
      <ScreenTitle eyebrow="SETGRAPH" title="Analises" subtitle="Volume, PRs, frequencia e progresso por treino ou exercicio." />
      <View style={styles.modeTabs}>
        <Chip label="Geral" selected={mode === 'overview'} onPress={() => setMode('overview')} />
        <Chip label="Por treino" selected={mode === 'program'} onPress={() => setMode('program')} />
        <Chip label="Por exercicio" selected={mode === 'exercise'} onPress={() => setMode('exercise')} />
      </View>
      {mode === 'overview' ? <OverviewTab completed={completed} heatmap={heatmap} weekly={weekly} streak={streak} exerciseOptions={exerciseOptions} prs={prs} muscleSummary={muscleSummary} /> : null}
      {mode === 'program' ? <ProgramTab selected={selected} setSelected={setSelected} sessions={sessions} /> : null}
      {mode === 'exercise' ? <ExerciseTab sessions={sessions} exerciseOptions={exerciseOptions} activeExerciseKey={activeExerciseKey} activeExerciseName={activeExerciseName} setSelectedExerciseKey={setSelectedExerciseKey} timeframe={timeframe} setTimeframe={setTimeframe} prs={prs} /> : null}
    </ScrollView>
  );
}

function OverviewTab({ completed, heatmap, weekly, streak, exerciseOptions, prs, muscleSummary }: {
  completed: WorkoutSession[];
  heatmap: ReturnType<typeof workoutHeatmap>;
  weekly: ReturnType<typeof weeklyVolumeSummary>;
  streak: ReturnType<typeof computeStreak>;
  exerciseOptions: { key: string; name: string; count: number; volume: number }[];
  prs: Map<string, ReturnType<typeof computePRs> extends Map<string, infer PR> ? PR : never>;
  muscleSummary: ReturnType<typeof muscleSetDistribution>;
}) {
  const totalVolume = completed.reduce((total, session) => total + volumeForSession(session), 0);
  const totalSets = completed.reduce((total, session) => total + setCountForSession(session), 0);
  const bestPr = Array.from(prs.values()).sort((a, b) => b.bestE1rm - a.bestE1rm)[0];
  const maxWeekly = Math.max(...weekly.map(item => item.totalVolume), 1);

  return (
    <>
      <CalendarHeatmap weeks={heatmap} />
      <View style={styles.grid}>
        <Metric label="TREINOS" value={String(completed.length)} detail={totalSets + ' sets salvos'} />
        <Metric label="VOLUME TOTAL" value={kg(totalVolume)} detail="sets de trabalho" />
        <Metric label="STREAK" value={String(streak.currentStreak)} detail={'maior: ' + streak.longestStreak + ' dias'} />
        <Metric label="EXERCICIOS" value={String(exerciseOptions.length)} detail="com historico" />
      </View>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Volume semanal</Text>
        <View style={styles.weekBars}>
          {weekly.map(week => (
            <View key={week.weekStart} style={styles.weekItem}>
              <View style={styles.weekTrack}><View style={[styles.weekFill, { height: Math.max(4, (week.totalVolume / maxWeekly) * 92) }]} /></View>
              <Text style={styles.weekLabel}>{week.weekLabel}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Top exercicios por volume</Text>
        {exerciseOptions.slice(0, 5).map((exercise, index) => (
          <View key={exercise.key} style={styles.rankRow}>
            <Text style={styles.rank}>{String(index + 1).padStart(2, '0')}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: (Math.max(4, (exercise.volume / Math.max(exerciseOptions[0]?.volume ?? 1, 1)) * 100) + '%') as DimensionValue }]} /></View>
            </View>
            <Text style={styles.rankValue}>{kg(exercise.volume)}</Text>
          </View>
        ))}
      </View>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Sets por grupo muscular</Text>
        {muscleSummary.length === 0 ? (
          <Text style={[commonStyles.muted, { marginTop: 8 }]}>Os grupos musculares aparecem aqui conforme a biblioteca de exercicios v3 for usada nos logs.</Text>
        ) : muscleSummary.slice(0, 8).map(item => (
          <View key={item.muscle} style={styles.rankRow}>
            <Text style={styles.rank}>{item.muscle}</Text>
            <View style={{ flex: 1 }}>
              <View style={styles.volumeTrack}><View style={[styles.volumeFill, { width: (Math.max(4, (item.totalWeightedSets / Math.max(muscleSummary[0]?.totalWeightedSets ?? 1, 1)) * 100) + '%') as DimensionValue }]} /></View>
            </View>
            <Text style={styles.rankValue}>{item.totalWeightedSets.toFixed(1)} sets</Text>
          </View>
        ))}
      </View>
      <PRCard pr={bestPr} />
    </>
  );
}

function ProgramTab({ selected, setSelected, sessions }: { selected: ProgramCode; setSelected: (code: ProgramCode) => void; sessions: WorkoutSession[] }) {
  const latestSessionByCycle = sessions
    .filter(session => session.endedAt && session.name === selected && session.cycleNumber)
    .reduce<Map<number, WorkoutSession>>((map, session) => {
      const cycle = session.cycleNumber as number;
      const current = map.get(cycle);
      if (!current || (session.endedAt ?? '') > (current.endedAt ?? '')) map.set(cycle, session);
      return map;
    }, new Map());
  const selectedSessions = Array.from(latestSessionByCycle.values()).sort((a, b) => (a.cycleNumber ?? 0) - (b.cycleNumber ?? 0)).map(statsForSession);
  const latest = selectedSessions[selectedSessions.length - 1];
  const previous = selectedSessions[selectedSessions.length - 2];
  const first = selectedSessions[0];
  const previousExercises = new Map((previous?.session.exercises ?? []).map(exercise => [normalizeExerciseKey(exercise), exercise]));

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {PROGRAM_SEQUENCE.map(code => <Chip key={code} label={code} selected={selected === code} onPress={() => setSelected(code)} />)}
      </ScrollView>
      {latest ? (
        <>
          <View style={styles.grid}>
            <Metric label={'VOLUME C' + latest.cycle} value={kg(latest.volume)} detail={formatDelta(previous ? percentChange(latest.volume, previous.volume) : null) + ' vs anterior'} />
            <Metric label="MELHOR e1RM" value={latest.bestE1rm.toFixed(1) + ' kg'} detail={formatDelta(previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null) + ' vs anterior'} />
            <Metric label="RIR MEDIO" value={latest.averageRir.toFixed(1)} detail={latest.sets + ' sets'} />
            <Metric label="DESDE C1" value={formatDelta(first ? percentChange(latest.volume, first.volume) : null)} detail="volume acumulado" />
          </View>
          <LineChart title={'Volume do ' + selected + ' por ciclo'} data={selectedSessions.map(item => ({ date: String(item.cycle), label: 'C' + item.cycle, value: item.volume }))} valueLabel={kg} />
          <LineChart title="Melhor e1RM por ciclo" data={selectedSessions.map(item => ({ date: String(item.cycle), label: 'C' + item.cycle, value: item.bestE1rm }))} valueLabel={value => value.toFixed(1) + ' kg'} />
          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Exercicios no ciclo {latest.cycle}</Text>
            {latest.session.exercises.map(exercise => {
              const currentSets = workingSets(exercise);
              const currentVolume = currentSets.reduce((total, set) => total + setVolumeKg(set), 0);
              const currentE1rm = currentSets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
              const oldExercise = previousExercises.get(normalizeExerciseKey(exercise));
              const oldVolume = oldExercise ? workingSets(oldExercise).reduce((total, set) => total + setVolumeKg(set), 0) : 0;
              const delta = percentChange(currentVolume, oldVolume);
              return (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={commonStyles.muted}>{currentSets.length} sets - e1RM {currentE1rm ? currentE1rm.toFixed(1) : '--'} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.exerciseVolume}>{kg(currentVolume)}</Text>
                    <Text style={[styles.delta, (delta ?? 0) >= 0 ? styles.positive : styles.negative]}>{formatDelta(delta)}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : <EmptyCard title={'Sem ciclos concluidos para ' + selected} body="Finalize esse treino para criar o primeiro ponto do grafico." />}
    </>
  );
}

function ExerciseTab({ sessions, exerciseOptions, activeExerciseKey, activeExerciseName, setSelectedExerciseKey, timeframe, setTimeframe, prs }: {
  sessions: WorkoutSession[];
  exerciseOptions: { key: string; name: string; count: number; volume: number }[];
  activeExerciseKey: string;
  activeExerciseName: string;
  setSelectedExerciseKey: (key: string) => void;
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  prs: ReturnType<typeof computePRs>;
}) {
  const filtered = filterByTimeframe(completedSessions(sessions), timeframe);
  const exerciseSeries = useMemo<ExerciseStats[]>(() => {
    if (!activeExerciseKey) return [];
    return filtered.map(session => {
      const matched = session.exercises.filter(exercise => normalizeExerciseKey(exercise) === activeExerciseKey);
      const sets = matched.flatMap(workingSets);
      if (sets.length === 0) return null;
      const stats = statsForSets(sets);
      return {
        key: session.id + '-' + activeExerciseKey,
        dateLabel: formatDate(session.startedAt),
        programLabel: session.name + (session.cycleNumber ? ' - C' + session.cycleNumber : ''),
        session,
        ...stats,
      };
    }).filter((item): item is ExerciseStats => Boolean(item)).sort((a, b) => a.session.startedAt.localeCompare(b.session.startedAt));
  }, [activeExerciseKey, filtered]);
  const latest = exerciseSeries[exerciseSeries.length - 1];
  const previous = exerciseSeries[exerciseSeries.length - 2];
  const first = exerciseSeries[0];
  const e1rmSeries = exerciseTimeSeries(sessions, activeExerciseKey, 'e1rm', timeframe);
  const volumeSeries = exerciseTimeSeries(sessions, activeExerciseKey, 'volume', timeframe);

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {exerciseOptions.map(option => <Chip key={option.key} label={option.name + ' (' + option.count + ')'} selected={activeExerciseKey === option.key} onPress={() => setSelectedExerciseKey(option.key)} />)}
      </ScrollView>
      <View style={styles.timeframes}>{timeframes.map(item => <Chip key={item.value} label={item.label} selected={timeframe === item.value} onPress={() => setTimeframe(item.value)} />)}</View>
      {latest ? (
        <>
          <View style={styles.grid}>
            <Metric label="ULTIMO VOLUME" value={kg(latest.volume)} detail={formatDelta(previous ? percentChange(latest.volume, previous.volume) : null) + ' vs anterior'} />
            <Metric label="MELHOR e1RM" value={latest.bestE1rm.toFixed(1) + ' kg'} detail={formatDelta(previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null) + ' vs anterior'} />
            <Metric label="MELHOR CARGA" value={latest.bestLoad.toFixed(1) + ' kg'} detail={latest.sets + ' sets no ultimo log'} />
            <Metric label="DESDE O 1o LOG" value={formatDelta(first ? percentChange(latest.volume, first.volume) : null)} detail="volume do exercicio" />
          </View>
          <PRCard pr={prs.get(activeExerciseKey)} />
          <LineChart title={'e1RM - ' + activeExerciseName} data={e1rmSeries} valueLabel={value => value.toFixed(1) + ' kg'} />
          <LineChart title={'Volume - ' + activeExerciseName} data={volumeSeries} valueLabel={kg} />
          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Logs de {activeExerciseName}</Text>
            {exerciseSeries.slice().reverse().map(item => (
              <View key={item.key} style={styles.exerciseRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseName}>{item.dateLabel} - {item.programLabel}</Text>
                  <Text style={commonStyles.muted}>{item.sets} sets - RIR medio {item.averageRir.toFixed(1)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.exerciseVolume}>{kg(item.volume)}</Text>
                  <Text style={styles.delta}>e1RM {item.bestE1rm.toFixed(1)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      ) : <EmptyCard title="Sem dados para esse exercicio" body="Finalize mais treinos ou troque o periodo analisado." />}
    </>
  );
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return <View style={commonStyles.card}><Text style={commonStyles.cardTitle}>{title}</Text><Text style={[commonStyles.muted, { marginTop: 8 }]}>{body}</Text></View>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  modeTabs: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 4, flexWrap: 'wrap' },
  filters: { gap: 8, paddingVertical: 10, paddingRight: 20 },
  timeframes: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  metric: { width: '48%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, minHeight: 108, justifyContent: 'space-between' },
  metricLabel: { color: colors.muted, fontSize: type.xs, fontWeight: '900', letterSpacing: 0.8 },
  metricValue: { color: colors.text, fontSize: 26, fontWeight: '900', marginTop: 7, letterSpacing: -0.5 },
  metricDetail: { color: colors.textDim, fontSize: type.xs, marginTop: 6, fontWeight: '700' },
  weekBars: { height: 126, flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 16 },
  weekItem: { flex: 1, alignItems: 'center', gap: 8 },
  weekTrack: { height: 96, width: '100%', borderRadius: radius.full, backgroundColor: colors.elevated, overflow: 'hidden', justifyContent: 'flex-end', borderWidth: 1, borderColor: colors.border },
  weekFill: { backgroundColor: colors.accent, borderRadius: radius.full },
  weekLabel: { color: colors.textDim, fontSize: 8, fontWeight: '800' },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12, marginTop: 6 },
  rank: { color: colors.textDim, fontSize: 10, fontWeight: '900', width: 24 },
  rankValue: { color: colors.text, fontSize: 10, fontWeight: '900', width: 72, textAlign: 'right' },
  volumeTrack: { height: 5, borderRadius: radius.full, backgroundColor: colors.elevated, overflow: 'hidden', marginTop: 7 },
  volumeFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.full },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 12, marginTop: 8, gap: 12 },
  exerciseName: { color: colors.text, fontSize: type.md, fontWeight: '900' },
  exerciseVolume: { color: colors.text, fontSize: type.sm, fontWeight: '900' },
  delta: { color: colors.textDim, fontSize: type.xs, fontWeight: '900', marginTop: 3 },
  positive: { color: colors.success },
  negative: { color: colors.danger },
});
