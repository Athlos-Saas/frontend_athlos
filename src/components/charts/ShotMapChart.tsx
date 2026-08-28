/**
 * ShotMapChart — scatter plot de tiros sobre una cancha simplificada.
 *
 * Usa Recharts ScatterChart. La "cancha" se dibuja con ReferenceLine y
 * ReferenceArea: es una aproximación SVG 0-120 × 0-80 (coordenadas StatsBomb),
 * no un canvas real — suficiente para ubicar los tiros espacialmente sin
 * depender de imágenes externas.
 *
 * Por qué no SVG puro: Recharts ya gestiona el viewport responsivo y el
 * tooltip; agregar un SVG independiente dentro del scatter chart requeriría
 * un wrapper custom. La combinación ReferenceArea + ReferenceLine dentro del
 * mismo ScatterChart es más mantenible y permite que el tooltip siga funcionando
 * sobre los puntos sin hacks de z-index.
 */
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { chartAxisColor, chartTooltipStyle, colors } from '@/constants/tokens';

export interface ShotPoint {
  id: string;
  location_x: number;
  location_y: number;
  /** Campo real de la tabla sb_shots. El alias xg se mantiene por compatibilidad. */
  statsbomb_xg?: number | null;
  xg?: number | null;
  outcome: string; // 'Goal' | 'Saved Shot' | 'Off T' | 'Blocked' | …
  /** player_id (integer) viene de sb_shots; player_name se resuelve externamente. */
  player_name?: string;
  player_id?: number | null;
  minute: number;
  team_name?: string;
}

interface TooltipPayload {
  payload?: ShotPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
}

/** Verde=gol, naranja=atajada, rojo=cualquier otro resultado. */
function shotColor(outcome: string): string {
  if (outcome === 'Goal') return colors.green;
  if (outcome === 'Saved Shot') return colors.orange;
  return colors.red;
}

/** Radio proporcional al xG (mínimo visible = 4px, máximo = 12px). */
function xgRadius(xg: number | null | undefined): number {
  const v = xg ?? 0.05;
  return Math.max(4, Math.min(12, 4 + v * 40));
}

/** Devuelve el valor xG del punto, leyendo statsbomb_xg o xg según cuál esté presente. */
function resolveXg(point: ShotPoint): number | null {
  return point.statsbomb_xg ?? point.xg ?? null;
}

function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: ShotPoint;
}) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload) return null;
  const r = xgRadius(resolveXg(payload));
  const color = shotColor(payload.outcome);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={color}
      fillOpacity={0.75}
      stroke={color}
      strokeWidth={1}
      strokeOpacity={0.9}
    />
  );
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  const xgVal = resolveXg(d);
  const label = d.player_name ?? (d.player_id != null ? `Jugador #${d.player_id}` : '—');
  return (
    <div style={{ ...chartTooltipStyle, padding: '8px 12px', lineHeight: '1.6' }}>
      <p className="font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">
        Min. {d.minute} · {d.outcome}
      </p>
      <p className="text-xs">
        xG: <span className="font-medium">{xgVal != null ? xgVal.toFixed(3) : '—'}</span>
      </p>
    </div>
  );
}

export interface ShotMapChartProps {
  shots: ShotPoint[];
}

export function ShotMapChart({ shots }: ShotMapChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
        style={{ background: 'linear-gradient(180deg, #14532d 0%, #0f3d24 100%)', borderRadius: 8 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.08)" />

        {/* Ejes: coordenadas StatsBomb (x: 0-120 largo, y: 0-80 ancho) */}
        <XAxis
          type="number"
          dataKey="location_x"
          domain={[0, 120]}
          tick={false}
          axisLine={false}
          tickLine={false}
          stroke={chartAxisColor}
        />
        <YAxis
          type="number"
          dataKey="location_y"
          domain={[0, 80]}
          tick={false}
          axisLine={false}
          tickLine={false}
          stroke={chartAxisColor}
          width={0}
        />

        {/* Líneas de cancha simplificada */}
        {/* Línea de medio campo */}
        <ReferenceLine x={60} stroke="rgba(255,255,255,0.30)" strokeWidth={1} />
        {/* Área grande izquierda (x: 0-18, y: 18-62) */}
        <ReferenceLine x={18} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3" strokeWidth={1} />
        {/* Área grande derecha (x: 102-120, y: 18-62) */}
        <ReferenceLine x={102} stroke="rgba(255,255,255,0.25)" strokeDasharray="4 3" strokeWidth={1} />
        {/* Líneas horizontales del área grande */}
        <ReferenceLine y={18} stroke="rgba(255,255,255,0.20)" strokeDasharray="4 3" strokeWidth={1} />
        <ReferenceLine y={62} stroke="rgba(255,255,255,0.20)" strokeDasharray="4 3" strokeWidth={1} />
        {/* Punto de penal izquierdo */}
        <ReferenceLine x={12} stroke="rgba(255,255,255,0.20)" strokeWidth={1} strokeDasharray="1 8" />
        {/* Punto de penal derecho */}
        <ReferenceLine x={108} stroke="rgba(255,255,255,0.20)" strokeWidth={1} strokeDasharray="1 8" />
        {/* Portería izquierda (y: 36-44) */}
        <ReferenceLine y={36} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} segment={[{ x: 0, y: 36 }, { x: 2, y: 36 }]} />
        <ReferenceLine y={44} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} segment={[{ x: 0, y: 44 }, { x: 2, y: 44 }]} />
        {/* Portería derecha */}
        <ReferenceLine y={36} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} segment={[{ x: 118, y: 36 }, { x: 120, y: 36 }]} />
        <ReferenceLine y={44} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} segment={[{ x: 118, y: 44 }, { x: 120, y: 44 }]} />

        <Tooltip content={<CustomTooltip />} cursor={false} />

        <Scatter
          data={shots}
          shape={(props: { cx?: number; cy?: number; payload?: ShotPoint }) => <CustomDot {...props} />}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Leyenda estática de colores de resultado. */
export function ShotMapLegend() {
  const items = [
    { color: colors.green, label: 'Gol' },
    { color: colors.orange, label: 'Atajada' },
    { color: colors.red, label: 'Fallado / Bloqueado' },
  ];
  return (
    <div className="flex items-center gap-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block size-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Grilla de resumen de resultados. */
export function ShotOutcomeSummary({ shots }: { shots: ShotPoint[] }) {
  const goals = shots.filter((s) => s.outcome === 'Goal').length;
  const saved = shots.filter((s) => s.outcome === 'Saved Shot').length;
  const totalXg = shots.reduce((acc, s) => acc + (resolveXg(s) ?? 0), 0);
  return (
    <div className="flex items-center gap-6 text-xs text-muted-foreground">
      <span>
        <span className="font-semibold text-foreground">{shots.length}</span> tiros
      </span>
      <span>
        <span className="font-semibold" style={{ color: colors.green }}>{goals}</span> goles
      </span>
      <span>
        <span className="font-semibold" style={{ color: colors.orange }}>{saved}</span> atajadas
      </span>
      <span>
        xG total: <span className="font-semibold text-foreground">{totalXg.toFixed(2)}</span>
      </span>
    </div>
  );
}
