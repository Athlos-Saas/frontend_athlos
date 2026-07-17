import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface ComparisonBarChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  name: string;
  color?: string;
}

export function ComparisonBarChart<T extends object>({ data, xKey, yKey, name, color = colors.blue }: ComparisonBarChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke={chartGridColor} vertical={false} />
        <XAxis dataKey={xKey} stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey={yKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}
