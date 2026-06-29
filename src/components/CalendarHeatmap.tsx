import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';
import type { CalendarDay } from '../types/training';

function monthLabel(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

export function CalendarHeatmap({ weeks, cellSize = 14 }: { weeks: CalendarDay[][]; cellSize?: number }) {
  const today = new Date().toISOString().slice(0, 10);
  const dayLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Frequencia</Text>
        <Text style={styles.legend}>12 semanas</Text>
      </View>
      <View style={styles.row}>
        <View style={[styles.dayLabels, { paddingTop: cellSize + 4 }]}>
          {dayLabels.map((label, index) => <Text key={label + index} style={[styles.dayLabel, { height: cellSize }]}>{index % 2 === 0 ? label : ''}</Text>)}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.monthRow}>
              {weeks.map((week, index) => {
                const label = index === 0 || monthLabel(week[0].date) !== monthLabel(weeks[index - 1]?.[0]?.date ?? week[0].date) ? monthLabel(week[0].date) : '';
                return <Text key={week[0].date} style={[styles.month, { width: cellSize + 4 }]}>{label}</Text>;
              })}
            </View>
            <View style={styles.weeksRow}>
              {weeks.map(week => (
                <View key={week[0].date} style={styles.weekColumn}>
                  {week.map(day => {
                    const active = day.sessionCount > 1;
                    return <View key={day.date} style={[styles.cell, { width: cellSize, height: cellSize }, day.hasWorkout && styles.cellWorkout, active && styles.cellActive, day.date === today && styles.today]} />;
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginTop: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  legend: { color: colors.textDim, fontSize: 10, fontWeight: '800' },
  row: { flexDirection: 'row' },
  dayLabels: { width: 16, gap: 4 },
  dayLabel: { color: colors.textDim, fontSize: 8, fontWeight: '800' },
  monthRow: { flexDirection: 'row', height: 18, marginBottom: 4 },
  month: { color: colors.textDim, fontSize: 8, fontWeight: '800' },
  weeksRow: { flexDirection: 'row', gap: 4 },
  weekColumn: { gap: 4 },
  cell: { borderRadius: 4, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border },
  cellWorkout: { backgroundColor: colors.surface, borderColor: colors.accentBorder },
  cellActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  today: { borderColor: colors.accent, borderWidth: 1.5 },
});
