import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PROGRAM_SEQUENCE, type ProgramCode } from '../data/cycles';
import { colors } from '../theme';
import type { ExerciseBlock, WorkoutSession } from '../types/training';
import { Chip, commonStyles, ScreenTitle } from '../ui';

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

function statsForSession(session: WorkoutSession): SessionStats {
  const sets = session.exercises.flatMap(workingSets);
  const setsWithRir = sets.filter(set => set.rir !== undefined);
  return {
    cycle: session.cycleNumber ?? 0,
    volume: sets.reduce((total, set) => total + set.loadKg * set.repetitions, 0),
    sets: sets.length,
    averageRir: setsWithRir.length ? setsWithRir.reduce((total, set) => total + (set.rir ?? 0), 0) / setsWithRir.length : 0,
    bestE1rm: sets.reduce((best, set) => Math.max(best, set.loadKg * (1 + set.repetitions / 30)), 0),
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

function ProgressChart({ title, data, valueLabel }: {
  title: string;
  data: { cycle: number; value: number }[];
  valueLabel: (value: number) => string;
}) {
  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <View style={commonStyles.card}>
      <Text style={commonStyles.cardTitle}>{title}</Text>
      {data.map(item => (
        <View key={item.cycle} style={styles.chartRow}>
          <Text style={styles.cycleLabel}>C{item.cycle}</Text>
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

  const previousExercises = new Map(
    (previous?.session.exercises ?? []).map(exercise => [exercise.exerciseName, exercise]),
  );

  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="PROGRESSÃO POR CICLO" title="Análises" subtitle="Compare o mesmo treino ao longo dos 16 ciclos" />

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
            data={selectedSessions.map(item => ({ cycle: item.cycle, value: item.volume }))}
            valueLabel={value => Math.round(value).toLocaleString('pt-BR') + ' kg'}
          />
          <ProgressChart
            title="Melhor e1RM por ciclo"
            data={selectedSessions.map(item => ({ cycle: item.cycle, value: item.bestE1rm }))}
            valueLabel={value => value.toFixed(1)}
          />

          <View style={commonStyles.card}>
            <Text style={commonStyles.cardTitle}>Exercícios no ciclo {latest.cycle}</Text>
            {latest.session.exercises.map(exercise => {
              const currentSets = workingSets(exercise);
              const currentVolume = currentSets.reduce((total, set) => total + set.loadKg * set.repetitions, 0);
              const currentE1rm = currentSets.reduce((best, set) => Math.max(best, set.loadKg * (1 + set.repetitions / 30)), 0);
              const oldExercise = previousExercises.get(exercise.exerciseName);
              const oldVolume = oldExercise ? workingSets(oldExercise).reduce((total, set) => total + set.loadKg * set.repetitions, 0) : 0;
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
  filters: { gap: 7, paddingVertical: 10, paddingRight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  metric: { width: '48%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: 5 },
  metricDetail: { color: colors.textDim, fontSize: 9, marginTop: 5 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  cycleLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', width: 24 },
  barTrack: { flex: 1, height: 18, backgroundColor: colors.elevated, borderRadius: 5, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: colors.accent, borderRadius: 5 },
  barValue: { color: colors.text, fontSize: 9, fontWeight: '700', width: 67, textAlign: 'right' },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11, marginTop: 8 },
  exerciseName: { color: colors.text, fontSize: 12, fontWeight: '700' },
  exerciseVolume: { color: colors.text, fontSize: 11, fontWeight: '800' },
  delta: { fontSize: 9, fontWeight: '800', marginTop: 3 },
  positive: { color: colors.success },
  negative: { color: colors.danger },
});
