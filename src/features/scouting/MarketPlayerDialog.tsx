/**
 * Ficha rápida de un jugador del "Mercado actual": radar de percentiles,
 * similares y comparación de reemplazo contra un jugador del plantel propio.
 *
 * El radar solo dibuja ejes CON percentil: un eje en 0 por falta de dato se
 * leería como "es el peor de la liga", que es una afirmación falsa. Los ejes
 * sin percentil se listan aparte.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { RadarDualChart } from '@/components/charts/RadarDualChart';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { PercentileCell } from './PercentileCell';
import {
  useMarketCompare,
  useMarketSimilar,
  useRosterOptions,
  type MarketComparability,
  type MarketMetricDef,
  type MarketPlayerRow,
  type MarketPositionGroup,
  type MarketThresholds,
} from './marketApi';
import { formatMetric, metricKind } from './marketFormat';

// Un radar con menos de 3 ejes no es un polígono: se muestra la tabla sola.
const MIN_RADAR_AXES = 3;

const STATUS_VARIANT: Record<MarketComparability, 'success' | 'warning' | 'neutral'> = {
  comparable: 'success',
  caution: 'warning',
  not_comparable: 'neutral',
};

interface Scope {
  competitions: string[];
  season: string | null;
}

interface MarketPlayerDialogProps {
  orgId: string;
  row: MarketPlayerRow | null;
  onClose: () => void;
  onOpenRow: (row: MarketPlayerRow) => void;
  catalog: MarketMetricDef[] | undefined;
  radarMetrics: Record<MarketPositionGroup, string[]> | undefined;
  thresholds: MarketThresholds;
  scope: Scope;
}

function useMetricLabel() {
  const { t } = useTranslation();
  return (key: string) => t(`market.metric.${key}`, key);
}

function ProfileTab({
  row,
  catalog,
  radarMetrics,
  thresholds,
}: {
  row: MarketPlayerRow;
  catalog: MarketMetricDef[] | undefined;
  radarMetrics: Record<MarketPositionGroup, string[]> | undefined;
  thresholds: MarketThresholds;
}) {
  const { t } = useTranslation();
  const label = useMetricLabel();
  const keys = (row.position_group && radarMetrics?.[row.position_group]) || [];
  const withPct = keys.filter((key) => row.percentiles[key] != null);
  const withoutPct = keys.filter((key) => row.percentiles[key] == null);
  const radarData = withPct.map((key) => ({ attribute: label(key), value: row.percentiles[key] as number }));

  return (
    <div className="space-y-4">
      {withPct.length >= MIN_RADAR_AXES ? (
        <ChartCard
          title={t('market.sheet.radarTitle', 'Percentiles por posición')}
          description={t('market.sheet.radarDescription', 'Contra {{pool}} jugadores elegibles de su pool', { pool: row.pool_size ?? 0 })}
          height={300}
        >
          <RadarComparisonChart data={radarData} dataKey="value" angleKey="attribute" name={row.player_name} />
        </ChartCard>
      ) : (
        <EmptyState
          title={t('market.sheet.noPercentilesTitle', 'Sin percentiles')}
          description={t('market.sheet.noPercentilesDescription', 'Jugó menos de {{minutes}} minutos o su pool es demasiado chico.', {
            minutes: thresholds.min_minutes_percentile,
          })}
        />
      )}
      {withPct.length >= MIN_RADAR_AXES && withoutPct.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('market.sheet.missingPercentiles', 'Sin percentil: {{metrics}}', { metrics: withoutPct.map(label).join(', ') })}
        </p>
      )}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">{t('market.sheet.metricsTitle', 'Métricas')}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('market.sheet.colMetric', 'Métrica')}</TableHead>
              <TableHead className="text-right">{t('market.sheet.colValue', 'Valor')}</TableHead>
              <TableHead className="text-right">{t('market.sheet.colPercentile', 'Percentil')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.map((key) => (
              <TableRow key={key}>
                <TableCell>{label(key)}</TableCell>
                <TableCell className="text-right">{formatMetric(metricKind(catalog, key), row.metrics[key])}</TableCell>
                <TableCell>
                  <PercentileCell pct={row.percentiles[key] ?? null} eligible={row.eligible} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SimilarTab({
  orgId,
  row,
  scope,
  onOpenRow,
}: {
  orgId: string;
  row: MarketPlayerRow;
  scope: Scope;
  onOpenRow: (row: MarketPlayerRow) => void;
}) {
  const { t } = useTranslation();
  const label = useMetricLabel();
  const similar = useMarketSimilar(orgId, row.id, scope);

  if (similar.isPending) return <Skeleton className="h-64 w-full" />;
  if (similar.isError) {
    return (
      <ErrorState
        title={t('market.errorTitle', 'No se pudo cargar el mercado actual')}
        description={similar.error instanceof Error ? similar.error.message : String(similar.error)}
        onRetry={() => similar.refetch()}
      />
    );
  }
  const candidates = similar.data.candidates;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('market.similar.description', 'Misma posición, métricas por 90 normalizadas.')}</p>
      {similar.data.target_low_sample && (
        <p className="text-xs text-warning">{t('market.similar.lowSample', 'Este jugador tiene pocos minutos.')}</p>
      )}
      {candidates.length === 0 ? (
        <EmptyState title={t('market.similar.empty', 'No hay jugadores comparables.')} />
      ) : (
        candidates.map((candidate) => {
          const reasons = candidate.reasons;
          const difference = reasons.main_difference;
          return (
            <Card
              key={candidate.id}
              interactive
              className="cursor-pointer p-4"
              role="button"
              tabIndex={0}
              onClick={() => onOpenRow(candidate)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onOpenRow(candidate);
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{candidate.player_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t('market.sheet.meta', '{{team}} · {{competition}} {{season}}', {
                      team: candidate.team_name,
                      competition: candidate.competition,
                      season: candidate.season,
                    })}
                    {candidate.age != null ? ` · ${candidate.age}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black leading-none text-ai">{Math.round(candidate.similarity)}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t('market.similar.similarity', 'similitud')}</p>
                </div>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {reasons.shared_strengths.length > 0 && (
                  <li>
                    {t('market.similar.sharedStrengths', 'Ambos destacan en: {{metrics}}', {
                      metrics: reasons.shared_strengths.map((item) => label(item.metric)).join(', '),
                    })}
                  </li>
                )}
                {reasons.shared_strengths.length === 0 && reasons.closest.length > 0 && (
                  <li>
                    {t('market.similar.closest', 'Más parecidos en: {{metrics}}', {
                      metrics: reasons.closest.map((item) => label(item.metric)).join(', '),
                    })}
                  </li>
                )}
                {reasons.shared_strengths.length === 0 && reasons.closest.length === 0 && (
                  <li>{t('market.similar.noReason', 'Parecido general sin rasgos destacados en común.')}</li>
                )}
                {difference && (
                  <li>
                    {difference.candidate_better
                      ? t('market.similar.differenceBetter', 'Diferencia principal: {{metric}} (el candidato rinde más)', {
                          metric: label(difference.metric),
                        })
                      : t('market.similar.differenceWorse', 'Diferencia principal: {{metric}} (el candidato rinde menos)', {
                          metric: label(difference.metric),
                        })}
                  </li>
                )}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
}

function CompareTab({ orgId, row, catalog }: { orgId: string; row: MarketPlayerRow; catalog: MarketMetricDef[] | undefined }) {
  const { t } = useTranslation();
  const label = useMetricLabel();
  const roster = useRosterOptions(orgId);
  const [ownId, setOwnId] = useState<string | null>(null);
  const compare = useMarketCompare(orgId, ownId, row.id);

  if (roster.isPending) return <Skeleton className="h-10 w-full" />;
  if (roster.isError) {
    return (
      <ErrorState
        title={t('market.compare.rosterError', 'No se pudo cargar el plantel')}
        description={roster.error instanceof Error ? roster.error.message : String(roster.error)}
        onRetry={() => roster.refetch()}
      />
    );
  }
  if (roster.data.length === 0) return <EmptyState title={t('market.compare.noRoster', 'Tu organización no tiene jugadores en el plantel.')} />;

  const result = compare.data;
  const rows = result?.rows ?? [];
  const radarData = rows
    .filter((item) => item.own_pct != null && item.candidate_pct != null)
    .map((item) => ({ attribute: label(item.metric), a: item.own_pct as number, b: item.candidate_pct as number }));

  return (
    <div className="space-y-4">
      <label className="block text-xs text-muted-foreground">
        {t('market.compare.selectOwn', 'Jugador de mi plantel')}
        <Select value={ownId ?? undefined} onValueChange={setOwnId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder={t('market.compare.placeholder', 'Elegir jugador…')} />
          </SelectTrigger>
          <SelectContent>
            {roster.data.map((player) => (
              <SelectItem key={player.id} value={player.id}>
                {player.full_name}
                {player.position ? ` · ${player.position}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      {ownId === null ? (
        <p className="text-sm text-muted-foreground">{t('market.compare.pickPrompt', 'Elige un jugador de tu plantel.')}</p>
      ) : compare.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : compare.isError ? (
        <ErrorState
          title={t('market.errorTitle', 'No se pudo cargar el mercado actual')}
          description={compare.error instanceof Error ? compare.error.message : String(compare.error)}
          onRetry={() => compare.refetch()}
        />
      ) : result && result.own && result.candidate ? (
        <>
          {!result.own.market_row && (
            <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
              {t('market.compare.noOwnMarketRow', 'Tu jugador no tiene estadísticas de competición enlazadas.')}
            </p>
          )}
          {radarData.length >= MIN_RADAR_AXES ? (
            <ChartCard
              title={t('market.compare.radarTitle', 'Percentiles lado a lado')}
              description={t('market.compare.radarDescription', 'Cada uno contra su propia liga y posición')}
              height={300}
            >
              <RadarDualChart data={radarData} nameA={result.own.full_name} nameB={result.candidate.player_name} />
            </ChartCard>
          ) : (
            result.own.market_row && (
              <p className="text-xs text-muted-foreground">{t('market.compare.radarEmpty', 'No hay métricas con percentil en ambos jugadores.')}</p>
            )
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('market.sheet.colMetric', 'Métrica')}</TableHead>
                <TableHead className="text-right">{t('market.compare.colOwn', 'Mi jugador')}</TableHead>
                <TableHead className="text-right">{t('market.compare.colCandidate', 'Candidato')}</TableHead>
                <TableHead>{t('market.compare.colStatus', 'Comparabilidad')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const kind = metricKind(catalog, item.metric);
                return (
                  <TableRow key={item.metric}>
                    <TableCell>{label(item.metric)}</TableCell>
                    <TableCell className="text-right">
                      {formatMetric(kind, item.own_value)}
                      {item.own_pct != null && <span className="ml-1 text-xs text-muted-foreground">(p{item.own_pct})</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMetric(kind, item.candidate_value)}
                      {item.candidate_pct != null && <span className="ml-1 text-xs text-muted-foreground">(p{item.candidate_pct})</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[item.status]}>{t(`market.compare.status.${item.status}`, item.status)}</Badge>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t(`market.compare.reason.${item.reason}`, item.reason)}</p>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {(result.own_only_sources ?? []).length > 0 && (
            <div className="rounded-md border border-border px-3 py-2">
              <p className="text-sm font-medium text-foreground">{t('market.compare.ownOnlyTitle', 'Datos solo de tu jugador')}</p>
              <p className="mb-1 text-xs text-muted-foreground">
                {t('market.compare.ownOnlyDescription', 'API-Football no publica tracking físico ni video.')}
              </p>
              <ul className="space-y-0.5 text-xs text-foreground">
                {(result.own_only_sources ?? []).map((source) => (
                  <li key={source.source}>
                    {source.source === 'gps'
                      ? t('market.compare.gps', 'GPS: {{sessions}} sesiones', {
                          sessions: source.sessions ?? 0,
                          distance: source.avg_distance_km ?? '—',
                          speed: source.max_top_speed_kmh ?? '—',
                        })
                      : t('market.compare.video', 'Video: {{tracks}} apariciones', { tracks: source.matched_tracks ?? 0 })}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {(result.notes ?? []).map((note) => (
              <li key={note}>{t(`market.compare.notes.${note}`, note)}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function MarketPlayerDialog({ orgId, row, onClose, onOpenRow, catalog, radarMetrics, thresholds, scope }: MarketPlayerDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {row && (
          // key: al abrir un similar desde la ficha, las pestañas vuelven a "Ficha".
          <div key={row.id}>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {row.player_name}
                {row.position_group && <Badge variant="ai">{t(`market.position.${row.position_group}`, row.position_group)}</Badge>}
                {row.own_player_id && <Badge variant="purple">{t('market.ownBadge', 'En tu plantel')}</Badge>}
                {!row.eligible && <Badge variant="neutral">{t('market.lowSample', 'Muestra insuficiente')}</Badge>}
              </DialogTitle>
              <DialogDescription>
                {t('market.sheet.meta', '{{team}} · {{competition}} {{season}}', {
                  team: row.team_name,
                  competition: row.competition,
                  season: row.season,
                })}
                {row.nationality ? ` · ${row.nationality}` : ''}
                {row.age != null ? ` · ${row.age}${row.age_source === 'provider_at_fetch' ? '*' : ''}` : ''}
                {' · '}
                {t('market.sheet.minutesMeta', '{{minutes}} min · {{appearances}} PJ', {
                  minutes: row.minutes ?? '—',
                  appearances: row.appearances ?? '—',
                })}
              </DialogDescription>
              {row.age_source === 'provider_at_fetch' && (
                <p className="text-xs text-muted-foreground">
                  * {t('market.ageAsOf', 'Edad según el proveedor al {{date}}', { date: row.age_as_of ?? '' })}
                </p>
              )}
            </DialogHeader>
            <Tabs defaultValue="profile">
              <TabsList>
                <TabsTrigger value="profile">{t('market.sheet.tabProfile', 'Ficha')}</TabsTrigger>
                <TabsTrigger value="similar">{t('market.sheet.tabSimilar', 'Similares')}</TabsTrigger>
                <TabsTrigger value="compare">{t('market.sheet.tabCompare', 'Comparar con mi jugador')}</TabsTrigger>
              </TabsList>
              <TabsContent value="profile">
                <ProfileTab row={row} catalog={catalog} radarMetrics={radarMetrics} thresholds={thresholds} />
              </TabsContent>
              <TabsContent value="similar">
                <SimilarTab orgId={orgId} row={row} scope={scope} onOpenRow={onOpenRow} />
              </TabsContent>
              <TabsContent value="compare">
                <CompareTab orgId={orgId} row={row} catalog={catalog} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
