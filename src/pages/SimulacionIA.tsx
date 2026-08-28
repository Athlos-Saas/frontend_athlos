/**
 * SimulacionIA — Módulo de simulación con IA para análisis táctico.
 *
 * Pestañas:
 *  1. "xG Interactivo"  — Clic en la cancha → calcula xG situacional vía ML.
 *  2. "Simular Jugada"  — Secuencia de pases/conducciones/tiros con flechas.
 *  3. "11 Ideal"        — Sugiere la alineación óptima + benchmark élite.
 *
 * Convenciones del proyecto:
 *  - Texto vía i18n (namespace 'simulacion-cluster').
 *  - Estado de página: null=cargando, data=render, error=ErrorState.
 *  - backendFetch para endpoints FastAPI; supabase NO se usa (datos vienen del backend).
 *  - Coordenadas de cancha: StatsBomb 0–120 (largo) × 0–80 (ancho), origen en
 *    la esquina inferior izquierda mirando desde el ataque.
 *  - Específico de fútbol por diseño — frontend soccerspecific. La deuda de
 *    multi-deporte está documentada en CLAUDE.md y acotada a este componente.
 */
import { useCallback, useRef, useState } from 'react';
import { Gamepad2, Target, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { getBackendUrl, computeSituationalXg, simulatePlay, suggestBestXi, benchmarkRoster } from '@/lib/backendApi';
import { toast } from '@/store/toastStore';
import { colors } from '@/constants/tokens';
import type { XgResult, SimulatePlayResult, PlayAction } from '@/lib/backendApi';
import type { TrainingResult } from '@/lib/backendApi';

// ---------------------------------------------------------------------------
// Constantes del campo (coordenadas StatsBomb)
// Origen: esquina inferior izquierda. X crece hacia la derecha (portería a x=120).
// Y crece hacia arriba. La cancha completa es 120×80; mostramos la mitad atacante:
// x ∈ [60, 120], y ∈ [0, 80].
// ---------------------------------------------------------------------------

/** Dimensiones del SVG visible (píxeles). */
const SVG_W = 600;
const SVG_H = 400;

/** Rango de coordenadas StatsBomb que mapea al SVG.
 * Mostramos la mitad atacante: X de 60 a 120, Y de 0 a 80. */
const SB_X_MIN = 60;
const SB_X_MAX = 120;
const SB_Y_MIN = 0;
const SB_Y_MAX = 80;

/** Convierte coordenada StatsBomb → píxel SVG.
 * El eje Y de StatsBomb va de abajo a arriba, el SVG de arriba a abajo — hay
 * que invertir Y para que la portería aparezca arriba. */
function sbToPx(sbX: number, sbY: number): [number, number] {
  const px = ((sbX - SB_X_MIN) / (SB_X_MAX - SB_X_MIN)) * SVG_W;
  const py = (1 - (sbY - SB_Y_MIN) / (SB_Y_MAX - SB_Y_MIN)) * SVG_H;
  return [px, py];
}

/** Convierte píxel SVG (relativo al elemento) → coordenada StatsBomb. */
function pxToSb(px: number, py: number, rect: DOMRect): [number, number] {
  const relX = px - rect.left;
  const relY = py - rect.top;
  const sbX = SB_X_MIN + (relX / SVG_W) * (SB_X_MAX - SB_X_MIN);
  // SVG Y → StatsBomb Y invertido
  const sbY = SB_Y_MIN + (1 - relY / SVG_H) * (SB_Y_MAX - SB_Y_MIN);
  return [
    Math.max(SB_X_MIN, Math.min(SB_X_MAX, sbX)),
    Math.max(SB_Y_MIN, Math.min(SB_Y_MAX, sbY)),
  ];
}

// ---------------------------------------------------------------------------
// SVG de la cancha (media cancha atacante, orientación horizontal)
// Líneas de referencia: área penal, área pequeña, punto penal, arco.
// ---------------------------------------------------------------------------

function PitchSvg({
  children,
  onClick,
  svgRef,
  className,
}: {
  children?: React.ReactNode;
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  svgRef?: React.RefObject<SVGSVGElement>;
  className?: string;
}) {
  // Posiciones de marcas en píxeles (calculadas desde coordenadas SB reales)
  // Portería: x=120, y=36–44 en SB → necesitamos mapear
  const [, goalTopPy] = sbToPx(120, 44);
  const [, goalBotPy] = sbToPx(120, 36);
  const goalWidth = 5; // grosor visual del arco

  // Área penal: x=102–120, y=18–62
  const [penBoxLeft] = sbToPx(102, 0);
  const [, penBoxTop] = sbToPx(0, 62);
  const [, penBoxBot] = sbToPx(0, 18);
  const penBoxWidth = SVG_W - penBoxLeft;
  const penBoxHeight = penBoxBot - penBoxTop;

  // Área pequeña: x=114–120, y=30–50
  const [smallBoxLeft] = sbToPx(114, 0);
  const [, smallBoxTop] = sbToPx(0, 50);
  const [, smallBoxBot] = sbToPx(0, 30);
  const smallBoxWidth = SVG_W - smallBoxLeft;
  const smallBoxHeight = smallBoxBot - smallBoxTop;

  // Punto penal: x=108, y=40
  const [penPx, penPy] = sbToPx(108, 40);

  // Línea de medio campo
  const [midX] = sbToPx(60, 0);

  // Semicírculo del área (radio 10 yardas SB desde el punto penal, proyectado)
  // Aproximación: arc en SVG centrado en el punto penal
  const penPxExact = ((108 - SB_X_MIN) / (SB_X_MAX - SB_X_MIN)) * SVG_W;
  const penPyExact = (1 - (40 - SB_Y_MIN) / (SB_Y_MAX - SB_Y_MIN)) * SVG_H;
  // Radio en píxeles: 10 yardas SB → 10/60 * SVG_W
  const arcRX = (10 / (SB_X_MAX - SB_X_MIN)) * SVG_W;
  const arcRY = (10 / (SB_Y_MAX - SB_Y_MIN)) * SVG_H;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height="100%"
      onClick={onClick}
      style={{ cursor: onClick ? 'crosshair' : 'default', userSelect: 'none' }}
      className={className}
      aria-label="Media cancha interactiva"
    >
      {/* Fondo del campo */}
      <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#1a3a1a" rx={8} />

      {/* Líneas de hierba alternadas (decorativas) */}
      {Array.from({ length: 8 }).map((_, i) => (
        <rect
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          x={(i * SVG_W) / 8}
          y={0}
          width={SVG_W / 8}
          height={SVG_H}
          fill={i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'}
        />
      ))}

      {/* Línea de medio campo (borde izquierdo del SVG ya que muestra x=60) */}
      <line x1={midX} y1={0} x2={midX} y2={SVG_H} stroke="rgba(255,255,255,0.5)" strokeWidth={2} />

      {/* Área penal */}
      <rect
        x={penBoxLeft}
        y={penBoxTop}
        width={penBoxWidth}
        height={penBoxHeight}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={1.5}
      />

      {/* Área pequeña */}
      <rect
        x={smallBoxLeft}
        y={smallBoxTop}
        width={smallBoxWidth}
        height={smallBoxHeight}
        fill="none"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth={1.5}
      />

      {/* Semicírculo del área penal (solo la parte que queda fuera del área) */}
      <ellipse
        cx={penPxExact}
        cy={penPyExact}
        rx={arcRX}
        ry={arcRY}
        fill="none"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={1.5}
        clipPath="url(#outsidePenBox)"
      />
      <defs>
        <clipPath id="outsidePenBox">
          <rect x={0} y={0} width={penBoxLeft} height={SVG_H} />
        </clipPath>
      </defs>

      {/* Punto penal */}
      <circle cx={penPx} cy={penPy} r={3} fill="rgba(255,255,255,0.7)" />

      {/* Arco (portería) — línea gruesa en el borde derecho */}
      <rect
        x={SVG_W - goalWidth}
        y={goalTopPy}
        width={goalWidth}
        height={goalBotPy - goalTopPy}
        fill="rgba(255,255,255,0.9)"
        rx={2}
      />
      {/* Línea de gol */}
      <line x1={SVG_W} y1={0} x2={SVG_W} y2={SVG_H} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

      {/* Línea de fondo */}
      <line x1={0} y1={0} x2={0} y2={SVG_H} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
      <line x1={0} y1={0} x2={SVG_W} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
      <line x1={0} y1={SVG_H} x2={SVG_W} y2={SVG_H} stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />

      {/* Etiqueta del arco */}
      <text x={SVG_W - 8} y={goalTopPy - 6} fill="rgba(255,255,255,0.5)" fontSize={9} textAnchor="end">
        ARCO
      </text>

      {/* Contenido adicional (tiros, secuencias, etc.) */}
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pestaña 1: xG Interactivo
// ---------------------------------------------------------------------------

type XgLoadState = 'idle' | 'loading' | 'error' | 'ready';

function XgTab({ orgId: _orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);

  const [shotPos, setShotPos] = useState<[number, number] | null>(null); // StatsBomb coords
  const [shotPxPos, setShotPxPos] = useState<[number, number] | null>(null); // SVG pixel coords
  const [bodyPart, setBodyPart] = useState('right_foot');
  const [shotType, setShotType] = useState('open_play');
  const [underPressure, setUnderPressure] = useState(false);

  const [result, setResult] = useState<XgResult | null>(null);
  const [loadState, setLoadState] = useState<XgLoadState>('idle');

  const backendUrl = getBackendUrl();

  const handlePitchClick = useCallback(
    async (e: React.MouseEvent<SVGSVGElement>) => {
      if (!backendUrl) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const [sbX, sbY] = pxToSb(e.clientX, e.clientY, rect);
      const [pxX, pxY] = sbToPx(sbX, sbY);

      setShotPos([sbX, sbY]);
      setShotPxPos([pxX, pxY]);
      setLoadState('loading');
      setResult(null);

      try {
        const data = await computeSituationalXg({
          location_x: sbX,
          location_y: sbY,
          body_part: bodyPart,
          shot_type: shotType,
          under_pressure: underPressure,
        });
        setResult(data);
        setLoadState('ready');
      } catch (err) {
        toast({
          title: t('simulacion.xg.errorTitle', 'No se pudo calcular el xG'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'danger',
        });
        setLoadState('error');
      }
    },
    [backendUrl, bodyPart, shotType, underPressure, t],
  );

  const handleReset = () => {
    setShotPos(null);
    setShotPxPos(null);
    setResult(null);
    setLoadState('idle');
  };

  // Color del tiro según xG
  const shotColor =
    result == null
      ? colors.blue
      : result.xg >= 0.3
        ? colors.green
        : result.xg >= 0.1
          ? colors.orange
          : colors.red;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* Cancha interactiva */}
      <div className="space-y-3">
        {/* Controles */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">{t('simulacion.xg.bodyPart', 'Parte del cuerpo')}</label>
            <Select value={bodyPart} onValueChange={setBodyPart}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="right_foot">{t('simulacion.xg.bodyPartFoot', 'Pie derecho')}</SelectItem>
                <SelectItem value="left_foot">{t('simulacion.xg.bodyPartLeftFoot', 'Pie izquierdo')}</SelectItem>
                <SelectItem value="head">{t('simulacion.xg.bodyPartHead', 'Cabeza')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground">{t('simulacion.xg.shotType', 'Tipo de tiro')}</label>
            <Select value={shotType} onValueChange={setShotType}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_play">{t('simulacion.xg.shotTypeOpen', 'Juego abierto')}</SelectItem>
                <SelectItem value="penalty">{t('simulacion.xg.shotTypePenalty', 'Penal')}</SelectItem>
                <SelectItem value="free_kick">{t('simulacion.xg.shotTypeFreeKick', 'Tiro libre')}</SelectItem>
                <SelectItem value="corner">{t('simulacion.xg.shotTypeCorner', 'Córner')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="xg-pressure"
              checked={underPressure}
              onCheckedChange={setUnderPressure}
            />
            <label htmlFor="xg-pressure" className="cursor-pointer text-xs text-muted-foreground">
              {t('simulacion.xg.underPressure', 'Bajo presión')}
            </label>
          </div>

          {shotPos && (
            <Button variant="secondary" size="sm" onClick={handleReset}>
              {t('simulacion.xg.reset', 'Limpiar')}
            </Button>
          )}
        </div>

        {/* SVG de la cancha */}
        <div className="relative overflow-hidden rounded-lg border border-border">
          {!backendUrl && (
            <div className="absolute inset-x-0 top-0 z-10 bg-warning/10 px-3 py-2 text-xs text-warning">
              {t('simulacion.noBackend', 'VITE_API_URL no está configurado.')}
            </div>
          )}
          <PitchSvg
            svgRef={svgRef}
            onClick={backendUrl ? handlePitchClick : undefined}
          >
            {/* Marcador del tiro */}
            {shotPxPos && (
              <g>
                {/* Línea hacia la portería */}
                <line
                  x1={shotPxPos[0]}
                  y1={shotPxPos[1]}
                  x2={SVG_W - 2}
                  y2={SVG_H / 2}
                  stroke={shotColor}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.6}
                />
                {/* Punto de tiro */}
                <circle
                  cx={shotPxPos[0]}
                  cy={shotPxPos[1]}
                  r={loadState === 'loading' ? 7 : 9}
                  fill={shotColor}
                  opacity={loadState === 'loading' ? 0.5 : 0.9}
                  stroke="white"
                  strokeWidth={2}
                />
                {result && (
                  <text
                    x={shotPxPos[0]}
                    y={shotPxPos[1] - 14}
                    textAnchor="middle"
                    fill="white"
                    fontSize={11}
                    fontWeight="bold"
                  >
                    {(result.xg * 100).toFixed(1)}%
                  </text>
                )}
              </g>
            )}

            {/* Instrucción cuando no hay tiro */}
            {!shotPos && (
              <text
                x={SVG_W / 2 - 60}
                y={SVG_H / 2}
                fill="rgba(255,255,255,0.35)"
                fontSize={13}
                textAnchor="middle"
              >
                {t('simulacion.xg.clickPrompt', 'Haz clic para calcular xG')}
              </text>
            )}
          </PitchSvg>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {t('simulacion.xg.pitchLabel', 'Media cancha interactiva — coordenadas StatsBomb (0–120 × 0–80)')}
        </p>
      </div>

      {/* Panel de resultados */}
      <div className="space-y-4">
        {loadState === 'idle' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Target className="mb-3 size-10 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {t('simulacion.xg.clickPrompt', 'Haz clic en la cancha para calcular el xG')}
              </p>
            </CardContent>
          </Card>
        )}

        {loadState === 'loading' && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {loadState === 'error' && (
          <ErrorState
            onRetry={() => {
              if (shotPos) {
                const fakeEvent = {
                  clientX: 0,
                  clientY: 0,
                  currentTarget: svgRef.current as unknown as SVGSVGElement,
                } as React.MouseEvent<SVGSVGElement>;
                void handlePitchClick(fakeEvent);
              }
            }}
          />
        )}

        {loadState === 'ready' && result && (
          <>
            {/* xG principal */}
            <Card className="border-ai/20 bg-card">
              <CardContent className="pt-5">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('simulacion.xg.xgLabel', 'xG')}
                  </p>
                  <p
                    className="text-5xl font-bold tracking-tight"
                    style={{
                      color:
                        result.xg >= 0.3
                          ? colors.green
                          : result.xg >= 0.1
                            ? colors.orange
                            : colors.red,
                    }}
                  >
                    {result.xg.toFixed(3)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('simulacion.xg.xgPercent', 'Probabilidad de gol')}:{' '}
                    <strong className="text-foreground">{result.xg_percent.toFixed(1)}%</strong>
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Datos secundarios */}
            <Card>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('simulacion.xg.distance', 'Distancia')}</span>
                  <span className="font-medium">
                    {result.distance_yards.toFixed(1)} {t('simulacion.xg.yards', 'yardas')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t('simulacion.xg.zone', 'Zona')}</span>
                  <Badge variant="ai">{result.zone}</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Multiplicadores */}
            {result.multipliers && Object.keys(result.multipliers).length > 0 && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t('simulacion.xg.multipliers', 'Factores multiplicadores')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(result.multipliers).map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{key}</span>
                      <span
                        className="font-mono font-medium"
                        style={{ color: val >= 1 ? colors.green : colors.orange }}
                      >
                        ×{val.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Posición del tiro */}
            {shotPos && (
              <p className="text-center text-xs text-muted-foreground">
                {t('simulacion.xg.shotPlaced', 'Tiro colocado')}:{' '}
                <span className="font-mono">
                  ({shotPos[0].toFixed(1)}, {shotPos[1].toFixed(1)})
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña 2: Simular Jugada
// ---------------------------------------------------------------------------

type ActionMode = 'pass' | 'dribble' | 'shot' | null;

interface SequencePoint {
  sbX: number;
  sbY: number;
  pxX: number;
  pxY: number;
  actionType: 'pass' | 'dribble' | 'shot';
  underPressure: boolean;
}

function probColor(p: number): string {
  if (p >= 0.7) return colors.green;
  if (p >= 0.4) return colors.orange;
  return colors.red;
}

function PlayTab({ orgId: _orgId }: { orgId: string }) {
  const { t } = useTranslation();

  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [points, setPoints] = useState<SequencePoint[]>([]);
  const [underPressure, setUnderPressure] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulatePlayResult | null>(null);
  const [simError, setSimError] = useState(false);

  const backendUrl = getBackendUrl();

  const handlePitchClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!actionMode || !backendUrl) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const [sbX, sbY] = pxToSb(e.clientX, e.clientY, rect);
      const [pxX, pxY] = sbToPx(sbX, sbY);
      setPoints((prev) => [
        ...prev,
        { sbX, sbY, pxX, pxY, actionType: actionMode, underPressure },
      ]);
      // Limpiar resultado anterior cuando se agrega un punto nuevo
      setSimResult(null);
      setSimError(false);
    },
    [actionMode, underPressure, backendUrl],
  );

  const handleSimulate = async () => {
    if (points.length < 1) {
      toast({
        title: t('simulacion.play.sequenceEmpty', 'Agrega al menos una acción para simular'),
        variant: 'warning' as const,
      });
      return;
    }

    // Construir la secuencia: cada punto es una acción desde el punto anterior
    const sequence: PlayAction[] = points.map((pt, i) => {
      const prev = i > 0 ? points[i - 1] : { sbX: 60, sbY: 40 }; // origen ficticio si no hay previo
      return {
        type: pt.actionType,
        from_x: prev.sbX,
        from_y: prev.sbY,
        to_x: pt.sbX,
        to_y: pt.sbY,
        under_pressure: pt.underPressure,
      };
    });

    setIsSimulating(true);
    setSimResult(null);
    setSimError(false);

    try {
      const data = await simulatePlay(sequence);
      setSimResult(data);
    } catch (err) {
      toast({
        title: t('simulacion.play.errorTitle', 'No se pudo simular la jugada'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'danger',
      });
      setSimError(true);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClear = () => {
    setPoints([]);
    setSimResult(null);
    setSimError(false);
    setActionMode(null);
  };

  const typeLabel = (type: 'pass' | 'dribble' | 'shot') => {
    if (type === 'pass') return t('simulacion.play.typePass', 'Pase');
    if (type === 'dribble') return t('simulacion.play.typeDribble', 'Conducción');
    return t('simulacion.play.typeShot', 'Tiro');
  };

  const typeColor = (type: 'pass' | 'dribble' | 'shot') => {
    if (type === 'pass') return colors.blue;
    if (type === 'dribble') return colors.orange;
    return colors.red;
  };

  return (
    <div className="space-y-5">
      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {actionMode
            ? t('simulacion.play.clickToAdd', 'Haz clic en la cancha para agregar el punto de la acción')
            : t('simulacion.play.selectAction', 'Selecciona una acción y luego haz clic en la cancha')}
        </span>

        <div className="flex flex-wrap gap-2">
          {(['pass', 'dribble', 'shot'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActionMode((prev) => (prev === type ? null : type))}
              className={[
                'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                actionMode === type
                  ? 'border-ai bg-ai/10 text-ai'
                  : 'border-border bg-panel text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {type === 'pass'
                ? t('simulacion.play.addPass', 'Agregar pase')
                : type === 'dribble'
                  ? t('simulacion.play.addDribble', 'Agregar conducción')
                  : t('simulacion.play.addShot', 'Agregar tiro')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="play-pressure"
            checked={underPressure}
            onCheckedChange={setUnderPressure}
          />
          <label htmlFor="play-pressure" className="cursor-pointer text-xs text-muted-foreground">
            {t('simulacion.play.underPressure', 'Bajo presión')}
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            isLoading={isSimulating}
            disabled={points.length === 0 || !backendUrl}
            onClick={handleSimulate}
          >
            {t('simulacion.play.simulate', 'Simular')}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleClear} disabled={points.length === 0}>
            {t('simulacion.play.clear', 'Limpiar')}
          </Button>
        </div>
      </div>

      {!backendUrl && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning">
          {t('simulacion.noBackend', 'VITE_API_URL no está configurado.')}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* Cancha con secuencia */}
        <div className="overflow-hidden rounded-lg border border-border">
          <PitchSvg onClick={backendUrl ? handlePitchClick : undefined}>
            {/* Flechas y puntos de la secuencia */}
            {points.map((pt, i) => {
              const prev = i > 0 ? points[i - 1] : null;
              const color = typeColor(pt.actionType);
              const resultAction = simResult?.actions?.[i];
              return (
                <g key={`action-${i}`}>
                  {/* Flecha desde el punto anterior */}
                  {prev && (
                    <g>
                      <defs>
                        <marker
                          id={`arrow-${i}`}
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                        >
                          <path d="M0,0 L6,3 L0,6 Z" fill={color} opacity={0.8} />
                        </marker>
                      </defs>
                      <line
                        x1={prev.pxX}
                        y1={prev.pxY}
                        x2={pt.pxX}
                        y2={pt.pxY}
                        stroke={color}
                        strokeWidth={2}
                        opacity={0.7}
                        markerEnd={`url(#arrow-${i})`}
                      />
                    </g>
                  )}
                  {/* Punto numerado */}
                  <circle cx={pt.pxX} cy={pt.pxY} r={12} fill={color} opacity={0.85} stroke="white" strokeWidth={1.5} />
                  <text x={pt.pxX} y={pt.pxY + 4} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold">
                    {i + 1}
                  </text>
                  {/* Probabilidad de la simulación */}
                  {resultAction && (
                    <text
                      x={pt.pxX}
                      y={pt.pxY - 16}
                      textAnchor="middle"
                      fill={probColor(resultAction.probability)}
                      fontSize={10}
                      fontWeight="bold"
                    >
                      {(resultAction.probability * 100).toFixed(0)}%
                    </text>
                  )}
                </g>
              );
            })}

            {points.length === 0 && (
              <text x={SVG_W / 2 - 60} y={SVG_H / 2} fill="rgba(255,255,255,0.35)" fontSize={13} textAnchor="middle">
                {t('simulacion.play.selectAction', 'Selecciona una acción y luego haz clic')}
              </text>
            )}
          </PitchSvg>
        </div>

        {/* Panel lateral */}
        <div className="space-y-3">
          {/* Lista de acciones */}
          {points.length > 0 && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>
                    {points.length} {t('simulacion.play.actions', 'acciones')}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {points.map((pt, i) => (
                  <div
                    key={`step-${i}`}
                    className="flex items-center justify-between rounded-md border border-border bg-panel/50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: typeColor(pt.actionType) }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-foreground">{typeLabel(pt.actionType)}</span>
                      {pt.underPressure && (
                        <Badge variant="warning" className="text-[9px]">
                          P
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-muted-foreground">
                      ({pt.sbX.toFixed(0)}, {pt.sbY.toFixed(0)})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Resultado de la simulación */}
          {isSimulating && (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {simError && <ErrorState onRetry={handleSimulate} />}

          {simResult && (
            <div className="space-y-3">
              {/* Probabilidad global */}
              <Card className="border-ai/20">
                <CardContent className="pt-5 text-center">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('simulacion.play.overallProb', 'Probabilidad de la jugada')}
                  </p>
                  <p
                    className="mt-1 text-4xl font-bold"
                    style={{ color: probColor(simResult.sequence_success_probability) }}
                  >
                    {(simResult.sequence_success_probability * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              {/* Desglose por acción */}
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t('simulacion.play.resultTitle', 'Resultado de la simulación')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {simResult.actions.map((action, i) => (
                    <div
                      key={`result-${i}`}
                      className="rounded-md border border-border bg-panel/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-foreground">
                          {t('simulacion.play.step', 'Paso')} {i + 1} — {typeLabel(action.type as 'pass' | 'dribble' | 'shot')}
                        </span>
                        <span
                          className="font-bold"
                          style={{ color: probColor(action.probability) }}
                        >
                          {(action.probability * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>
                          {t('simulacion.play.stepCumulative', 'Acumulada')}:{' '}
                          <span style={{ color: probColor(action.cumulative_probability) }}>
                            {(action.cumulative_probability * 100).toFixed(1)}%
                          </span>
                        </span>
                        {action.xg != null && (
                          <span>
                            {t('simulacion.play.stepXg', 'xG')}:{' '}
                            <span className="text-foreground">{action.xg.toFixed(3)}</span>
                          </span>
                        )}
                      </div>
                      {/* Barra de probabilidad */}
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${action.probability * 100}%`,
                            backgroundColor: probColor(action.probability),
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pestaña 3: 11 Ideal
// ---------------------------------------------------------------------------

/** Jugador extraído del campo best_xi de las métricas del backend. */
interface BestXiPlayer {
  name: string;
  position?: string;
  composite_score?: number;
  scores?: Record<string, number>;
  pitch_x?: number; // 0–1 relativo al campo de formación
  pitch_y?: number;
  [key: string]: unknown;
}

/** Posiciones de formación estándar (4-3-3) como respaldo si no vienen coords. */
const FORMATION_POSITIONS: Record<string, [number, number]> = {
  GK:   [0.08, 0.50],
  RB:   [0.25, 0.20],
  CB1:  [0.25, 0.38],
  CB2:  [0.25, 0.62],
  LB:   [0.25, 0.80],
  CDM:  [0.45, 0.50],
  CM1:  [0.55, 0.25],
  CM2:  [0.55, 0.75],
  RW:   [0.75, 0.15],
  ST:   [0.80, 0.50],
  LW:   [0.75, 0.85],
};

const DEFAULT_POSITIONS = Object.values(FORMATION_POSITIONS);

function parseBestXi(metrics: Record<string, unknown>): BestXiPlayer[] {
  // El backend puede devolver best_xi como array u objeto
  const raw = metrics['best_xi'];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as BestXiPlayer[];
  if (typeof raw === 'object') {
    // Puede ser un diccionario { position: playerData }
    return Object.entries(raw as Record<string, unknown>).map(([pos, data]) => {
      if (typeof data === 'object' && data !== null) {
        return { position: pos, ...(data as object) } as BestXiPlayer;
      }
      return { name: String(data), position: pos } as BestXiPlayer;
    });
  }
  return [];
}

function XiTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();

  const [xiResult, setXiResult] = useState<TrainingResult | null>(null);
  const [benchResult, setBenchResult] = useState<TrainingResult | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [xiPlayers, setXiPlayers] = useState<BestXiPlayer[]>([]);

  const backendUrl = getBackendUrl();

  const handleSuggestXi = async () => {
    setIsSuggesting(true);
    setXiResult(null);
    setXiPlayers([]);
    try {
      const data = await suggestBestXi(orgId);
      setXiResult(data);
      const players = parseBestXi(data.metrics);
      setXiPlayers(players);
    } catch (err) {
      toast({
        title: t('simulacion.xi.errorXi', 'No se pudo sugerir el 11 ideal'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'danger',
      });
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchResult(null);
    try {
      const data = await benchmarkRoster(orgId);
      setBenchResult(data);
    } catch (err) {
      toast({
        title: t('simulacion.xi.errorBenchmark', 'No se pudo comparar el plantel'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'danger',
      });
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Determinar estado titular/suplente/fuera basándose en el índice
  const getStatus = (index: number): 'starter' | 'substitute' | 'out' => {
    if (index < 11) return 'starter';
    if (index < 16) return 'substitute';
    return 'out';
  };

  const statusBadgeVariant = (status: 'starter' | 'substitute' | 'out') => {
    if (status === 'starter') return 'success' as const;
    if (status === 'substitute') return 'warning' as const;
    return 'neutral' as const;
  };

  const statusLabel = (status: 'starter' | 'substitute' | 'out') => {
    if (status === 'starter') return t('simulacion.xi.starter', 'Titular');
    if (status === 'substitute') return t('simulacion.xi.substitute', 'Suplente');
    return t('simulacion.xi.out', 'Fuera');
  };

  // Formación visual (cancha completa en SVG simple)
  const PITCH_W = 500;
  const PITCH_H = 340;

  const startersForPitch = xiPlayers.slice(0, 11);

  return (
    <div className="space-y-5">
      {/* Botones de acción */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          isLoading={isSuggesting}
          disabled={!backendUrl}
          onClick={handleSuggestXi}
        >
          <Users className="size-4" aria-hidden="true" />
          {t('simulacion.xi.suggestButton', 'Sugerir 11 ideal')}
        </Button>

        <Button
          variant="secondary"
          isLoading={isBenchmarking}
          disabled={!backendUrl}
          onClick={handleBenchmark}
        >
          {t('simulacion.xi.benchmarkButton', 'Comparar con élite')}
        </Button>

        {!backendUrl && (
          <p className="text-xs text-warning">
            {t('simulacion.noBackend', 'VITE_API_URL no está configurado.')}
          </p>
        )}
      </div>

      {/* Estado vacío inicial */}
      {!xiResult && !isSuggesting && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users className="mb-3 size-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">
              {t('simulacion.xi.noData', 'Sin datos del 11 ideal')}
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {t('simulacion.xi.noDataDescription', 'Haz clic en "Sugerir 11 ideal" para calcular la alineación óptima.')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Skeleton mientras carga */}
      {isSuggesting && (
        <div className="space-y-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {/* Vista de formación */}
      {xiResult && xiPlayers.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          {/* Cancha de formación */}
          <Card className="overflow-hidden p-0">
            <CardHeader className="px-5 pt-5">
              <div>
                <CardTitle>{t('simulacion.xi.pitchView', 'Vista de formación')}</CardTitle>
                <CardDescription className="mt-1">
                  {t('simulacion.xi.formation', 'Formación')}: {xiResult.model_name}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-5">
              <svg
                viewBox={`0 0 ${PITCH_W} ${PITCH_H}`}
                width="100%"
                style={{ display: 'block' }}
                aria-label="Vista de formación"
              >
                {/* Fondo */}
                <rect x={0} y={0} width={PITCH_W} height={PITCH_H} fill="#1a3a1a" rx={6} />
                {/* Líneas */}
                <rect x={20} y={20} width={PITCH_W - 40} height={PITCH_H - 40} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} rx={2} />
                <line x1={PITCH_W / 2} y1={20} x2={PITCH_W / 2} y2={PITCH_H - 20} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={40} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
                {/* Área penal derecha */}
                <rect x={PITCH_W - 110} y={PITCH_H / 2 - 60} width={90} height={120} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                {/* Área penal izquierda */}
                <rect x={20} y={PITCH_H / 2 - 60} width={90} height={120} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={1} />

                {/* Jugadores en formación */}
                {startersForPitch.map((player, i) => {
                  // Usar coords del backend si existen, si no usar posiciones por defecto
                  const pos = DEFAULT_POSITIONS[i] ?? [0.5, 0.5];
                  const px = typeof player.pitch_x === 'number' ? player.pitch_x * PITCH_W : pos[0] * PITCH_W;
                  const py = typeof player.pitch_y === 'number' ? player.pitch_y * PITCH_H : pos[1] * PITCH_H;
                  const displayName = player.name
                    ? player.name.split(' ').slice(-1)[0] // Apellido
                    : `#${i + 1}`;
                  const score = typeof player.composite_score === 'number'
                    ? player.composite_score
                    : null;

                  return (
                    <g key={`player-pitch-${i}`}>
                      <circle cx={px} cy={py} r={18} fill={colors.blue} opacity={0.9} stroke="white" strokeWidth={1.5} />
                      <text x={px} y={py + 4} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
                        {displayName.slice(0, 8)}
                      </text>
                      {score != null && (
                        <text x={px} y={py + 27} textAnchor="middle" fill={colors.green} fontSize={8}>
                          {score.toFixed(2)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </CardContent>
          </Card>

          {/* Lista de jugadores */}
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>{t('simulacion.xi.playerList', 'Todos los jugadores')}</CardTitle>
                  <CardDescription className="mt-1">
                    {t('simulacion.xi.modelName', 'Modelo')}: {xiResult.model_name} v{xiResult.model_version}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {xiPlayers.map((player, i) => {
                  const status = getStatus(i);
                  const score = typeof player.composite_score === 'number'
                    ? player.composite_score
                    : null;
                  return (
                    <div
                      key={`player-list-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border bg-panel/50 px-3 py-2 text-xs"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-border text-[9px] text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {player.name ?? `Jugador ${i + 1}`}
                          </p>
                          {player.position && (
                            <p className="text-muted-foreground">{player.position}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {score != null && (
                          <span className="font-mono text-foreground">{score.toFixed(3)}</span>
                        )}
                        <Badge variant={statusBadgeVariant(status)}>
                          {statusLabel(status)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {xiPlayers.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    {t('simulacion.xi.noPlayers', 'No se encontraron jugadores en el resultado.')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Métricas adicionales del modelo */}
            {xiResult.metrics && Object.keys(xiResult.metrics).filter((k) => k !== 'best_xi').length > 0 && (
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{t('simulacion.xi.metricsTitle', 'Métricas del modelo')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(xiResult.metrics)
                    .filter(([k]) => k !== 'best_xi')
                    .map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{key}</span>
                        <span className="font-mono text-foreground">
                          {typeof val === 'number' ? val.toFixed(3) : String(val)}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Mensaje si best_xi no viene */}
      {xiResult && xiPlayers.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            {t('simulacion.xi.noBestXi', 'No se encontró el campo best_xi en las métricas.')}
          </CardContent>
        </Card>
      )}

      {/* Resultado de benchmark */}
      {benchResult && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t('simulacion.xi.benchmarkTitle', 'Comparación con élite')}</CardTitle>
              <CardDescription className="mt-1">
                {t('simulacion.xi.benchmarkDescription', 'Resultado de la comparación del plantel contra benchmarks de élite')}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(benchResult.metrics).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{key}</span>
                <span className="font-mono text-foreground">
                  {typeof val === 'number' ? val.toFixed(3) : String(val)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

type Tab = 'xg' | 'play' | 'xi';

export default function SimulacionIA({ orgId, role: _role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('xg');

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'xg', label: t('simulacion.tabs.xg', 'xG Interactivo') },
    { key: 'play', label: t('simulacion.tabs.play', 'Simular Jugada') },
    { key: 'xi', label: t('simulacion.tabs.xi', '11 Ideal') },
  ];

  return (
    <div>
      {/* Cabecera */}
      <div className="mb-6 flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-ai/10">
          <Gamepad2 className="size-5 text-ai" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('simulacion.title', 'Simulación IA')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'simulacion.subtitle',
              'Simula situaciones de juego, calcula xG interactivo y sugiere el 11 ideal con modelos de ML',
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={[
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-150',
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-subtle'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de la pestaña activa */}
      {activeTab === 'xg' && <XgTab orgId={orgId} />}
      {activeTab === 'play' && <PlayTab orgId={orgId} />}
      {activeTab === 'xi' && <XiTab orgId={orgId} />}
    </div>
  );
}
