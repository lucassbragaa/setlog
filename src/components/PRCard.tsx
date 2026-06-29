import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';
import type { ExercisePR } from '../types/training';

export function PRCard({ pr }: { pr?: ExercisePR }) {
  if (!pr) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Sem PR ainda</Text>
        <Text style={styles.muted}>Finalize mais sets para liberar recordes deste exercicio.</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>PR HISTORICO</Text>
      <Text style={styles.title}>{pr.exerciseName}</Text>
      <Text style={styles.muted}>{new Date(pr.achievedAt).toLocaleDateString('pt-BR')}</Text>
      <View style={styles.metrics}>
        <Metric label="e1RM" value={pr.bestE1rm.toFixed(1)} />
        <Metric label="CARGA" value={pr.bestWeight.toFixed(1)} />
        <Metric label="VOLUME" value={Math.round(pr.bestVolume).toLocaleString('pt-BR')} />
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.accentBorder, borderWidth: 1, borderRadius: radius.lg, padding: 15, marginTop: 14 },
  eyebrow: { color: colors.textDim, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 5 },
  muted: { color: colors.muted, fontSize: 11, marginTop: 4 },
  metrics: { flexDirection: 'row', marginTop: 14, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  metric: { flex: 1, borderRightWidth: 1, borderRightColor: colors.border, alignItems: 'center' },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: '900' },
  metricLabel: { color: colors.textDim, fontSize: 8, fontWeight: '900', marginTop: 4 },
});
