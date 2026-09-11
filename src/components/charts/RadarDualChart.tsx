/**
 * RadarDualChart — radar con dos series superpuestas para comparar dos
 * jugadores (o un jugador contra un promedio). Cada punto del array trae
 * `attribute`, `a` y `b`.
 */
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Legend, Tooltip } from 'recharts';

import { chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface RadarDualDatum {
  attribute: string;
  a: number;
  b: number;
}

export interface RadarDualChartProps {
  data: RadarDualDatum[];
  nameA: string;
  nameB: string;
  colorA?: string;
  colorB?: string;
  maxValue?: number;
}

export function RadarDualChart({
  data,
  nameA,
  nameB,
  colorA = colors.purple,
  colorB = colors.blue,
  maxValue = 100,
}: RadarDualChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="70%">
        <PolarGrid stroke={chartGridColor} />
        <PolarAngleAxis dataKey="attribute" tick={{ fill: colors.textSecondary, fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, maxValue]} tick={false} axisLine={false} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Radar name={nameA} dataKey="a" stroke={colorA} fill={colorA} fillOpacity={0.25} strokeWidth={2} />
        <Radar name={nameB} dataKey="b" stroke={colorB} fill={colorB} fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
