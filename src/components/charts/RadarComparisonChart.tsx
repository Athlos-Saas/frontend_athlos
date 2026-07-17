import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';

import { chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface RadarComparisonChartProps {
  data: Record<string, number | string>[];
  dataKey: string;
  angleKey: string;
  name: string;
  color?: string;
  maxValue?: number;
}

export function RadarComparisonChart({
  data,
  dataKey,
  angleKey,
  name,
  color = colors.purple,
  maxValue = 100,
}: RadarComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke={chartGridColor} />
        <PolarAngleAxis dataKey={angleKey} tick={{ fill: colors.textSecondary, fontSize: 12 }} />
        <PolarRadiusAxis domain={[0, maxValue]} tick={false} axisLine={false} />
        <Tooltip contentStyle={chartTooltipStyle} />
        <Radar name={name} dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.25} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
