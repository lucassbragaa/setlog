import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { WorkoutSession } from '../types/training';
import { commonStyles, ScreenTitle } from '../ui';

export function AnalyticsScreen({ sessions }: { sessions: WorkoutSession[] }) {
  const sets = sessions.flatMap(session => session.exercises.flatMap(exercise => exercise.sets.map(set => ({ ...set, exerciseName: exercise.exerciseName }))));
  const working = sets.filter(set => set.type !== 'warmup');
  const volume = working.reduce((total, set) => total + set.loadKg * set.repetitions, 0);
  const averageRir = working.length ? working.reduce((total, set) => total + (set.rir ?? 0), 0) / working.length : 0;
  const best = working.reduce<{ value: number; label: string }>((current, set) => {
    const value = set.loadKg * (1 + set.repetitions / 30);
    return value > current.value ? { value, label: set.exerciseName } : current;
  }, { value: 0, label: '—' });
  const byExercise = Object.values(working.reduce<Record<string, { name: string; volume: number; sets: number }>>((map, set) => {
    const item = map[set.exerciseName] ?? { name: set.exerciseName, volume: 0, sets: 0 };
    item.volume += set.loadKg * set.repetitions; item.sets += 1; map[set.exerciseName] = item; return map;
  }, {})).sort((a, b) => b.volume - a.volume);

  return (
    <ScrollView contentContainerStyle={commonStyles.screen}>
      <ScreenTitle eyebrow="PERFORMANCE" title="Análises" subtitle="Sessões concluídas + treino atual" />
      <View style={styles.grid}>
        <Metric label="VOLUME TOTAL" value={volume.toLocaleString('pt-BR') + ' kg'} />
        <Metric label="SETS DE TRABALHO" value={String(working.length)} />
        <Metric label="RIR MÉDIO" value={averageRir.toFixed(1)} />
        <Metric label="MELHOR e1RM" value={best.value ? best.value.toFixed(1) + ' kg' : '—'} />
      </View>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Volume por exercício</Text>
        {byExercise.length === 0 ? <Text style={[commonStyles.muted, { marginTop: 10 }]}>Registre sets para gerar análises.</Text> : byExercise.map(item => (
          <View key={item.name} style={styles.line}>
            <View style={{ flex: 1 }}><Text style={styles.name}>{item.name}</Text><Text style={commonStyles.muted}>{item.sets} sets</Text></View>
            <Text style={styles.value}>{item.volume.toLocaleString('pt-BR')} kg</Text>
          </View>
        ))}
      </View>
      <View style={commonStyles.card}><Text style={commonStyles.cardTitle}>Destaque atual</Text><Text style={[styles.highlight, { marginTop: 8 }]}>{best.label}</Text><Text style={commonStyles.muted}>e1RM estimado pela fórmula de Epley. Use como tendência, não como verdade absoluta.</Text></View>
    </ScrollView>
  );
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  metric: { width: '48%', backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 19, fontWeight: '800', marginTop: 5 },
  line: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 11, marginTop: 8 },
  name: { color: colors.text, fontSize: 13, fontWeight: '700' },
  value: { color: colors.accent, fontWeight: '800', fontSize: 13 },
  highlight: { color: colors.accent, fontSize: 18, fontWeight: '800' },
});
