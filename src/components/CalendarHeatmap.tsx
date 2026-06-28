import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { CalendarDay } from '../types/training';

const DAY_LABELS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const GAP = 3;
const LABEL_COL_WIDTH = 16;

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

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarHeatmap({ data, cellSize = 22, streak = 0 }: CalendarHeatmapProps) {
  if (data.length === 0) return null;

  const today = localToday();

  const monthLabels: (string | null)[] = [];
  let lastMonth = '';
  data.forEach(week => {
    const firstDay = week.find(d => d.date)?.date ?? week[0].date;
    const monthStr = new Date(firstDay + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' });
    if (monthStr !== lastMonth) {
      monthLabels.push(monthStr);
      lastMonth = monthStr;
    } else {
      monthLabels.push(null);
    }
  });

  return (
    <View>
      <View style={styles.row}>
        <View style={{ width: LABEL_COL_WIDTH, marginTop: 18 }}>
          {DAY_LABELS.map((label, i) => (
            <View key={i} style={{ height: cellSize + GAP, justifyContent: 'center' }}>
              <Text style={styles.dayLabel}>{i % 2 === 0 ? label : ''}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.monthRow}>
              {data.map((_, col) => (
                <View key={col} style={{ width: cellSize, marginRight: col < data.length - 1 ? GAP : 0 }}>
                  {monthLabels[col] ? <Text style={styles.monthLabel}>{monthLabels[col]}</Text> : null}
                </View>
              ))}
            </View>

            <View style={styles.weeksRow}>
              {data.map((week, col) => (
                <View key={col} style={{ marginRight: col < data.length - 1 ? GAP : 0 }}>
                  {week.map((day, row) => (
                    <View
                      key={row}
                      style={[
                        styles.cell,
                        { width: cellSize, height: cellSize, marginBottom: row < week.length - 1 ? GAP : 0, backgroundColor: cellColor(day) },
                        day.date === today && styles.today,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakText}>{streak} {streak === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  dayLabel: { color: colors.textDim, fontSize: 8, fontWeight: '600', textAlign: 'right', paddingRight: 4 },
  monthRow: { flexDirection: 'row', height: 16, marginBottom: 2 },
  monthLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' },
  weeksRow: { flexDirection: 'row' },
  cell: { borderRadius: 4 },
  today: { borderWidth: 1.5, borderColor: colors.accent },
  streakRow: { marginTop: 10, paddingLeft: LABEL_COL_WIDTH },
  streakText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
});
