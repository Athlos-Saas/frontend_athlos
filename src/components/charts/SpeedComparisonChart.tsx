import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface SpeedComparisonDatum {
  date: string;
  gps_speed?: number;
  video_speed?: number;
}

export interface SpeedComparisonChartProps {
  data: SpeedComparisonDatum[];
}

/**
 * Barras agrupadas por fecha: velocidad máxima medida por GPS vs. la
 * estimada por video (percentil 95) el mismo día — cuando ambas existen para
 * la misma fecha quedan una junto a la otra, para comparar directamente.
 */
export function SpeedComparisonChart({ data }: SpeedComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={chartGridColor} vertical={false} />
        <XAxis dataKey="date" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: chartAxisColor }} />
        <Bar dataKey="gps_speed" name="GPS" fill={colors.blue} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="video_speed" name="Video (p95)" fill={colors.purple} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
