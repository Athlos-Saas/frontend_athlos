/**
 * Generador de reportes PDF (ocho tipos: ver MODULE_REPORT_TYPES).
 *
 * El PDF lo arma el backend con datos reales; aquí solo se eligen los
 * parámetros, y TODOS salen de desplegables o del calendario poblados con
 * datos de la organización (equipos, atletas, videos, rivales, ligas
 * cargadas): ningún campo de texto libre, para que nunca se pida un reporte de
 * algo que no existe.
 *
 * Tras generar, "Descargar" baja el archivo como Blob con la sesión del
 * usuario (`downloadReportFile`) en vez de abrir la URL firmada que devuelve el
 * backend: sin pestañas nuevas (que bloquean los bloqueadores de ventanas tras
 * un `await`) y con el error real en un toast si algo falla.
 */
import { useMemo, useState } from 'react';
import {
  CalendarRange,
  Download,
  FileText,
  HeartPulse,
  Shield,
  Telescope,
  TrendingUp,
  Trophy,
  UserRound,
  Video,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { DatePicker } from '@/components/ui/DatePicker';
import { Field } from '@/components/ui/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import type { MarketLeague, MarketPositionGroup } from '@/features/scouting/marketApi';
import {
  useDownloadReport,
  useGenerateReport,
  useReportMarketLeagues,
  useReportPlayers,
  useReportRivals,
  useReportTeams,
  useReportVideos,
} from '@/hooks/useReports';
import { toast } from '@/store/toastStore';
import { canGenerateHealthReports, canWrite } from '@/utils/permissions';
import {
  INDIVIDUAL_WEEKS,
  MARKET_POSITIONS,
  SHORTLIST_LIMITS,
  SHORTLIST_MIN_MINUTES,
  type GenerateModuleReportRequest,
  type GenerateModuleReportResult,
  type ModuleReportType,
} from './api';

/** Radix Select no admite `value=""`: centinela para "sin equipo propio". */
const NO_TEAM = '__none__';
/** Umbral de percentil del mercado (MIN_MINUTES_FOR_PERCENTILE del backend). */
const DEFAULT_MIN_MINUTES = '600';

/** Fecha local AAAA-MM-DD (toISOString usaría UTC y podría correr un día). */
function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const leagueKey = (league: Pick<MarketLeague, 'competition' | 'season'>) => `${league.competition}|${league.season}`;

export function ReportGenerator({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const writable = canWrite(role);
  const healthAllowed = canGenerateHealthReports(role);

  const [kind, setKind] = useState<ModuleReportType>('squad_weekly');

  const teams = useReportTeams(orgId);
  const videos = useReportVideos(orgId);
  const rivals = useReportRivals(orgId);
  const players = useReportPlayers(orgId);
  const leagues = useReportMarketLeagues(orgId, kind === 'market_shortlist');
  const generate = useGenerateReport(orgId);
  const download = useDownloadReport();

  const [teamId, setTeamId] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<Date | undefined>(() => new Date());
  // Sin fecha = el backend cierra en el último día con GPS (ver
  // report_kinds._resolve_period_end): "hoy" casi siempre daría un periodo vacío.
  const [loadPeriodEnd, setLoadPeriodEnd] = useState<Date | undefined>(undefined);
  const [videoId, setVideoId] = useState<string>('');
  const [rivalId, setRivalId] = useState<string>('');
  const [rivalTeamId, setRivalTeamId] = useState<string>(NO_TEAM);
  const [playerId, setPlayerId] = useState<string>('');
  const [weeks, setWeeks] = useState<string>('8');
  const [league, setLeague] = useState<string>('');
  const [position, setPosition] = useState<MarketPositionGroup>('FWD');
  const [sortMetric, setSortMetric] = useState<string>('');
  const [minMinutes, setMinMinutes] = useState<string>(DEFAULT_MIN_MINUTES);
  const [limit, setLimit] = useState<string>('20');
  const [lastResult, setLastResult] = useState<GenerateModuleReportResult | null>(null);

  // Equipo por defecto: el primero (temporada más reciente), igual que el
  // backend cuando no recibe team_id.
  const effectiveTeamId = teamId || teams.data?.[0]?.id || '';
  const teamNames = useMemo(() => new Map((teams.data ?? []).map((team) => [team.id, team.name])), [teams.data]);

  const marketLeagues = useMemo(
    () => (leagues.data?.status === 'ready' ? leagues.data.leagues.filter((item) => item.players > 0) : []),
    [leagues.data],
  );
  // Default: la temporada más reciente de la liga con más jugadores.
  const defaultLeague = useMemo(
    () => [...marketLeagues].filter((item) => item.is_latest).sort((a, b) => b.players - a.players)[0],
    [marketLeagues],
  );
  const effectiveLeague = marketLeagues.find((item) => leagueKey(item) === league) ?? defaultLeague;
  const positionMetrics = leagues.data?.radar_metrics?.[position] ?? [];
  const effectiveSortMetric = positionMetrics.includes(sortMetric) ? sortMetric : (positionMetrics[0] ?? '');

  const canSubmit = useMemo(() => {
    if (!writable || generate.isPending) return false;
    switch (kind) {
      case 'squad_weekly':
        return !!effectiveTeamId && !!periodEnd;
      case 'post_match':
        return !!videoId;
      case 'rival_scouting':
        return !!rivalId;
      case 'player_individual':
        return !!playerId;
      case 'injury_risk':
        return healthAllowed && !!effectiveTeamId;
      case 'market_shortlist':
        return !!effectiveLeague && !!effectiveSortMetric;
      default:
        return !!effectiveTeamId;
    }
  }, [writable, generate.isPending, kind, effectiveTeamId, periodEnd, videoId, rivalId, playerId, healthAllowed, effectiveLeague, effectiveSortMetric]);

  const buildPayload = (): GenerateModuleReportRequest => {
    const loadEnd = loadPeriodEnd ? toIsoDay(loadPeriodEnd) : undefined;
    switch (kind) {
      case 'squad_weekly':
        return { report_type: kind, team_id: effectiveTeamId, period_end: periodEnd ? toIsoDay(periodEnd) : undefined };
      case 'post_match':
        return { report_type: kind, video_id: videoId };
      case 'rival_scouting':
        return { report_type: kind, rival_id: rivalId, team_id: rivalTeamId === NO_TEAM ? undefined : rivalTeamId };
      case 'player_individual':
        return {
          report_type: kind,
          player_id: playerId,
          weeks: Number(weeks) as GenerateModuleReportRequest['weeks'],
          period_end: loadEnd,
        };
      case 'monthly_load':
        return { report_type: kind, team_id: effectiveTeamId, period_end: loadEnd };
      case 'market_shortlist':
        return {
          report_type: kind,
          competition: effectiveLeague?.competition,
          season: effectiveLeague?.season,
          position,
          sort_metric: effectiveSortMetric,
          min_minutes: Number(minMinutes) as GenerateModuleReportRequest['min_minutes'],
          limit: Number(limit) as GenerateModuleReportRequest['limit'],
        };
      default:
        return { report_type: kind, team_id: effectiveTeamId };
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generate.mutateAsync(buildPayload());
      setLastResult(result);
      toast({ title: t('reportsModule.generator.success', 'Reporte generado'), description: result.title, variant: 'success' });
    } catch (error) {
      toast({
        title: t('reportsModule.generator.error', 'No se pudo generar el reporte'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'danger',
      });
    }
  };

  const handleDownloadLast = async () => {
    if (!lastResult) return;
    try {
      await download.mutateAsync({ storage_path: lastResult.storage_path, title: lastResult.title });
    } catch (error) {
      toast({
        title: t('reportsModule.history.downloadError', 'No se pudo descargar el reporte'),
        description: error instanceof Error ? error.message : String(error),
        variant: 'danger',
      });
    }
  };

  const loadingOptions = teams.isLoading || videos.isLoading || rivals.isLoading || players.isLoading;
  const optionsError = teams.error ?? videos.error ?? rivals.error ?? players.error;

  const teamField = (
    <Field label={t('reportsModule.fields.team', 'Equipo')}>
      <Select value={effectiveTeamId} onValueChange={setTeamId} disabled={!teams.data?.length}>
        <SelectTrigger aria-label={t('reportsModule.fields.team', 'Equipo')}>
          <SelectValue placeholder={t('reportsModule.fields.noTeams', 'Sin equipos')} />
        </SelectTrigger>
        <SelectContent>
          {(teams.data ?? []).map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
              {team.season ? ` (${team.season})` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  // El botón de volver al default va FUERA de <Field>: Field clona a su hijo
  // directo para inyectarle aria-describedby/invalid, y un <div> los pintaría
  // como atributos desconocidos del DOM.
  const loadPeriodField = (
    <div>
      <Field
        className={loadPeriodEnd ? 'mb-1.5' : undefined}
        label={t('reportsModule.fields.periodEndOptional', 'Fecha de cierre')}
        hint={t('reportsModule.fields.periodEndOptionalHint', 'Sin fecha, el reporte termina en el último día con datos GPS.')}
      >
        <DatePicker
          value={loadPeriodEnd}
          onChange={setLoadPeriodEnd}
          placeholder={t('reportsModule.fields.lastAvailable', 'Último dato disponible')}
        />
      </Field>
      {loadPeriodEnd && (
        <Button variant="ghost" size="sm" className="mb-4" onClick={() => setLoadPeriodEnd(undefined)}>
          {t('reportsModule.fields.useLastAvailable', 'Usar el último dato disponible')}
        </Button>
      )}
    </div>
  );

  const help = (key: string, fallback: string) => <p className="text-sm text-muted-foreground">{t(key, fallback)}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-ai" aria-hidden="true" />
          {t('reportsModule.generator.title', 'Generar reporte')}
        </CardTitle>
        <CardDescription>
          {t(
            'reportsModule.generator.subtitle',
            'PDF con marca ATHLOS y datos reales. Si falta un dato, el reporte lo dice: nunca se rellena.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!writable && (
          <p className="rounded-md border border-border bg-panel px-3 py-2 text-sm text-muted-foreground">
            {t(
              'reportsModule.generator.readOnly',
              'Tu rol puede ver y descargar reportes, pero generarlos requiere un rol con escritura (admin, entrenador, médico o analista).',
            )}
          </p>
        )}
        {optionsError && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {t('reportsModule.generator.optionsError', 'No se pudieron cargar las opciones')}:{' '}
            {optionsError instanceof Error ? optionsError.message : String(optionsError)}
          </p>
        )}

        <Tabs value={kind} onValueChange={(value) => setKind(value as ModuleReportType)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="squad_weekly" className="gap-1.5">
              <CalendarRange className="size-4" aria-hidden="true" />
              {t('reportsModule.types.squad_weekly', 'Semanal del plantel')}
            </TabsTrigger>
            <TabsTrigger value="monthly_load" className="gap-1.5">
              <TrendingUp className="size-4" aria-hidden="true" />
              {t('reportsModule.types.monthly_load', 'Carga mensual')}
            </TabsTrigger>
            <TabsTrigger value="player_individual" className="gap-1.5">
              <UserRound className="size-4" aria-hidden="true" />
              {t('reportsModule.types.player_individual', 'Ficha individual')}
            </TabsTrigger>
            {healthAllowed && (
              <TabsTrigger value="injury_risk" className="gap-1.5">
                <HeartPulse className="size-4" aria-hidden="true" />
                {t('reportsModule.types.injury_risk', 'Riesgo de lesión')}
              </TabsTrigger>
            )}
            <TabsTrigger value="post_match" className="gap-1.5">
              <Video className="size-4" aria-hidden="true" />
              {t('reportsModule.types.post_match', 'Post-partido')}
            </TabsTrigger>
            <TabsTrigger value="season_summary" className="gap-1.5">
              <Trophy className="size-4" aria-hidden="true" />
              {t('reportsModule.types.season_summary', 'Resumen de temporada')}
            </TabsTrigger>
            <TabsTrigger value="rival_scouting" className="gap-1.5">
              <Shield className="size-4" aria-hidden="true" />
              {t('reportsModule.types.rival_scouting', 'Rival')}
            </TabsTrigger>
            <TabsTrigger value="market_shortlist" className="gap-1.5">
              <Telescope className="size-4" aria-hidden="true" />
              {t('reportsModule.types.market_shortlist', 'Shortlist de mercado')}
            </TabsTrigger>
          </TabsList>

          {loadingOptions ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : (
            <>
              <TabsContent value="squad_weekly" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.squadWeeklyHelp',
                  'Carga GPS y ACWR por atleta, alertas y wellness del equipo solo agregado (sin datos médicos individuales).',
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {teamField}
                  <Field
                    label={t('reportsModule.fields.periodEnd', 'Último día de la semana')}
                    hint={t('reportsModule.fields.periodEndHint', 'El reporte cubre los 7 días que terminan en esta fecha.')}
                  >
                    <DatePicker
                      value={periodEnd}
                      onChange={setPeriodEnd}
                      placeholder={t('reportsModule.fields.pickDate', 'Elige una fecha')}
                    />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="monthly_load" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.monthlyLoadHelp',
                  'Cuatro semanas de carga: Player Load del equipo y de cada atleta semana a semana, evolución del ACWR y picos. Sin datos de salud.',
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {teamField}
                  {loadPeriodField}
                </div>
              </TabsContent>

              <TabsContent value="player_individual" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.playerIndividualHelp',
                  'Perfil, tendencia de carga GPS por semana, ACWR, últimas sesiones con la lectura de los modelos, atributos dentro del plantel y stats de competición. Sin wellness, lesiones ni riesgo de lesión.',
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label={t('reportsModule.fields.player', 'Atleta')}>
                    <Select value={playerId} onValueChange={setPlayerId} disabled={!players.data?.length}>
                      <SelectTrigger aria-label={t('reportsModule.fields.player', 'Atleta')}>
                        <SelectValue
                          placeholder={
                            players.data?.length
                              ? t('reportsModule.fields.pickPlayer', 'Elige un atleta')
                              : t('reportsModule.fields.noPlayers', 'No hay atletas activos')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(players.data ?? []).map((player) => (
                          <SelectItem key={player.id} value={player.id}>
                            {player.full_name}
                            {player.position ? ` · ${player.position}` : ''}
                            {teamNames.get(player.team_id) ? ` · ${teamNames.get(player.team_id)}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('reportsModule.fields.weeks', 'Semanas')}>
                    <Select value={weeks} onValueChange={setWeeks}>
                      <SelectTrigger aria-label={t('reportsModule.fields.weeks', 'Semanas')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIVIDUAL_WEEKS.map((value) => (
                          <SelectItem key={value} value={String(value)}>
                            {t('reportsModule.fields.weeksOption', '{{count}} semanas', { count: value })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  {loadPeriodField}
                </div>
              </TabsContent>

              {healthAllowed && (
                <TabsContent value="injury_risk" className="mt-4 space-y-3">
                  {help(
                    'reportsModule.generator.injuryRiskHelp',
                    'Nivel y score de riesgo de lesión por atleta con la carga que usó el modelo, fecha de la predicción y métricas reales del modelo. No incluye factores de bienestar ni historial de lesiones.',
                  )}
                  <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                    {t(
                      'reportsModule.generator.injuryRiskRestricted',
                      'Dato de salud: solo admin y cuerpo médico pueden generarlo y verlo en el historial.',
                    )}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">{teamField}</div>
                </TabsContent>
              )}

              <TabsContent value="post_match" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.postMatchHelp',
                  'Métricas por equipo, eventos, velocidades, jugadores y mapas de calor de un análisis de video terminado.',
                )}
                <Field label={t('reportsModule.fields.video', 'Análisis de video')}>
                  <Select value={videoId} onValueChange={setVideoId} disabled={!videos.data?.length}>
                    <SelectTrigger aria-label={t('reportsModule.fields.video', 'Análisis de video')}>
                      <SelectValue
                        placeholder={
                          videos.data?.length
                            ? t('reportsModule.fields.pickVideo', 'Elige un análisis terminado')
                            : t('reportsModule.fields.noVideos', 'No hay análisis terminados')
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(videos.data ?? []).map((video) => (
                        <SelectItem key={video.id} value={video.id}>
                          {video.title}
                          {video.match_date ? ` · ${video.match_date}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </TabsContent>

              <TabsContent value="season_summary" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.seasonSummaryHelp',
                  'Estadísticas de competición de la temporada del equipo, comparación con la media de la conferencia, stats por jugador y volumen físico por mes.',
                )}
                <div className="grid gap-3 sm:grid-cols-2">{teamField}</div>
              </TabsContent>

              <TabsContent value="rival_scouting" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.rivalHelp',
                  'Perfil, plantel scouteado y, si eliges un equipo propio, la simulación del enfrentamiento.',
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t('reportsModule.fields.rival', 'Rival')}>
                    <Select value={rivalId} onValueChange={setRivalId} disabled={!rivals.data?.length}>
                      <SelectTrigger aria-label={t('reportsModule.fields.rival', 'Rival')}>
                        <SelectValue
                          placeholder={
                            rivals.data?.length
                              ? t('reportsModule.fields.pickRival', 'Elige un rival')
                              : t('reportsModule.fields.noRivals', 'No hay rivales: cárgalos en el módulo Rivales')
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {(rivals.data ?? []).map((rival) => (
                          <SelectItem key={rival.id} value={rival.id}>
                            {rival.name}
                            {rival.competition ? ` · ${rival.competition}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label={t('reportsModule.fields.ownTeam', 'Simular contra (opcional)')}
                    hint={t('reportsModule.fields.ownTeamHint', 'Sin equipo propio, el reporte no incluye simulación.')}
                  >
                    <Select value={rivalTeamId} onValueChange={setRivalTeamId}>
                      <SelectTrigger aria-label={t('reportsModule.fields.ownTeam', 'Simular contra (opcional)')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM}>{t('reportsModule.fields.noSimulation', 'Sin simulación')}</SelectItem>
                        {(teams.data ?? []).map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                            {team.season ? ` (${team.season})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="market_shortlist" className="mt-4 space-y-3">
                {help(
                  'reportsModule.generator.marketHelp',
                  'Shortlist de una liga cargada en Mercado actual: métricas clave por 90 minutos con su percentil dentro de la liga y la posición, y el perfil de los cinco mejores.',
                )}
                {leagues.isLoading ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : leagues.error ? (
                  <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
                    {t('reportsModule.generator.optionsError', 'No se pudieron cargar las opciones')}:{' '}
                    {leagues.error instanceof Error ? leagues.error.message : String(leagues.error)}
                  </p>
                ) : !marketLeagues.length ? (
                  <p className="rounded-md border border-border bg-panel px-3 py-2 text-sm text-muted-foreground">
                    {leagues.data?.status === 'table_missing'
                      ? t('market.status.tableMissingTitle', 'La tabla de estadísticas de liga no existe todavía')
                      : t('reportsModule.fields.noLeagues', 'No hay ligas cargadas en Mercado actual.')}
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label={t('reportsModule.fields.league', 'Liga y temporada')}>
                      <Select value={effectiveLeague ? leagueKey(effectiveLeague) : ''} onValueChange={setLeague}>
                        <SelectTrigger aria-label={t('reportsModule.fields.league', 'Liga y temporada')}>
                          <SelectValue placeholder={t('reportsModule.fields.pickLeague', 'Elige una liga')} />
                        </SelectTrigger>
                        <SelectContent>
                          {marketLeagues.map((item) => (
                            <SelectItem key={leagueKey(item)} value={leagueKey(item)}>
                              {t('reportsModule.fields.leagueOption', '{{competition}} · {{season}} ({{players}} jugadores)', {
                                competition: item.competition,
                                season: item.season,
                                players: item.players,
                              })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('reportsModule.fields.position', 'Posición')}>
                      <Select value={position} onValueChange={(value) => setPosition(value as MarketPositionGroup)}>
                        <SelectTrigger aria-label={t('reportsModule.fields.position', 'Posición')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKET_POSITIONS.map((group) => (
                            <SelectItem key={group} value={group}>
                              {t(`market.position.${group}`, group)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label={t('reportsModule.fields.sortMetric', 'Ordenar por (percentil)')}
                      hint={t('reportsModule.fields.sortMetricHint', 'Métricas clave de la posición elegida.')}
                    >
                      <Select value={effectiveSortMetric} onValueChange={setSortMetric} disabled={!positionMetrics.length}>
                        <SelectTrigger aria-label={t('reportsModule.fields.sortMetric', 'Ordenar por (percentil)')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {positionMetrics.map((metric) => (
                            <SelectItem key={metric} value={metric}>
                              {t(`market.metric.${metric}`, metric)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field
                      label={t('reportsModule.fields.minMinutes', 'Minutos mínimos')}
                      hint={t('reportsModule.fields.minMinutesHint', 'El percentil solo se calcula desde 600 minutos.')}
                    >
                      <Select value={minMinutes} onValueChange={setMinMinutes}>
                        <SelectTrigger aria-label={t('reportsModule.fields.minMinutes', 'Minutos mínimos')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHORTLIST_MIN_MINUTES.map((value) => (
                            <SelectItem key={value} value={String(value)}>
                              {t('reportsModule.fields.minMinutesOption', '{{count}} min', { count: value })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('reportsModule.fields.limit', 'Tamaño de la shortlist')}>
                      <Select value={limit} onValueChange={setLimit}>
                        <SelectTrigger aria-label={t('reportsModule.fields.limit', 'Tamaño de la shortlist')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SHORTLIST_LIMITS.map((value) => (
                            <SelectItem key={value} value={String(value)}>
                              {t('reportsModule.fields.limitOption', 'Top {{count}}', { count: value })}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerate} disabled={!canSubmit} isLoading={generate.isPending}>
            {/* Mientras carga, Button ya pinta su spinner: sin esto salían dos íconos. */}
            {!generate.isPending && <FileText className="size-4" aria-hidden="true" />}
            {generate.isPending
              ? t('reportsModule.generator.generating', 'Generando…')
              : t('reportsModule.generator.submit', 'Generar PDF')}
          </Button>
          {lastResult && (
            <Button variant="secondary" onClick={() => void handleDownloadLast()} isLoading={download.isPending}>
              {!download.isPending && <Download className="size-4" aria-hidden="true" />}
              {t('reportsModule.generator.downloadLast', 'Descargar "{{title}}" ({{size}})', {
                title: lastResult.title,
                size: formatBytes(lastResult.file_size_bytes),
              })}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
