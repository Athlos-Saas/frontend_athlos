import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface TrendLineChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  name: string;
  color?: string;
}

export function TrendLineChart<T extends object>({ data, xKey, yKey, name, color = colors.blue }: TrendLineChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke={chartGridColor} vertical={false} />
        <XAxis dataKey={xKey} stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: chartGridColor }} />
        <Line type="monotone" dataKey={yKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
