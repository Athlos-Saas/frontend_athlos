/**
 * Formato compartido del "Mercado actual". El backend devuelve valores ya
 * calculados (por 90, %, promedio): acá solo se decide cómo se leen.
 */
import type { MarketMetricDef, MarketMetricKind } from './marketApi';

export function metricKind(catalog: MarketMetricDef[] | undefined, key: string): MarketMetricKind {
  return catalog?.find((metric) => metric.key === key)?.kind ?? 'per90';
}

export function formatMetric(kind: MarketMetricKind, value: number | null | undefined): string {
  if (value == null) return '—';
  if (kind === 'ratio') return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

/**
 * Clase de color por tramo de percentil. Los cortes (80/50/25) son los
 * cuartiles de lectura habitual en scouting ("élite / sobre la media / bajo /
 * muy bajo"); no son un modelo, solo una ayuda visual sobre un número que ya
 * se muestra.
 */
export function percentileTone(pct: number): string {
  if (pct >= 80) return 'bg-success';
  if (pct >= 50) return 'bg-ai';
  if (pct >= 25) return 'bg-warning';
  return 'bg-danger';
}
