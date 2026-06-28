import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { ExercisePR } from '../types/training';

interface PRCardProps {
  pr: ExercisePR;
}

export function PRCard({ pr }: PRCardProps) {
  const date = new Date(pr.achievedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{pr.exerciseName}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <View style={styles.metrics}>
        <PRMetric label="e1RM" value={pr.bestE1rm.toFixed(1) + ' kg'} />
        <View style={styles.divider} />
        <PRMetric label="CARGA" value={pr.bestWeight.toFixed(1) + ' kg'} />
        <View style={styles.divider} />
        <PRMetric label="VOLUME" value={Math.round(pr.bestVolume).toLocaleString('pt-BR') + ' kg'} />
      </View>
    </View>
  );
}

function PRMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.accentBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  name: { color: colors.text, fontSize: 12, fontWeight: '700', flex: 1 },
  date: { color: colors.textDim, fontSize: 9, marginLeft: 8 },
  metrics: { flexDirection: 'row', alignItems: 'center' },
  metric: { flex: 1, alignItems: 'center' },
  metricLabel: { color: colors.muted, fontSize: 7, fontWeight: '800', textTransform: 'uppercase' },
  metricValue: { color: colors.accent, fontSize: 13, fontWeight: '800', marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: colors.border },
});
