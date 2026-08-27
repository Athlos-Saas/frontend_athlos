/**
 * StatsBombAnalytics — página de análisis de datos de eventos StatsBomb Open Data.
 *
 * Secciones:
 *  1. KPI row: partidos, tiros, jugadores, competiciones.
 *  2. Pestaña "Mapa de Tiros" — scatter sobre cancha simplificada.
 *  3. Pestaña "Ranking Jugadores" — tabla top jugadores por xG/goles.
 *  4. Pestaña "Análisis de Formaciones" — tasa de victoria por formación.
 *  5. Pestaña "Entrenar Modelos" — dispara entrenamiento StatsBomb vía backend.
 *
 * Tablas Supabase consultadas: sb_shots, sb_player_match_stats, sb_tactics, sb_matches, sb_competitions.
 */
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, RefreshCw, Target, Trophy, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { ShotMapChart, ShotMapLegend, ShotOutcomeSummary } from '@/components/charts/ShotMapChart';
import { chartAxisColor, chartGridColor, chartTooltipStyle, colors } from '@/constants/tokens';
import { getBackendUrl, trainStatsBombModels } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import type { ShotPoint } from '@/components/charts/ShotMapChart';

// ---------------------------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------------------------

interface KpiData {
  totalMatches: number;
  totalShots: number;
  totalPlayers: number;
  totalCompetitions: number;
}

interface PlayerStat {
  player_name: string;
  matches: number;
  goals: number;
  xg: number;
  assists: number;
  passes_completed: number;
}

interface FormationStat {
  formation: string;
  win_rate: number;
  match_count: number;
}

type Tab = 'shotmap' | 'rankings' | 'formations' | 'train';
type LoadState = 'loading' | 'error' | 'ready';

// ---------------------------------------------------------------------------
// Sub-componentes de pestañas
// ---------------------------------------------------------------------------

function ShotMapTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [shots, setShots] = useState<ShotPoint[] | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    supabase
      .from('sb_shots')
      .select('id, location_x, location_y, xg, outcome, player_name, minute, team_name')
      .eq('org_id', orgId)
      .order('minute', { ascending: true })
      .limit(2000)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          toast({
            title: t('statsbomb.toast.loadShotsErrorTitle', 'No se pudo cargar los tiros'),
            description: error.message,
            variant: 'danger',
          });
          setState('error');
          return;
        }
        setShots(data ?? []);
        setState('ready');
      });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken, t]);

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  if (shots === null || state === 'loading') {
    return <Skeleton className="h-[440px] w-full" />;
  }

  if (shots.length === 0) {
    return (
      <EmptyState
        icon={Target}
        title={t('statsbomb.shotmap.emptyTitle', 'Sin datos de tiros')}
        description={t(
          'statsbomb.shotmap.emptyDescription',
          'Ingesta StatsBomb Open Data para ver el mapa de tiros.',
        )}
      />
    );
  }

  return (
    <ChartCard
      title={t('statsbomb.shotmap.chartTitle', 'Mapa de tiros')}
      description={t('statsbomb.shotmap.chartDescription', 'Coordenadas StatsBomb (120×80m) — tamaño proporcional a xG')}
      height={420}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ShotMapLegend />
          <ShotOutcomeSummary shots={shots} />
        </div>
      }
    >
      <ShotMapChart shots={shots} />
    </ChartCard>
  );
}

function PlayerRankingsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [players, setPlayers] = useState<PlayerStat[] | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    supabase
      .from('sb_player_match_stats')
      .select('player_name, goals, xg, assists, passes_completed, match_id')
      .eq('org_id', orgId)
      .limit(5000)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          toast({
            title: t('statsbomb.toast.loadPlayersErrorTitle', 'No se pudo cargar el ranking'),
            description: error.message,
            variant: 'danger',
          });
          setState('error');
          return;
        }
        // Agrupar por jugador del lado cliente — la tabla tiene una fila por partido
        const map = new Map<string, PlayerStat>();
        for (const row of data ?? []) {
          const key = row.player_name;
          const prev = map.get(key) ?? {
            player_name: key,
            matches: 0,
            goals: 0,
            xg: 0,
            assists: 0,
            passes_completed: 0,
          };
          map.set(key, {
            player_name: key,
            matches: prev.matches + 1,
            goals: prev.goals + (row.goals ?? 0),
            xg: prev.xg + (row.xg ?? 0),
            assists: prev.assists + (row.assists ?? 0),
            passes_completed: prev.passes_completed + (row.passes_completed ?? 0),
          });
        }
        const sorted = [...map.values()].sort((a, b) => b.xg - a.xg).slice(0, 50);
        setPlayers(sorted);
        setState('ready');
      });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken, t]);

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  if (players === null || state === 'loading') {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('statsbomb.rankings.emptyTitle', 'Sin datos de jugadores')}
        description={t('statsbomb.rankings.emptyDescription', 'Ingesta datos para ver el ranking de jugadores.')}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{t('statsbomb.rankings.cardTitle', 'Top jugadores por xG')}</CardTitle>
          <CardDescription className="mt-1">
            {t('statsbomb.rankings.cardDescription', 'Top 50 jugadores — ordenados por xG total acumulado')}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4">#</th>
                <th className="pb-2 pr-4">{t('statsbomb.rankings.col.player', 'Jugador')}</th>
                <th className="pb-2 pr-4 text-right">{t('statsbomb.rankings.col.matches', 'PJ')}</th>
                <th className="pb-2 pr-4 text-right">{t('statsbomb.rankings.col.goals', 'Goles')}</th>
                <th className="pb-2 pr-4 text-right">{t('statsbomb.rankings.col.xg', 'xG')}</th>
                <th className="pb-2 pr-4 text-right">{t('statsbomb.rankings.col.assists', 'Asistencias')}</th>
                <th className="pb-2 text-right">{t('statsbomb.rankings.col.passes', 'Pases completados')}</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, index) => (
                <tr
                  key={p.player_name}
                  className="border-b border-border/50 hover:bg-panel/40 transition-colors"
                >
                  <td className="py-2 pr-4 text-muted-foreground">{index + 1}</td>
                  <td className="py-2 pr-4 font-medium text-foreground">{p.player_name}</td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">{p.matches}</td>
                  <td className="py-2 pr-4 text-right">
                    {p.goals > 0 ? (
                      <Badge variant="success">{p.goals}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium">{p.xg.toFixed(2)}</td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">{p.assists}</td>
                  <td className="py-2 text-right text-muted-foreground">{p.passes_completed.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function FormationsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [formations, setFormations] = useState<FormationStat[] | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');

    // Unimos sb_tactics con sb_matches para calcular win_rate por formación
    // Cargamos tácticas con resultado del partido (match_result de sb_matches)
    supabase
      .from('sb_tactics')
      .select('formation, match_id, team_id')
      .eq('org_id', orgId)
      .limit(5000)
      .then(async ({ data: tacticsData, error: tacticsError }) => {
        if (!isMounted) return;
        if (tacticsError) {
          toast({
            title: t('statsbomb.toast.loadFormationsErrorTitle', 'No se pudo cargar las formaciones'),
            description: tacticsError.message,
            variant: 'danger',
          });
          setState('error');
          return;
        }
        if (!tacticsData || tacticsData.length === 0) {
          setFormations([]);
          setState('ready');
          return;
        }

        // Obtener partidos con resultado
        const matchIds = [...new Set(tacticsData.map((t) => t.match_id))];
        const { data: matchData, error: matchError } = await supabase
          .from('sb_matches')
          .select('match_id, home_team_id, away_team_id, home_score, away_score')
          .eq('org_id', orgId)
          .in('match_id', matchIds.slice(0, 1000));

        if (!isMounted) return;
        if (matchError) {
          // Si no se puede cargar matches, mostrar formaciones sin win_rate
          setFormations([]);
          setState('ready');
          return;
        }

        const matchMap = new Map(
          (matchData ?? []).map((m) => [m.match_id, m]),
        );

        // Calcular win rate por formación
        const formMap = new Map<string, { wins: number; total: number }>();
        for (const tactic of tacticsData) {
          const match = matchMap.get(tactic.match_id);
          if (!match) continue;
          const key = tactic.formation;
          const prev = formMap.get(key) ?? { wins: 0, total: 0 };
          const isHome = match.home_team_id === tactic.team_id;
          const homeScore = match.home_score ?? 0;
          const awayScore = match.away_score ?? 0;
          const won = isHome ? homeScore > awayScore : awayScore > homeScore;
          formMap.set(key, { wins: prev.wins + (won ? 1 : 0), total: prev.total + 1 });
        }

        const result = [...formMap.entries()]
          .filter(([, v]) => v.total >= 3) // mínimo 3 partidos para ser significativo
          .map(([formation, v]) => ({
            formation,
            win_rate: Math.round((v.wins / v.total) * 100),
            match_count: v.total,
          }))
          .sort((a, b) => b.win_rate - a.win_rate)
          .slice(0, 15);

        setFormations(result);
        setState('ready');
      });

    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken, t]);

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  if (formations === null || state === 'loading') {
    return <Skeleton className="h-[380px] w-full" />;
  }

  if (formations.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title={t('statsbomb.formations.emptyTitle', 'Sin datos de formaciones')}
        description={t(
          'statsbomb.formations.emptyDescription',
          'Se necesitan al menos 3 partidos por formación para calcular la tasa de victoria.',
        )}
      />
    );
  }

  return (
    <ChartCard
      title={t('statsbomb.formations.chartTitle', 'Tasa de victoria por formación')}
      description={t('statsbomb.formations.chartDescription', 'Solo formaciones con ≥ 3 partidos — porcentaje de victorias')}
      height={360}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formations}
          layout="vertical"
          margin={{ top: 0, right: 32, bottom: 0, left: 60 }}
        >
          <CartesianGrid stroke={chartGridColor} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            stroke={chartAxisColor}
            fontSize={11}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="formation"
            stroke={chartAxisColor}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={chartTooltipStyle}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            formatter={(value: number, _name: string, props: { payload?: FormationStat }) => [
              `${value}% (${props.payload?.match_count ?? 0} partidos)`,
              t('statsbomb.formations.winRate', 'Tasa de victoria'),
            ]}
          />
          <Bar
            dataKey="win_rate"
            name={t('statsbomb.formations.winRate', 'Tasa de victoria')}
            fill={colors.blue}
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

interface TrainResult {
  model_name: string;
  status: string;
  metrics?: Record<string, unknown>;
}

function TrainModelsTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [isTraining, setIsTraining] = useState(false);
  const [results, setResults] = useState<TrainResult[] | null>(null);
  const backendUrl = getBackendUrl();

  const handleTrainAll = async () => {
    setIsTraining(true);
    setResults(null);
    try {
      const data = await trainStatsBombModels(orgId);
      setResults(data);
      toast({
        title: t('statsbomb.train.successTitle', 'Entrenamiento completado'),
        description: t('statsbomb.train.successDescription', '{{count}} modelos actualizados.', {
          count: data.length,
        }),
        variant: 'success',
      });
    } catch (error) {
      toast({
        title: t('statsbomb.train.errorTitle', 'No se pudo entrenar'),
        description: error instanceof Error ? error.message : t('statsbomb.train.unexpectedError', 'Error inesperado.'),
        variant: 'danger',
      });
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('statsbomb.train.cardTitle', 'Modelos StatsBomb')}</CardTitle>
            <CardDescription className="mt-1">
              {t(
                'statsbomb.train.cardDescription',
                'Reentrena todos los modelos de ML que usan datos de eventos StatsBomb (xG, pases, presión…).',
              )}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {!backendUrl && (
              <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-xs text-warning">
                {t(
                  'statsbomb.train.noBackendHint',
                  'VITE_API_URL no está configurado. El entrenamiento requiere el backend FastAPI accesible desde el navegador.',
                )}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                disabled={!backendUrl}
                isLoading={isTraining}
                onClick={handleTrainAll}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t('statsbomb.train.trainAllButton', 'Entrenar todos los modelos')}
              </Button>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">POST</strong>{' '}
                <code>/v1/statsbomb/train/all?org_id={orgId}</code>
              </p>
              <p>
                {t(
                  'statsbomb.train.hint',
                  'El entrenamiento puede tomar varios minutos dependiendo del volumen de datos cargados.',
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {results !== null && results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('statsbomb.train.resultsTitle', 'Resultados del entrenamiento')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((r) => (
                <div
                  key={r.model_name}
                  className="flex items-start justify-between gap-3 rounded-md border border-border bg-panel/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.model_name}</p>
                    {r.metrics && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(r.metrics)
                          .slice(0, 3)
                          .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : String(v)}`)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={r.status === 'ok' || r.status === 'success' ? 'success' : 'warning'}
                  >
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {results !== null && results.length === 0 && (
        <EmptyState
          icon={Database}
          title={t('statsbomb.train.noResultsTitle', 'Sin resultados')}
          description={t('statsbomb.train.noResultsDescription', 'El backend no devolvió modelos entrenados.')}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function StatsBombAnalytics({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('shotmap');
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [kpiState, setKpiState] = useState<LoadState>('loading');

  // Carga de KPIs: cuatro conteos independientes en paralelo
  useEffect(() => {
    let isMounted = true;
    setKpiState('loading');

    Promise.all([
      supabase.from('sb_matches').select('match_id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('sb_shots').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('sb_player_match_stats').select('player_name', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('sb_competitions').select('competition_id', { count: 'exact', head: true }).eq('org_id', orgId),
    ]).then(([matches, shots, players, competitions]) => {
      if (!isMounted) return;
      const hasError = [matches, shots, players, competitions].some((r) => r.error);
      if (hasError) {
        const firstError = [matches, shots, players, competitions].find((r) => r.error)?.error;
        toast({
          title: t('statsbomb.toast.loadKpiErrorTitle', 'No se pudo cargar los KPIs'),
          description: firstError?.message ?? '',
          variant: 'danger',
        });
        setKpiState('error');
        return;
      }
      setKpi({
        totalMatches: matches.count ?? 0,
        totalShots: shots.count ?? 0,
        totalPlayers: players.count ?? 0,
        totalCompetitions: competitions.count ?? 0,
      });
      setKpiState('ready');
    });

    return () => {
      isMounted = false;
    };
  }, [orgId, t]);

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'shotmap', label: t('statsbomb.tabs.shotmap', 'Mapa de tiros') },
    { key: 'rankings', label: t('statsbomb.tabs.rankings', 'Ranking jugadores') },
    { key: 'formations', label: t('statsbomb.tabs.formations', 'Formaciones') },
    { key: 'train', label: t('statsbomb.tabs.train', 'Entrenar modelos') },
  ];

  return (
    <div>
      {/* Cabecera */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('statsbomb.title', 'StatsBomb Analytics')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('statsbomb.subtitle', 'Datos de eventos profesionales de partidos de élite')}
        </p>
      </div>

      {/* KPI row */}
      {kpiState === 'error' ? (
        <div className="mb-6">
          <ErrorState />
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label={t('statsbomb.kpi.matches', 'Partidos cargados')}
            value={kpi?.totalMatches.toLocaleString() ?? '—'}
            icon={Trophy}
            accent="ai"
            isLoading={kpiState === 'loading'}
          />
          <StatCard
            label={t('statsbomb.kpi.shots', 'Tiros (con xG)')}
            value={kpi?.totalShots.toLocaleString() ?? '—'}
            icon={Target}
            accent="warning"
            isLoading={kpiState === 'loading'}
          />
          <StatCard
            label={t('statsbomb.kpi.players', 'Jugadores')}
            value={kpi?.totalPlayers.toLocaleString() ?? '—'}
            icon={Users}
            accent="purple"
            isLoading={kpiState === 'loading'}
          />
          <StatCard
            label={t('statsbomb.kpi.competitions', 'Competiciones')}
            value={kpi?.totalCompetitions.toLocaleString() ?? '—'}
            icon={Database}
            accent="success"
            isLoading={kpiState === 'loading'}
          />
        </div>
      )}

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
      {activeTab === 'shotmap' && <ShotMapTab orgId={orgId} />}
      {activeTab === 'rankings' && <PlayerRankingsTab orgId={orgId} />}
      {activeTab === 'formations' && <FormationsTab orgId={orgId} />}
      {activeTab === 'train' && <TrainModelsTab orgId={orgId} />}
    </div>
  );
}
