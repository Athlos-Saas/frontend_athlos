/**
 * ShotMapChart — mapa de tiros sobre media cancha, dibujado en SVG propio.
 *
 * Antes se usaba un ScatterChart de Recharts con ReferenceLines: mostraba la
 * cancha completa (tiros hacia ambas porterías mezclados) y con 2000 tiros se
 * saturaba y no se leía. Ahora es un SVG de MEDIA cancha (ataque hacia la
 * portería de arriba): todos los tiros se normalizan a esa mitad, la cancha se
 * dibuja con líneas reales (área, área chica, punto de penal, arco, semicírculo)
 * y el punto se colorea por resultado y se dimensiona por xG. Mucho más claro.
 *
 * Coordenadas StatsBomb: x 0-120 (largo), y 0-80 (ancho); arco rival en x=120.
 * Los tiros con x<60 (hacia la otra portería, p. ej. de otro equipo) se
 * reflejan a la mitad atacante para verlos todos juntos.
 */
import { useMemo, useState } from 'react';

import { colors } from '@/constants/tokens';

export interface ShotPoint {
  id: string;
  location_x: number;
  location_y: number;
  statsbomb_xg?: number | null;
  xg?: number | null;
  outcome: string;
  player_name?: string;
  player_id?: number | null;
  minute: number;
  team_name?: string;
}

function shotColor(outcome: string): string {
  if (outcome === 'Goal') return colors.green;
  if (outcome === 'Saved Shot') return colors.orange;
  return colors.red;
}

function xgRadius(xg: number | null | undefined): number {
  const v = xg ?? 0.05;
  return Math.max(3, Math.min(11, 3 + v * 32));
}

function resolveXg(point: ShotPoint): number | null {
  return point.statsbomb_xg ?? point.xg ?? null;
}

// SVG en orientación vertical: media cancha, arco arriba. Se mapea:
//   x StatsBomb (60..120, hacia el arco) → eje Y del SVG (abajo→arriba)
//   y StatsBomb (0..80, ancho)           → eje X del SVG (izq→der)
const W = 340; // ancho SVG (corresponde al ancho de cancha, 80)
const H = 440; // alto SVG (corresponde a media cancha larga, 60)
const PAD = 12;

/** Convierte (x,y) StatsBomb a píxeles SVG, reflejando a la mitad atacante. */
function toPx(sx: number, sy: number): [number, number] {
  // Reflejar tiros de la otra mitad (x<60) hacia la mitad atacante.
  const x = sx < 60 ? 120 - sx : sx;
  const y = sx < 60 ? 80 - sy : sy;
  // x: 60..120 → alto SVG invertido (120 = arriba = arco)
  const py = PAD + (1 - (x - 60) / 60) * (H - 2 * PAD);
  // y: 0..80 → ancho SVG
  const px = PAD + (y / 80) * (W - 2 * PAD);
  return [px, py];
}

export interface ShotMapChartProps {
  shots: ShotPoint[];
}

export function ShotMapChart({ shots }: ShotMapChartProps) {
  const [hover, setHover] = useState<{ shot: ShotPoint; x: number; y: number } | null>(null);

  // Escalas de referencia (bordes del área en coords StatsBomb).
  const [boxLeftX] = useMemo(() => toPx(102, 18), []);
  const [boxRightX] = useMemo(() => toPx(102, 62), []);
  const [, boxTopY] = useMemo(() => toPx(102, 40), []);
  const [, goalLineY] = useMemo(() => toPx(120, 40), []);
  const [sixLeftX] = useMemo(() => toPx(114, 30), []);
  const [sixRightX] = useMemo(() => toPx(114, 50), []);
  const [, sixTopY] = useMemo(() => toPx(114, 40), []);
  const [penX, penY] = useMemo(() => toPx(108, 40), []);
  const [goalPostLX] = useMemo(() => toPx(120, 36), []);
  const [goalPostRX] = useMemo(() => toPx(120, 44), []);

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{ display: 'block' }}>
        {/* Césped */}
        <defs>
          <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#0f5132" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={H} rx={8} fill="url(#pitchGrad)" />
        {/* Franjas de césped */}
        {Array.from({ length: 6 }).map((_, i) => (
          <rect
            key={i}
            x={0}
            y={PAD + (i * (H - 2 * PAD)) / 6}
            width={W}
            height={(H - 2 * PAD) / 6}
            fill={i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'}
          />
        ))}

        {/* Borde de cancha */}
        <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        {/* Línea de fondo inferior (medio campo) */}
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

        {/* Área grande */}
        <rect x={boxLeftX} y={boxTopY} width={boxRightX - boxLeftX} height={goalLineY < boxTopY ? boxTopY - goalLineY : PAD} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.3} />
        {/* Área chica */}
        <rect x={sixLeftX} y={sixTopY} width={sixRightX - sixLeftX} height={sixTopY - goalLineY} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.1} />
        {/* Arco */}
        <line x1={goalPostLX} y1={PAD} x2={goalPostRX} y2={PAD} stroke="#fff" strokeWidth={3} />
        {/* Punto de penal */}
        <circle cx={penX} cy={penY} r={2} fill="rgba(255,255,255,0.8)" />
        {/* Semicírculo del área */}
        <path
          d={`M ${boxLeftX + (boxRightX - boxLeftX) * 0.28} ${boxTopY} A 40 40 0 0 0 ${boxLeftX + (boxRightX - boxLeftX) * 0.72} ${boxTopY}`}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
        />

        {/* Tiros — se pintan los goles al final para que queden encima */}
        {[...shots]
          .sort((a) => (a.outcome === 'Goal' ? 1 : -1))
          .map((s) => {
            const [px, py] = toPx(s.location_x, s.location_y);
            const r = xgRadius(resolveXg(s));
            const color = shotColor(s.outcome);
            return (
              <circle
                key={s.id}
                cx={px}
                cy={py}
                r={r}
                fill={color}
                fillOpacity={0.7}
                stroke={color}
                strokeWidth={s.outcome === 'Goal' ? 2 : 1}
                strokeOpacity={0.95}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHover({ shot: s, x: px, y: py })}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-bg/95 px-3 py-2 text-xs shadow-elevated"
          style={{
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: 'translate(-50%, -120%)',
          }}
        >
          <p className="font-semibold text-foreground">
            {hover.shot.player_name ?? (hover.shot.player_id != null ? `Jugador #${hover.shot.player_id}` : '—')}
          </p>
          <p className="text-muted-foreground">
            Min. {hover.shot.minute} · {hover.shot.outcome}
          </p>
          <p className="text-foreground">
            xG: <span className="font-medium">{(resolveXg(hover.shot) ?? 0).toFixed(3)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Leyenda estática de colores de resultado + tamaño por xG. */
export function ShotMapLegend() {
  const items = [
    { color: colors.green, label: 'Gol' },
    { color: colors.orange, label: 'Atajada' },
    { color: colors.red, label: 'Fallado / Bloqueado' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
          {item.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
        <span className="inline-block size-3 rounded-full bg-muted-foreground" aria-hidden="true" />
        tamaño = xG
      </span>
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
