/**
 * AiScoutPanel — recomendador de fichajes con IA.
 *
 * El usuario define su necesidad (posición + estilo de juego) o pide "el que
 * mejor se adapta a mi equipo" (estilo inferido de las stats de liga del propio
 * equipo). El backend (ScoutingService) construye un jugador ideal y devuelve
 * los candidatos del pool de StatsBomb ordenados por "fit". Cada tarjeta abre
 * la ficha detallada (SbPlayerProfileDialog), igual que el módulo de Atletas.
 */
import { useState } from 'react';
import { Sparkles, Target, UserRound, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { SbPlayerProfileDialog, ratingColor } from '@/components/statsbomb/SbPlayerProfileDialog';
import { colors } from '@/constants/tokens';
import {
  scoutingRecommend,
  scoutingRecommendForTeam,
  type ScoutingCandidate,
  type ScoutingResult,
  type ScoutPosition,
  type ScoutStyle,
} from '@/lib/backendApi';
import { toast } from '@/store/toastStore';

const POSITIONS: Array<{ value: ScoutPosition; label: string }> = [
  { value: 'GK', label: 'Portero' },
  { value: 'DEF', label: 'Defensa' },
  { value: 'MID', label: 'Mediocampo' },
  { value: 'FWD', label: 'Delantero' },
];

const STYLES: Array<{ value: ScoutStyle; label: string }> = [
  { value: 'equilibrado', label: 'Equilibrado' },
  { value: 'posesion', label: 'Posesión (tiki-taka)' },
  { value: 'presion', label: 'Presión alta (gegenpressing)' },
  { value: 'contragolpe', label: 'Contragolpe' },
  { value: 'ofensivo', label: 'Ofensivo' },
  { value: 'defensivo', label: 'Defensivo' },
];

const ATTR_ORDER = ['RIT', 'TIR', 'PAS', 'REG', 'DEF', 'FIS'] as const;
const ATTR_LABELS: Record<string, string> = { RIT: 'RIT', TIR: 'TIR', PAS: 'PAS', REG: 'REG', DEF: 'DEF', FIS: 'FÍS' };

function CandidateCard({ c, onOpen }: { c: ScoutingCandidate; onOpen: () => void }) {
  const fitColor = c.fit >= 85 ? '#22c55e' : c.fit >= 75 ? '#84cc16' : c.fit >= 65 ? '#eab308' : '#f97316';
  return (
    <Card
      interactive
      className="cursor-pointer p-4"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg text-base font-black text-white"
          style={{ background: `linear-gradient(135deg, ${ratingColor(c.overall)}, #0f172a)` }}
        >
          {c.overall}
        </div>
        <div className="flex size-11 items-center justify-center overflow-hidden rounded-full border border-border bg-panel">
          <UserRound className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {c.country ?? '—'} · {c.matches} PJ
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none" style={{ color: fitColor }}>
            {Math.round(c.fit)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">fit</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{c.reason}</p>
      <div className="mt-2 grid grid-cols-6 gap-1">
        {ATTR_ORDER.map((code) => (
          <div key={code} className="text-center">
            <div className="text-[10px] text-muted-foreground">{ATTR_LABELS[code]}</div>
            <div className="text-xs font-bold" style={{ color: ratingColor(c.attributes[code]) }}>
              {c.attributes[code]}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AiScoutPanel({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [position, setPosition] = useState<ScoutPosition>('FWD');
  const [style, setStyle] = useState<ScoutStyle>('equilibrado');
  const [result, setResult] = useState<ScoutingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const run = async (forTeam: boolean) => {
    setLoading(true);
    setResult(null);
    try {
      const data = forTeam
        ? await scoutingRecommendForTeam({ orgId, position, limit: 24 })
        : await scoutingRecommend({ position, style, limit: 24 });
      setResult(data);
      if (forTeam && data.inferred_style) {
        setStyle(data.inferred_style as ScoutStyle);
      }
    } catch (err) {
      toast({
        title: t('scoutAi.error', 'No se pudo generar la recomendación'),
        description: err instanceof Error ? err.message : String(err),
        variant: 'danger',
      });
    } finally {
      setLoading(false);
    }
  };

  const targetRadar = result
    ? ATTR_ORDER.map((code) => ({ attribute: ATTR_LABELS[code], value: result.target[code] ?? 0 }))
    : [];

  return (
    <div className="space-y-5">
      {/* Panel de necesidad */}
      <Card>
        <CardContent className="flex flex-col gap-4 py-5 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t('scoutAi.position', 'Posición que busco')}
            </label>
            <Select value={position} onValueChange={(v) => setPosition(v as ScoutPosition)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t('scoutAi.style', 'Estilo de juego')}
            </label>
            <Select value={style} onValueChange={(v) => setStyle(v as ScoutStyle)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" isLoading={loading} onClick={() => run(false)}>
              <Target className="size-4" aria-hidden="true" />
              {t('scoutAi.recommend', 'Recomendar')}
            </Button>
            <Button variant="secondary" isLoading={loading} onClick={() => run(true)}>
              <Wand2 className="size-4" aria-hidden="true" />
              {t('scoutAi.forMyTeam', 'Para mi equipo')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      )}

      {!loading && !result && (
        <EmptyState
          icon={Sparkles}
          title={t('scoutAi.emptyTitle', 'Define tu necesidad')}
          description={t(
            'scoutAi.emptyDesc',
            'Elige posición y estilo, o pulsa "Para mi equipo" para que la IA infiera tu estilo y sugiera los jugadores que mejor encajan.',
          )}
        />
      )}

      {!loading && result && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
          {/* Perfil ideal buscado — en ChartCard para heredar la exportación
           * (PNG con firma + CSV de los atributos objetivo). El badge de
           * "estilo inferido" pasa a texto porque la descripción es string. */}
          <ChartCard
            title={t('scoutAi.idealProfile', 'Perfil ideal buscado')}
            description={[
              POSITIONS.find((p) => p.value === result.position)?.label,
              STYLES.find((s) => s.value === result.style)?.label ?? result.style,
              result.style_inferred_from_team ? t('scoutAi.inferred', 'estilo inferido') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            height={208}
            exportData={targetRadar}
            exportColumns={[
              { key: 'attribute', header: t('dataviz.columns.attribute', 'Atributo') },
              { key: 'value', header: t('dataviz.columns.value', 'Valor') },
            ]}
            exportCredit={t('dataviz.export.statsbombCredit', 'Datos: StatsBomb Open Data')}
          >
            <RadarComparisonChart
              data={targetRadar}
              dataKey="value"
              angleKey="attribute"
              name={t('scoutAi.ideal', 'Ideal')}
              color={colors.blue}
            />
          </ChartCard>

          {/* Candidatos */}
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              {t('scoutAi.candidatesCount', '{{count}} candidatos ordenados por ajuste (fit)', {
                count: result.candidates.length,
              })}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.candidates.map((c) => (
                <CandidateCard key={c.player_id} c={c} onOpen={() => setSelected(c.player_id)} />
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{result.basis}</p>
          </div>
        </div>
      )}

      <SbPlayerProfileDialog playerId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
