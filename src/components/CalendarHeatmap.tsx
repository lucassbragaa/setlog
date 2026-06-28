import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { CalendarDay } from '../types/training';

const DAYS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

interface CalendarHeatmapProps {
  data: CalendarDay[][];
  cellSize?: number;
  streak?: number;
}

function cellColor(day: CalendarDay): string {
  if (!day.hasWorkout) return colors.elevated;
  if (day.sessionCount >= 2) return colors.accent;
  return colors.accentBorder;
}

export function CalendarHeatmap({ data, cellSize = 22, streak = 0 }: CalendarHeatmapProps) {
  if (data.length === 0) return null;

  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = '';
  data.forEach((week, col) => {
    const firstWorkDay = week.find(d => d.date)?.date ?? week[0].date;
    const d = new Date(firstWorkDay + 'T12:00:00');
    const monthStr = d.toLocaleDateString('pt-BR', { month: 'short' });
    if (monthStr !== lastMonth) {
      monthLabels.push({ col, label: monthStr });
      lastMonth = monthStr;
    }
  });

  const numCols = data.length;
  const totalWidth = numCols * (cellSize + 3);

  return (
    <View style={styles.root}>
      <View style={[styles.grid, { width: totalWidth }]}>
        <View style={styles.monthRow}>
          {monthLabels.map(({ col, label }) => (
            <Text
              key={col + label}
              style={[styles.monthLabel, { left: col * (cellSize + 3) }]}
            >
              {label}
            </Text>
          ))}
        </View>
        <View style={styles.columns}>
          {DAYS.map((day, row) => (
            <View key={row} style={styles.dayLabelRow}>
              <Text style={styles.dayLabel}>{row % 2 === 0 ? day : ''}</Text>
            </View>
          ))}
        </View>
        <View style={styles.weeksRow}>
          {data.map((week, col) => (
            <View key={col} style={styles.weekCol}>
              {week.map((day, row) => (
                <View
                  key={row}
                  style={[
                    styles.cell,
                    { width: cellSize, height: cellSize, backgroundColor: cellColor(day) },
                    day.date === localToday() && styles.today,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>{streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
        </View>
      )}
    </View>
  );
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  grid: { position: 'relative' },
  monthRow: { height: 14, position: 'relative', marginBottom: 3 },
  monthLabel: { position: 'absolute', color: colors.muted, fontSize: 8, fontWeight: '700' },
  columns: { position: 'absolute', left: -18, top: 17, flexDirection: 'column', gap: 3 },
  dayLabelRow: { height: 22 },
  dayLabel: { color: colors.textDim, fontSize: 7, fontWeight: '600' },
  weeksRow: { flexDirection: 'row', gap: 3, marginTop: 17 },
  weekCol: { flexDirection: 'column', gap: 3 },
  cell: { borderRadius: 4 },
  today: { borderWidth: 1.5, borderColor: colors.accent },
  streakRow: { marginTop: 10, alignItems: 'center' },
  streakText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
});
