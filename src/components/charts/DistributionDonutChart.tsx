import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { chartTooltipStyle } from '@/constants/tokens';

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

export function DistributionDonutChart({ data }: { data: DonutDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={2} strokeWidth={0}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip contentStyle={chartTooltipStyle} />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
