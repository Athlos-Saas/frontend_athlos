import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';

import { colors } from '@/constants/tokens';

export interface GaugeChartProps {
  value: number;
  max?: number;
  label?: string;
  color?: string;
  formatValue?: (value: number) => string;
}

export function GaugeChart({ value, max = 100, label, color = colors.blue, formatValue }: GaugeChartProps) {
  const clamped = Math.min(max, Math.max(0, value));
  const data = [
    { name: 'value', value: clamped },
    { name: 'rest', value: max - clamped },
  ];

  return (
    <div className="relative flex h-full flex-col items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={200}
            endAngle={-20}
            innerRadius="70%"
            outerRadius="100%"
            cy="75%"
            stroke="none"
          >
            <Cell fill={color} />
            <Cell fill={colors.border} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-2 text-center">
        <p className="text-3xl font-bold text-foreground">{formatValue ? formatValue(clamped) : clamped}</p>
        {label && <p className="text-xs text-muted-foreground">{label}</p>}
      </div>
    </div>
  );
}
