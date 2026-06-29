import { Defs, LinearGradient, Path, Circle, Stop, Svg } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';
import type { SeriesPoint } from '../types/training';

function pointsFor(data: SeriesPoint[], width: number, height: number) {
  const values = data.map(item => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  return data.map((item, index) => ({
    x: data.length === 1 ? width : (index / (data.length - 1)) * width,
    y: height - ((item.value - min) / range) * height,
    item,
  }));
}

export function LineChart({ title, data, valueLabel, height = 150 }: {
  title: string;
  data: SeriesPoint[];
  valueLabel: (value: number) => string;
  height?: number;
}) {
  const width = 320;
  const chartHeight = height;
  if (data.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.empty}><Text style={styles.emptyText}>Precisa de pelo menos 2 logs para desenhar a tendencia.</Text></View>
      </View>
    );
  }

  const points = pointsFor(data, width, chartHeight - 24);
  const line = points.map((point, index) => (index === 0 ? 'M ' : 'L ') + point.x + ' ' + point.y).join(' ');
  const area = line + ' L ' + points[points.length - 1].x + ' ' + chartHeight + ' L 0 ' + chartHeight + ' Z';
  const last = points[points.length - 1];
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.value}>{valueLabel(data[data.length - 1].value)}</Text>
      </View>
      <Svg width="100%" height={chartHeight} viewBox={'0 0 ' + width + ' ' + chartHeight}>
        <Defs>
          <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.26" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#area)" />
        <Path d={line} fill="none" stroke={colors.accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={last.x} cy={last.y} r={5} fill={colors.background} stroke={colors.accent} strokeWidth={2.5} />
      </Svg>
      <View style={styles.labels}>
        {data.map((item, index) => index % labelEvery === 0 || index === data.length - 1 ? <Text key={item.date + index} style={styles.label}>{item.label}</Text> : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginTop: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '900' },
  value: { color: colors.text, fontSize: 13, fontWeight: '900' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  label: { color: colors.textDim, fontSize: 9, fontWeight: '700' },
  empty: { minHeight: 120, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', padding: 14, marginTop: 10 },
  emptyText: { color: colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
