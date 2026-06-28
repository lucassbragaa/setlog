import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from '../theme';
import type { SeriesPoint } from '../types/training';

interface LineChartProps {
  data: SeriesPoint[];
  height?: number;
  valueLabel?: (v: number) => string;
  maxPoints?: number;
  title?: string;
}

export function LineChart({ data, height = 140, valueLabel, maxPoints = 50, title }: LineChartProps) {
  const points = useMemo(() => {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    return data.filter((_, i) => i % step === 0 || i === data.length - 1);
  }, [data, maxPoints]);

  const padH = 12;
  const padV = 16;
  const chartW = 320;
  const chartH = height - padV * 2;

  const values = points.map(p => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const coords = points.map((p, i) => ({
    x: padH + (i / Math.max(points.length - 1, 1)) * (chartW - padH * 2),
    y: padV + chartH - ((p.value - minVal) / range) * chartH,
    point: p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = linePath
    + ` L${coords[coords.length - 1].x.toFixed(1)},${(padV + chartH).toFixed(1)}`
    + ` L${coords[0].x.toFixed(1)},${(padV + chartH).toFixed(1)} Z`;

  const last = coords[coords.length - 1];

  if (data.length < 2) {
    return (
      <View style={{ marginTop: 8 }}>
        {title ? <Text style={chartStyles.title}>{title}</Text> : null}
        <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={chartStyles.empty}>Dados insuficientes para o gráfico</Text>
        </View>
      </View>
    );
  }

  const xLabels: { x: number; label: string }[] = [];
  const maxLabels = 5;
  if (coords.length >= 2) {
    const step = Math.max(1, Math.floor((coords.length - 1) / (maxLabels - 1)));
    for (let i = 0; i < coords.length; i += step) {
      xLabels.push({ x: coords[i].x, label: coords[i].point.label });
    }
    const last2 = coords[coords.length - 1];
    if (!xLabels.find(l => l.x === last2.x)) xLabels.push({ x: last2.x, label: last2.point.label });
  }

  return (
    <View style={{ marginTop: 8 }}>
      {title ? <Text style={chartStyles.title}>{title}</Text> : null}
      <Svg width="100%" height={height} viewBox={`0 0 ${chartW} ${height}`}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.3" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#areaGrad)" />
        <Path d={linePath} stroke={colors.accent} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {last && <Circle cx={last.x} cy={last.y} r="4" fill={colors.accent} />}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: padH, marginTop: 2 }}>
        {xLabels.map((l, i) => (
          <Text key={i} style={[chartStyles.axisLabel, { maxWidth: 50, textAlign: i === 0 ? 'left' : i === xLabels.length - 1 ? 'right' : 'center' }]}>{l.label}</Text>
        ))}
      </View>
      {valueLabel && last && (
        <Text style={chartStyles.lastValue}>{valueLabel(last.point.value)}</Text>
      )}
    </View>
  );
}

const chartStyles = {
  title: { color: colors.muted, fontSize: 9, fontWeight: '800' as const, textTransform: 'uppercase' as const, marginBottom: 4 },
  axisLabel: { color: colors.textDim, fontSize: 8, fontWeight: '600' as const },
  lastValue: { color: colors.accent, fontSize: 10, fontWeight: '800' as const, textAlign: 'right' as const, marginTop: 2 },
  empty: { color: colors.textDim, fontSize: 11, textAlign: 'center' as const },
};
