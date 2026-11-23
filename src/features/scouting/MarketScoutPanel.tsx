/**
 * MarketScoutPanel — pestaña "Mercado actual" de Scouting.
 *
 * A diferencia de "Scouting IA" (StatsBomb Open Data: élite europea
 * histórica), esto lee las ligas vigentes que la organización cargó desde
 * API-Football (`league_player_stats`) — lo que sirve para fichar hoy en
 * Liga MX, Centroamérica o MLS/USL — y las cruza con el plantel propio.
 *
 * Los percentiles los calcula el backend sobre el pool completo de las ligas
 * elegidas (antes de filtrar por edad/nacionalidad), con mínimo de minutos.
 * Por eso los filtros se "aplican" y disparan una consulta, en vez de
 * filtrar en el navegador: filtrar localmente un subconjunto no cambia los
 * percentiles, pero cambiar las ligas sí.
 */
import { useMemo, useState } from 'react';
import { Database, Globe2, KeyRound, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { MarketPlayerDialog } from './MarketPlayerDialog';
import {
  useMarketLeagues,
  useMarketSearch,
  type MarketLeaguesResponse,
  type MarketPlayerRow,
  type MarketPositionGroup,
  type MarketSearchParams,
} from './marketApi';
import { formatMetric, metricKind } from './marketFormat';
import { PercentileCell } from './PercentileCell';

// Frontera fútbol: los cuatro grupos de posición que usa el backend
// (market_scouting_service.POSITION_GROUPS). Otro deporte = otra lista acá.
const POSITION_GROUPS: MarketPositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
const LATEST = '__latest';
const ALL = '__all';

function toNumber(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function MarketUnavailable({ data }: { data: MarketLeaguesResponse }) {
  const { t } = useTranslation();
  if (data.status === 'table_missing') {
    return (
      <EmptyState
        icon={Database}
        title={t('market.status.tableMissingTitle', 'La tabla de estadísticas de liga no existe todavía')}
        description={t('market.status.tableMissingDescription', 'Falta aplicar la migración 022_league_player_stats.sql en Supabase.')}
      />
    );
  }
  const command = `python ${data.ingestion.script} --modo ejecutar --org "${t('market.status.orgPlaceholder', '<nombre de tu organización>')}"`;
  return (
    <Card>
      <CardContent className="space-y-5 py-6">
        <EmptyState
          icon={Globe2}
          title={t('market.status.noDataTitle', 'Tu organización no tiene ligas actuales cargadas')}
          description={t('market.status.noDataDescription', 'El mercado actual se alimenta de API-Football.')}
        />
        <div className="flex items-start gap-2 text-sm">
          <KeyRound
            className={`mt-0.5 size-4 shrink-0 ${data.ingestion.api_key_configured ? 'text-success' : 'text-warning'}`}
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            {data.ingestion.api_key_configured
              ? t('market.status.keyOk', 'API_FOOTBALL_KEY está configurada en el backend.')
              : t('market.status.keyMissing', 'El backend no tiene configurada API_FOOTBALL_KEY.')}
          </span>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">
            {t('market.status.commandLabel', 'Comando:')}
          </p>
          <code className="block overflow-x-auto rounded-md border border-border bg-bg px-3 py-2 text-xs text-foreground">
            {command}
          </code>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-foreground">
            {t('market.status.suggestedTitle', 'Ligas objetivo de la región')}
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.targets.map((target) => (
              <li key={target.key} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{target.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('market.status.expectedPlayers', '~{{count}} jugadores', { count: target.expected_players })}
                  </p>
                </div>
                {target.loaded && <Badge variant="success">{t('market.status.loaded', 'Cargada')}</Badge>}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function MarketSearch({ orgId, data }: { orgId: string; data: MarketLeaguesResponse }) {
  const { t } = useTranslation();
  const thresholds = data.thresholds;

  const seasons = useMemo(() => [...new Set(data.leagues.map((league) => league.season))].sort().reverse(), [data.leagues]);

  const defaults: MarketSearchParams = useMemo(
    () => ({
      competitions: [...new Set(data.leagues.filter((league) => league.is_latest).map((league) => league.competition))],
      season: null,
      positions: [],
      ageMin: null,
      ageMax: null,
      nationality: null,
      // Por defecto se muestra solo a quien tiene percentil: ver a un jugador
      // con 45 minutos encabezando "goles por 90" confunde más de lo que ayuda.
      minMinutes: thresholds.min_minutes_percentile,
      minAppearances: null,
      sortBy: 'minutes',
      sortOn: 'value',
      percentileScope: 'competition',
    }),
    [data.leagues, thresholds.min_minutes_percentile],
  );

  const [draft, setDraft] = useState<MarketSearchParams>(defaults);
  const [applied, setApplied] = useState<MarketSearchParams>(defaults);
  const [ageMinText, setAgeMinText] = useState('');
  const [ageMaxText, setAgeMaxText] = useState('');
  const [minMinutesText, setMinMinutesText] = useState(String(defaults.minMinutes ?? ''));
  const [minAppsText, setMinAppsText] = useState('');
  const [selected, setSelected] = useState<MarketPlayerRow | null>(null);

  const search = useMarketSearch(orgId, applied);

  const competitionOptions = useMemo(() => {
    const rows = draft.season
      ? data.leagues.filter((league) => league.season === draft.season)
      : data.leagues.filter((league) => league.is_latest);
    return [...new Map(rows.map((league) => [league.competition, league])).values()];
  }, [data.leagues, draft.season]);

  const catalog = search.data?.metrics ?? data.metrics;
  const radarMetrics = search.data?.radar_metrics ?? data.radar_metrics;
  const nationalities = Object.keys(search.data?.facets?.nationalities ?? {}).sort();

  // Columna de foco: la métrica por la que se ordena, o la calificación del
  // proveedor si se ordena por minutos/edad.
  const focusMetric = catalog?.some((metric) => metric.key === applied.sortBy) ? applied.sortBy : 'rating';
  const focusKind = metricKind(catalog, focusMetric);
  const focusLabel = t(`market.metric.${focusMetric}`, focusMetric);

  const columns = useMemo<DataTableColumn<MarketPlayerRow>[]>(
    () => [
      {
        id: 'player',
        header: t('market.col.player', 'Jugador'),
        accessor: (row) => row.player_name,
        sortable: true,
        cell: (row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">{row.player_name}</span>
            {row.own_player_id && <Badge variant="purple">{t('market.ownBadge', 'En tu plantel')}</Badge>}
          </div>
        ),
      },
      { id: 'team', header: t('market.col.team', 'Equipo'), accessor: (row) => row.team_name, sortable: true },
      {
        id: 'competition',
        header: t('market.col.competition', 'Liga'),
        accessor: (row) => `${row.competition} ${row.season}`,
        sortable: true,
      },
      {
        id: 'position',
        header: t('market.col.position', 'Pos.'),
        accessor: (row) => (row.position_group ? t(`market.position.${row.position_group}`, row.position_group) : '—'),
        sortable: true,
      },
      {
        id: 'age',
        header: t('market.col.age', 'Edad'),
        accessor: (row) => row.age,
        sortable: true,
        align: 'right',
        cell: (row) =>
          row.age == null ? (
            '—'
          ) : (
            <span
              title={
                row.age_source === 'provider_at_fetch'
                  ? t('market.ageAsOf', 'Edad según el proveedor al {{date}}', { date: row.age_as_of ?? '' })
                  : undefined
              }
            >
              {row.age}
              {row.age_source === 'provider_at_fetch' ? '*' : ''}
            </span>
          ),
      },
      {
        id: 'nationality',
        header: t('market.col.nationality', 'Nac.'),
        accessor: (row) => row.nationality ?? '',
        sortable: true,
      },
      { id: 'minutes', header: t('market.col.minutes', 'Min'), accessor: (row) => row.minutes, sortable: true, align: 'right' },
      { id: 'apps', header: t('market.col.appearances', 'PJ'), accessor: (row) => row.appearances, sortable: true, align: 'right' },
      {
        id: 'focus_value',
        header: focusLabel,
        accessor: (row) => row.metrics[focusMetric] ?? null,
        sortable: true,
        align: 'right',
        cell: (row) => formatMetric(focusKind, row.metrics[focusMetric]),
      },
      {
        id: 'focus_pct',
        header: `${t('market.col.percentile', 'Percentil')} · ${focusLabel}`,
        accessor: (row) => row.percentiles[focusMetric] ?? null,
        sortable: true,
        align: 'right',
        cell: (row) => <PercentileCell pct={row.percentiles[focusMetric] ?? null} eligible={row.eligible} />,
      },
    ],
    [t, focusMetric, focusKind, focusLabel],
  );

  function toggle<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  function apply() {
    setApplied({
      ...draft,
      ageMin: toNumber(ageMinText),
      ageMax: toNumber(ageMaxText),
      minMinutes: toNumber(minMinutesText),
      minAppearances: toNumber(minAppsText),
    });
  }

  function reset() {
    setDraft(defaults);
    setApplied(defaults);
    setAgeMinText('');
    setAgeMaxText('');
    setMinMinutesText(String(defaults.minMinutes ?? ''));
    setMinAppsText('');
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t('market.intro', 'Jugadores de ligas vigentes con métricas por 90 minutos y percentiles por posición.')}
      </p>

      <Card>
        <CardContent className="space-y-4 py-5">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('market.filters.competitions', 'Ligas')}</p>
            <div className="flex flex-wrap gap-2">
              {competitionOptions.map((league) => (
                <button
                  key={league.competition}
                  type="button"
                  className="focus-ring rounded-full"
                  aria-pressed={draft.competitions.includes(league.competition)}
                  onClick={() => setDraft((prev) => ({ ...prev, competitions: toggle(prev.competitions, league.competition) }))}
                >
                  <Chip active={draft.competitions.includes(league.competition)}>
                    {league.competition} · {league.season} ({league.players})
                  </Chip>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('market.filters.positions', 'Posición')}</p>
            <div className="flex flex-wrap gap-2">
              {POSITION_GROUPS.map((group) => (
                <button
                  key={group}
                  type="button"
                  className="focus-ring rounded-full"
                  aria-pressed={draft.positions.includes(group)}
                  onClick={() => setDraft((prev) => ({ ...prev, positions: toggle(prev.positions, group) }))}
                >
                  <Chip active={draft.positions.includes(group)}>{t(`market.position.${group}`, group)}</Chip>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <label className="col-span-2 text-xs text-muted-foreground">
              {t('market.filters.season', 'Temporada')}
              <Select
                value={draft.season ?? LATEST}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    season: value === LATEST ? null : value,
                    // Las ligas elegidas dependen de la temporada: se resetean
                    // a todas las que existen en la nueva.
                    competitions: [
                      ...new Set(
                        data.leagues
                          .filter((league) => (value === LATEST ? league.is_latest : league.season === value))
                          .map((league) => league.competition),
                      ),
                    ],
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={LATEST}>{t('market.filters.latestSeason', 'La más reciente de cada liga')}</SelectItem>
                  {seasons.map((season) => (
                    <SelectItem key={season} value={season}>
                      {season}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t('market.filters.ageMin', 'Edad mín.')}
              <Input className="mt-1" type="number" min={10} max={60} value={ageMinText} onChange={(e) => setAgeMinText(e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              {t('market.filters.ageMax', 'Edad máx.')}
              <Input className="mt-1" type="number" min={10} max={60} value={ageMaxText} onChange={(e) => setAgeMaxText(e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              {t('market.filters.minMinutes', 'Minutos mín.')}
              <Input className="mt-1" type="number" min={0} value={minMinutesText} onChange={(e) => setMinMinutesText(e.target.value)} />
            </label>
            <label className="text-xs text-muted-foreground">
              {t('market.filters.minAppearances', 'Partidos mín.')}
              <Input className="mt-1" type="number" min={0} value={minAppsText} onChange={(e) => setMinAppsText(e.target.value)} />
            </label>
            <label className="col-span-2 text-xs text-muted-foreground">
              {t('market.filters.nationality', 'Nacionalidad')}
              <Select
                value={draft.nationality ?? ALL}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, nationality: value === ALL ? null : value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('market.filters.allNationalities', 'Todas')}</SelectItem>
                  {nationalities.map((nationality) => (
                    <SelectItem key={nationality} value={nationality}>
                      {nationality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              {t('market.filters.sortBy', 'Ordenar por')}
              <Select value={draft.sortBy} onValueChange={(value) => setDraft((prev) => ({ ...prev, sortBy: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">{t('market.filters.minutesSort', 'Minutos jugados')}</SelectItem>
                  <SelectItem value="age">{t('market.filters.ageSort', 'Edad')}</SelectItem>
                  {(catalog ?? []).map((metric) => (
                    <SelectItem key={metric.key} value={metric.key}>
                      {t(`market.metric.${metric.key}`, metric.key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t('market.filters.sortOn', 'Criterio')}
              <Select
                value={draft.sortOn}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, sortOn: value as MarketSearchParams['sortOn'] }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="value">{t('market.filters.sortOnValue', 'Valor')}</SelectItem>
                  <SelectItem value="percentile">{t('market.filters.sortOnPercentile', 'Percentil')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs text-muted-foreground">
              {t('market.filters.scope', 'Percentil contra')}
              <Select
                value={draft.percentileScope}
                onValueChange={(value) =>
                  setDraft((prev) => ({ ...prev, percentileScope: value as MarketSearchParams['percentileScope'] }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="competition">{t('market.filters.scopeCompetition', 'Su liga y posición')}</SelectItem>
                  <SelectItem value="pool">{t('market.filters.scopePool', 'Todas las ligas elegidas')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              {t('market.filters.reset', 'Restablecer')}
            </Button>
            <Button variant="primary" onClick={apply} isLoading={search.isFetching}>
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {t('market.filters.apply', 'Aplicar filtros')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('market.table.title', 'Resultados')}</CardTitle>
            {search.data && (
              <CardDescription className="mt-1">
                {t('market.table.description', '{{total}} jugadores coinciden · se muestran hasta {{shown}}', {
                  total: search.data.total,
                  shown: search.data.rows.length,
                })}
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {search.isError ? (
            <ErrorState
              title={t('market.errorTitle', 'No se pudo cargar el mercado actual')}
              description={search.error instanceof Error ? search.error.message : String(search.error)}
              onRetry={() => search.refetch()}
            />
          ) : (
            <DataTable
              columns={columns}
              data={search.data?.rows ?? []}
              getRowId={(row) => row.id}
              isLoading={search.isPending}
              searchPlaceholder={t('market.table.searchPlaceholder', 'Buscar jugador o equipo…')}
              pageSize={15}
              exportFileName={t('market.table.exportName', 'mercado-actual.csv')}
              rowActions={(row) => (
                <Button variant="ghost" size="sm" onClick={() => setSelected(row)}>
                  {t('market.table.viewCard', 'Ver ficha')}
                </Button>
              )}
              emptyState={
                <EmptyState
                  title={t('market.table.noResultsTitle', 'Sin resultados')}
                  description={t('market.table.noResultsDescription', 'Ningún jugador coincide con los filtros.')}
                />
              }
            />
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {t('market.footnote', 'Percentiles con al menos {{minutes}} minutos.', {
              minutes: thresholds.min_minutes_percentile,
              pool: thresholds.min_pool_percentile,
              attempts: thresholds.min_ratio_denominator,
            })}
          </p>
        </CardContent>
      </Card>

      <MarketPlayerDialog
        orgId={orgId}
        row={selected}
        onClose={() => setSelected(null)}
        onOpenRow={setSelected}
        catalog={catalog}
        radarMetrics={radarMetrics}
        thresholds={search.data?.thresholds ?? thresholds}
        scope={{ competitions: applied.competitions, season: applied.season }}
      />
    </div>
  );
}

export function MarketScoutPanel({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const leagues = useMarketLeagues(orgId);

  if (leagues.isPending) return <Skeleton className="h-96 w-full" />;
  if (leagues.isError) {
    return (
      <ErrorState
        title={t('market.errorTitle', 'No se pudo cargar el mercado actual')}
        description={leagues.error instanceof Error ? leagues.error.message : String(leagues.error)}
        onRetry={() => leagues.refetch()}
      />
    );
  }
  if (leagues.data.status !== 'ready') return <MarketUnavailable data={leagues.data} />;
  return <MarketSearch orgId={orgId} data={leagues.data} />;
}
