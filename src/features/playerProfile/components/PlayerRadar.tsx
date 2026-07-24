import { ChartCard } from '@/components/ui/ChartCard';
import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { colors } from '@/constants/tokens';

export interface RadarDatum {
  metric: string;
  value: number;
  [key: string]: string | number;
}

/**
 * Puramente presentacional: pinta lo que le pasen. La normalización (para
 * que ejes de escalas distintas —km vs. km/h vs. Player Load— se puedan ver
 * juntos) se calcula en TabResumen.tsx a partir del propio historial del
 * jugador, no acá — así queda auditable en un solo lugar de dónde sale cada
 * número.
 */
export function PlayerRadar({ data, playerName }: { data: RadarDatum[]; playerName: string }) {
  if (data.length === 0) return null;

  return (
    <ChartCard title="Radar físico" description="Promedios del jugador, normalizados sobre su propio historial de sesiones" height={320}>
      <RadarComparisonChart data={data} dataKey="value" angleKey="metric" name={playerName} color={colors.purple} />
    </ChartCard>
  );
}
