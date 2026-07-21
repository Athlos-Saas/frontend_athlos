import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface BenchmarkBarChartDatum {
  metric: string;
  team_value: number | null;
  conference_value: number | null;
}

export interface BenchmarkBarChartProps {
  data: BenchmarkBarChartDatum[];
  teamLabel: string;
  conferenceLabel?: string;
}

/**
 * Barras agrupadas equipo vs. media de conferencia por métrica. A propósito
 * no normaliza a 0-100 (como RadarComparisonChart): las métricas de este
 * reporte tienen escalas muy distintas (ej. gaa vs. sv%) y normalizar
 * distorsionaría la comparación real de valores.
 */
export function BenchmarkBarChart({ data, teamLabel, conferenceLabel = 'Media conferencia' }: BenchmarkBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={chartGridColor} vertical={false} />
        <XAxis dataKey="metric" stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Legend wrapperStyle={{ fontSize: 12, color: chartAxisColor }} />
        <Bar dataKey="team_value" name={teamLabel} fill={colors.blue} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="conference_value" name={conferenceLabel} fill={colors.purple} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}
