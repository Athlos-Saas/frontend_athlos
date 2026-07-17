import { CartesianGrid, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle } from '@/constants/tokens';

export interface ScatterSeries {
  name: string;
  color: string;
  data: Array<Record<string, unknown>>;
}

export interface ProfileScatterChartProps {
  series: ScatterSeries[];
  xKey: string;
  xLabel: string;
  yKey: string;
  yLabel: string;
  zKey: string;
  zLabel: string;
}

export function ProfileScatterChart({ series, xKey, xLabel, yKey, yLabel, zKey, zLabel }: ProfileScatterChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart>
        <CartesianGrid stroke={chartGridColor} />
        <XAxis type="number" dataKey={xKey} name={xLabel} stroke={chartAxisColor} fontSize={12} />
        <YAxis type="number" dataKey={yKey} name={yLabel} stroke={chartAxisColor} fontSize={12} />
        <ZAxis type="number" dataKey={zKey} range={[60, 260]} name={zLabel} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={chartTooltipStyle}
          formatter={(value: number, name: string) => [Number(value).toFixed(1), name]}
          labelFormatter={() => ''}
        />
        <Legend formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>} />
        {series.map((s) => (
          <Scatter key={s.name} name={s.name} data={s.data} fill={s.color} />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
