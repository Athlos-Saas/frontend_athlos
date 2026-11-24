import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface TrendLineChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  yKey: keyof T & string;
  name: string;
  color?: string;
  /** Línea horizontal de referencia (p. ej. la línea base personal de un atleta). */
  referenceY?: number | null;
  referenceLabel?: string;
  /** Dominio fijo del eje Y (p. ej. [0, 100] para escalas normalizadas). Sin él, Recharts lo ajusta a los datos. */
  yDomain?: [number, number];
  /** Unir puntos a través de días sin dato (series diarias con huecos). */
  connectNulls?: boolean;
}

export function TrendLineChart<T extends object>({
  data,
  xKey,
  yKey,
  name,
  color = colors.blue,
  referenceY,
  referenceLabel,
  yDomain,
  connectNulls = false,
}: TrendLineChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid stroke={chartGridColor} vertical={false} />
        <XAxis dataKey={xKey} stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} />
        <YAxis stroke={chartAxisColor} fontSize={12} tickLine={false} axisLine={false} width={32} domain={yDomain} />
        <Tooltip contentStyle={chartTooltipStyle} cursor={{ stroke: chartGridColor }} />
        {referenceY !== null && referenceY !== undefined && (
          <ReferenceLine
            y={referenceY}
            stroke={colors.textSecondary}
            strokeDasharray="4 4"
            label={referenceLabel ? { value: referenceLabel, fill: colors.textSecondary, fontSize: 11, position: 'insideTopRight' } : undefined}
          />
        )}
        <Line type="monotone" dataKey={yKey} name={name} stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls={connectNulls} />
      </LineChart>
    </ResponsiveContainer>
  );
}
