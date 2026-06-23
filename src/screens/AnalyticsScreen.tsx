import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PROGRAM_SEQUENCE, type ProgramCode } from '../data/cycles';
import { estimated1Rm, primaryRepetitions, setVolumeKg } from '../data/setMetrics';
import { colors } from '../theme';
import type { ExerciseBlock, LoggedSet, WorkoutSession } from '../types/training';
import { Chip, commonStyles, ScreenTitle } from '../ui';

type SessionStats = {
  cycle: number;
  volume: number;
  sets: number;
  averageRir: number;
  bestE1rm: number;
  session: WorkoutSession;
};

type ExerciseStats = {
  key: string;
  label: string;
  dateLabel: string;
  programLabel: string;
  volume: number;
  sets: number;
  averageRir: number;
  bestE1rm: number;
  bestLoad: number;
  bestReps: number;
  session: WorkoutSession;
};

type ChartPoint = {
  key: string;
  label: string;
  value: number;
};

function workingSets(exercise: ExerciseBlock) {
  return exercise.sets.filter(set => set.type !== 'warmup' && set.type !== 'approach');
}

function normalizeExerciseKey(exercise: Pick<ExerciseBlock, 'exerciseId' | 'exerciseName'>) {
  return (exercise.exerciseId || exercise.exerciseName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function averageRir(sets: LoggedSet[]) {
  const setsWithRir = sets.filter(set => set.rir !== undefined);
  return setsWithRir.length ? setsWithRir.reduce((total, set) => total + (set.rir ?? 0), 0) / setsWithRir.length : 0;
}

function statsForSets(sets: LoggedSet[]) {
  const bestSet = sets.reduce<LoggedSet | null>((best, set) => {
    if (!best) return set;
    const currentE1rm = estimated1Rm(set);
    const bestE1rm = estimated1Rm(best);
    return currentE1rm > bestE1rm ? set : best;
  }, null);
  return {
    volume: sets.reduce((total, set) => total + setVolumeKg(set), 0),
    sets: sets.length,
    averageRir: averageRir(sets),
    bestE1rm: sets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0),
    bestLoad: sets.reduce((best, set) => Math.max(best, set.loadKg), 0),
    bestReps: bestSet ? primaryRepetitions(bestSet) : 0,
  };
}

function statsForSession(session: WorkoutSession): SessionStats {
  const sets = session.exercises.flatMap(workingSets);
  const stats = statsForSets(sets);
  return {
    cycle: session.cycleNumber ?? 0,
    volume: stats.volume,
    sets: stats.sets,
    averageRir: stats.averageRir,
    bestE1rm: stats.bestE1rm,
    session,
  };
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

function ProgressChart({ title, data, valueLabel }: {
  title: string;
  data: ChartPoint[];
  valueLabel: (value: number) => string;
}) {
  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.cardTitle}>{title}</Text>
      {data.map(item => (
        <View key={item.key} style={styles.chartRow}>
          <Text style={styles.cycleLabel}>{item.label}</Text>
          <View style={styles.barTrack}>
            <View style={[styles.bar, { width: `${Math.max(3, (item.value / max) * 100)}%` as `${number}%` }]} />
          </View>
          <Text style={styles.barValue}>{valueLabel(item.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function AnalyticsScreen({ sessions }: { sessions: WorkoutSession[] }) {
  const [mode, setMode] = useState<'program' | 'exercise'>('program');
  const [selected, setSelected] = useState<ProgramCode>('A1');
  const [selectedExerciseKey, setSelectedExerciseKey] = useState('');

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

  const exerciseSeries = useMemo<ExerciseStats[]>(() => {
    if (!activeExerciseKey) return [];
    return sessions
      .filter(session => session.endedAt)
      .map(session => {
        const matched = session.exercises.filter(exercise => normalizeExerciseKey(exercise) === activeExerciseKey);
        const sets = matched.flatMap(workingSets);
        if (sets.length === 0) return null;
        const stats = statsForSets(sets);
        const programLabel = `${session.name}${session.cycleNumber ? ` · C${session.cycleNumber}` : ''}`;
        return {
          key: session.id + '-' + activeExerciseKey,
          label: activeExerciseName,
          dateLabel: formatDate(session.startedAt),
          programLabel,
          session,
          ...stats,
        };
      })
      .filter((item): item is ExerciseStats => Boolean(item))
      .sort((a, b) => a.session.startedAt.localeCompare(b.session.startedAt));
  }, [activeExerciseKey, activeExerciseName, sessions]);

  if (mode === 'exercise') {
    const latest = exerciseSeries[exerciseSeries.length - 1];
    const previous = exerciseSeries[exerciseSeries.length - 2];
    const first = exerciseSeries[0];
    return (
      <ScrollView contentContainerStyle={commonStyles.screen}>
        <ScreenTitle eyebrow="PROGRESSÃO POR EXERCÍCIO" title="Análises" subtitle="Veja a evolução do mesmo exercício em qualquer treino" />
        <View style={styles.modeTabs}>
          <Chip label="Por treino" selected={false} onPress={() => setMode('program')} />
          <Chip label="Por exercício" selected={true} onPress={() => setMode('exercise')} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {exerciseOptions.map(option => <Chip key={option.key} label={`${option.name} (${option.count})`} selected={activeExerciseKey === option.key} onPress={() => setSelectedExerciseKey(option.key)} />)}
        </ScrollView>

        {latest ? (
          <>
            <View style={styles.grid}>
              <Metric label="ÚLTIMO VOLUME" value={latest.volume.toLocaleString('pt-BR') + ' kg'} detail={formatDelta(previous ? percentChange(latest.volume, previous.volume) : null) + ' vs. anterior'} />
              <Metric label="MELHOR e1RM" value={latest.bestE1rm.toFixed(1) + ' kg'} detail={formatDelta(previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null) + ' vs. anterior'} />
              <Metric label="MELHOR CARGA" value={latest.bestLoad.toFixed(1) + ' kg'} detail={`${latest.bestReps} reps no melhor set`} />
              <Metric label="DESDE O 1º LOG" value={formatDelta(first ? percentChange(latest.volume, first.volume) : null)} detail="variação do volume" />
            </View>

            <ProgressChart
              title={`Volume · ${activeExerciseName}`}
              data={exerciseSeries.map(item => ({ key: item.key + '-volume', label: item.dateLabel, value: item.volume }))}
              valueLabel={value => Math.round(value).toLocaleString('pt-BR') + ' kg'}
            />
            <ProgressChart
              title="Melhor e1RM por ocorrência"
              data={exerciseSeries.map(item => ({ key: item.key + '-e1rm', label: item.dateLabel, value: item.bestE1rm }))}
              valueLabel={value => value.toFixed(1)}
            />

            <View style={commonStyles.card}>
              <Text style={commonStyles.cardTitle}>Logs de {activeExerciseName}</Text>
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
            <Text style={commonStyles.cardTitle}>Ainda não há exercícios registrados</Text>
            <Text style={[commonStyles.muted, { marginTop: 8 }]}>Finalize treinos com sets para liberar a análise por exercício.</Text>
          </View>
        )}
      </ScrollView>
    );
  }

  const latest = selectedSessions[selectedSessions.length - 1];
  const previous = selectedSessions[selectedSessions.length - 2];
  const first = selectedSessions[0];
  const volumeVsPrevious = latest && previous ? percentChange(latest.volume, previous.volume) : null;
  const volumeVsFirst = latest && first ? percentChange(latest.volume, first.volume) : null;
  const e1rmVsPrevious = latest && previous ? percentChange(latest.bestE1rm, previous.bestE1rm) : null;

  const previousExercises = new Map(
    (previous?.session.exercises ?? []).map(exercise => [exercise.exerciseName, exercise]),
  );

  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="PROGRESSÃO POR CICLO" title="Análises" subtitle="Compare por treino ou por exercício" />
      <View style={styles.modeTabs}>
        <Chip label="Por treino" selected={true} onPress={() => setMode('program')} />
        <Chip label="Por exercício" selected={false} onPress={() => setMode('exercise')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {PROGRAM_SEQUENCE.map(code => <Chip key={code} label={code} selected={selected === code} onPress={() => setSelected(code)} />)}
      </ScrollView>

      {latest ? (
        <>
          <View style={styles.grid}>
            <Metric label={`VOLUME · CICLO ${latest.cycle}`} value={latest.volume.toLocaleString('pt-BR') + ' kg'} detail={formatDelta(volumeVsPrevious) + ' vs. anterior'} />
            <Metric label="MELHOR e1RM" value={latest.bestE1rm.toFixed(1) + ' kg'} detail={formatDelta(e1rmVsPrevious) + ' vs. anterior'} />
            <Metric label="RIR MÉDIO" value={latest.averageRir.toFixed(1)} detail={latest.sets + ' sets de trabalho'} />
            <Metric label="DESDE O CICLO 1" value={formatDelta(volumeVsFirst)} detail="variação do volume" />
          </View>

          <ProgressChart
            title={`Volume do ${selected} por ciclo`}
            data={selectedSessions.map(item => ({ key: 'volume-' + item.cycle, label: 'C' + item.cycle, value: item.volume }))}
            valueLabel={value => Math.round(value).toLocaleString('pt-BR') + ' kg'}
          />
          <ProgressChart
            title="Melhor e1RM por ciclo"
            data={selectedSessions.map(item => ({ key: 'e1rm-' + item.cycle, label: 'C' + item.cycle, value: item.bestE1rm }))}
            valueLabel={value => value.toFixed(1)}
          />

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Exercícios no ciclo {latest.cycle}</Text>
            {latest.session.exercises.map(exercise => {
              const currentSets = workingSets(exercise);
              const currentVolume = currentSets.reduce((total, set) => total + setVolumeKg(set), 0);
              const currentE1rm = currentSets.reduce((best, set) => Math.max(best, estimated1Rm(set)), 0);
              const oldExercise = previousExercises.get(exercise.exerciseName);
              const oldVolume = oldExercise ? workingSets(oldExercise).reduce((total, set) => total + setVolumeKg(set), 0) : 0;
              return (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exerciseName}>{exercise.exerciseName}</Text>
                    <Text style={commonStyles.muted}>{currentSets.length} sets · e1RM {currentE1rm ? currentE1rm.toFixed(1) : '—'} kg</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.exerciseVolume}>{currentVolume.toLocaleString('pt-BR')} kg</Text>
                    <Text style={[styles.delta, (percentChange(currentVolume, oldVolume) ?? 0) >= 0 ? styles.positive : styles.negative]}>
                      {formatDelta(percentChange(currentVolume, oldVolume))}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : (
        <View style={commonStyles.card}>
          <Text style={commonStyles.cardTitle}>Ainda não há ciclos concluídos para {selected}</Text>
          <Text style={[commonStyles.muted, { marginTop: 8 }]}>Finalize esse treino para o primeiro ponto do gráfico ser criado. Depois disso, cada novo ciclo aparecerá automaticamente.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  modeTabs: { flexDirection: 'row', gap: 8, marginTop: 4, marginBottom: 2 },
  filters: { gap: 7, paddingVertical: 10, paddingRight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  metric: { width: '48%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 5 },
  metricDetail: { color: colors.textDim, fontSize: 9, marginTop: 5 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  cycleLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', width: 40 },
  barTrack: { flex: 1, height: 18, backgroundColor: colors.elevated, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: colors.accent, borderRadius: 5 },
  barValue: { color: colors.text, fontSize: 9, fontWeight: '700', width: 67, textAlign: 'right' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11, marginTop: 8 },
  exerciseName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  exerciseVolume: { color: colors.text, fontSize: 11, fontWeight: '800' },
  delta: { color: colors.textDim, fontSize: 9, fontWeight: '800', marginTop: 3 },
  positive: { color: colors.success },
  negative: { color: colors.danger },
});
