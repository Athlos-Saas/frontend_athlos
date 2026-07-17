import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface TrendAreaChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  name: string;
  color?: string;
}

export function TrendAreaChart<T extends object>({ data, xKey, yKey, name, color = colors.blue }: TrendAreaChartProps<T>) {
  const gradientId = `area-gradient-${yKey}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={chartGridColor} vertical={false} />
        <XAxis dataKey={xKey} stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} width={32} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: chartGridColor }} />
        <Area type="monotone" dataKey={yKey} name={name} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
