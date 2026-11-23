import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, UserRound, Video } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { DistributionDonutChart, type DonutDatum } from '@/components/charts/DistributionDonutChart';
import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatCard } from '@/components/ui/StatCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from '@/components/ui/Table';
import { chartSeriesPalette, colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import { getDateLocale } from '@/utils/dateLocale';
import type { MlModel, MlPrediction } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

interface Kpis {
  players: number;
  sessions: number;
  videos: number;
  predictionsTotal: number;
  activeAlerts: number;
}

const ALERT_LABELS = ['alto', 'anomala'];
const ALERT_TYPES = ['fatigue_risk', 'anomaly'];

function last14DaysWindow() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 13);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function buildDailySessionSeries(dates: string[]) {
  const { start } = last14DaysWindow();
  const buckets = new Map<string, number>();
  for (let i = 0; i < 14; i += 1) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    buckets.set(day.toISOString().slice(0, 10), 0);
  }
  dates.forEach((date) => {
    if (buckets.has(date)) buckets.set(date, (buckets.get(date) ?? 0) + 1);
  });
  return Array.from(buckets.entries()).map(([date, sesiones]) => ({
    date: date.slice(5).replace('-', '/'),
    sesiones,
  }));
}

function buildDonutData(predictions: MlPrediction[]): DonutDatum[] {
  const counts = new Map<string, number>();
  predictions.forEach((prediction) => {
    counts.set(prediction.label, (counts.get(prediction.label) ?? 0) + 1);
  });
  return Array.from(counts.entries()).map(([name, value], index) => ({
    name,
    value,
    color: chartSeriesPalette[index % chartSeriesPalette.length],
  }));
}

// ---------------------------------------------------------------------------
// Datos de demostración (fallback).
//
// Requisito de producto: el dashboard NO debe verse vacío nunca — ni un KPI en
// cero ni un gráfico sin datos. Cuando una consulta no devuelve filas (org
// recién creada, tabla aún sin poblar, o error puntual de una tabla), se
// rellena con estos datos generados de forma determinista, y el widget se
// marca visualmente como "demo" para no confundirlos con datos reales.
// ---------------------------------------------------------------------------

const DEMO_KPIS: Kpis = {
  players: 24,
  sessions: 587,
  videos: 13,
  predictionsTotal: 1240,
  activeAlerts: 6,
};

function demoSessionSeries(): { date: string; sesiones: number }[] {
  const { start } = last14DaysWindow();
  // Serie pseudo-aleatoria pero determinista (misma forma en cada render).
  const pattern = [4, 6, 3, 8, 5, 2, 7, 9, 4, 6, 3, 8, 5, 7];
  return pattern.map((sesiones, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    return { date: day.toISOString().slice(5, 10).replace('-', '/'), sesiones };
  });
}

function demoDonutData(): DonutDatum[] {
  return [
    { name: 'normal', value: 68, color: chartSeriesPalette[0] },
    { name: 'alto', value: 22, color: chartSeriesPalette[1] },
    { name: 'anomala', value: 10, color: chartSeriesPalette[2] },
    { name: 'esperado', value: 20, color: chartSeriesPalette[3] },
  ];
}

function demoModels(): MlModel[] {
  const now = Date.now();
  const day = 86_400_000;
  return [
    { name: 'physical_profile_kmeans', version: 'demo-01', task: 'clustering', metrics: { inertia: 12.4, clusters: 3 }, trained_at: new Date(now - day).toISOString() },
    { name: 'fatigue_risk_rf', version: 'demo-01', task: 'classification', metrics: { accuracy: 0.93, recall: 0.88 }, trained_at: new Date(now - day * 2).toISOString() },
    { name: 'top_scorer_logreg', version: 'demo-01', task: 'classification', metrics: { auc: 0.891, accuracy: 0.824 }, trained_at: new Date(now - day * 3).toISOString() },
    { name: 'session_anomaly_iforest', version: 'demo-01', task: 'anomaly_detection', metrics: { anomalies: 6, rate: 0.05 }, trained_at: new Date(now - day * 4).toISOString() },
    { name: 'player_load_reg', version: 'demo-01', task: 'regression', metrics: { r2_cv: 0.9, mae_cv: 24.1 }, trained_at: new Date(now - day * 5).toISOString() },
  ] as MlModel[];
}

function demoFeed(): MlPrediction[] {
  const now = Date.now();
  const hour = 3_600_000;
  const rows: Array<[string, string]> = [
    ['fatigue_risk', 'alto'],
    ['physical_profile', 'Velocista'],
    ['anomaly', 'anomala'],
    ['player_load_expected', 'esperado'],
    ['fatigue_risk', 'normal'],
    ['physical_profile', 'Equilibrado'],
  ];
  return rows.map(([prediction_type, label], i) => ({
    prediction_type,
    label,
    created_at: new Date(now - hour * (i + 1) * 2).toISOString(),
  })) as MlPrediction[];
}

export default function Dashboard({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [models, setModels] = useState<MlModel[]>([]);
  const [sessionSeries, setSessionSeries] = useState<{ date: string; sesiones: number }[]>([]);
  const [predictionFeed, setPredictionFeed] = useState<MlPrediction[]>([]);
  const [donutData, setDonutData] = useState<DonutDatum[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');

    const { start } = last14DaysWindow();

    Promise.all([
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('gps_sessions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('video_analyses').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('ml_predictions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('ml_predictions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('prediction_type', ALERT_TYPES)
        .in('label', ALERT_LABELS),
      supabase
        .from('ml_models')
        .select('name, version, task, metrics, trained_at')
        .eq('org_id', orgId)
        .order('trained_at', { ascending: false })
        .limit(5),
      supabase.from('gps_sessions').select('session_date').eq('org_id', orgId).gte('session_date', start),
      supabase
        .from('ml_predictions')
        .select('prediction_type, label, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(120),
    ]).then(
      ([playersRes, sessionsRes, videosRes, predictionsRes, alertsRes, modelsRes, sessionDatesRes, feedRes]) => {
        if (!isMounted) return;

        // Antes: si CUALQUIER query fallaba, toda la pantalla iba a 'error' y
        // se veía vacía. Ahora cada widget degrada por su cuenta — un 500
        // intermitente en una tabla grande (p. ej. ml_predictions) no debe
        // tumbar los KPIs ni el resto del dashboard. Solo vamos a 'error' si
        // fallan TODAS (probable problema de sesión/red, no de una tabla).
        const results = [playersRes, sessionsRes, videosRes, predictionsRes, alertsRes, modelsRes, sessionDatesRes, feedRes];
        if (results.every((res) => res.error)) {
          setState('error');
          return;
        }

        // KPIs reales; si TODOS vienen en cero (org vacía), se usan los demo.
        const realKpis: Kpis = {
          players: playersRes.count ?? 0,
          sessions: sessionsRes.count ?? 0,
          videos: videosRes.count ?? 0,
          predictionsTotal: predictionsRes.count ?? 0,
          activeAlerts: alertsRes.count ?? 0,
        };
        const kpisEmpty =
          realKpis.players === 0 &&
          realKpis.sessions === 0 &&
          realKpis.videos === 0 &&
          realKpis.predictionsTotal === 0;
        let demo = false;

        setKpis(kpisEmpty ? DEMO_KPIS : realKpis);
        if (kpisEmpty) demo = true;

        // Cada widget cae a demo si no trae datos, de forma independiente.
        const realModels = modelsRes.data ?? [];
        if (realModels.length > 0) {
          setModels(realModels);
        } else {
          setModels(demoModels());
          demo = true;
        }

        const realSeries = buildDailySessionSeries((sessionDatesRes.data ?? []).map((row) => row.session_date));
        const seriesHasData = realSeries.some((point) => point.sesiones > 0);
        if (seriesHasData) {
          setSessionSeries(realSeries);
        } else {
          setSessionSeries(demoSessionSeries());
          demo = true;
        }

        const feed = feedRes.data ?? [];
        if (feed.length > 0) {
          setPredictionFeed(feed.slice(0, 6));
          setDonutData(buildDonutData(feed));
        } else {
          setPredictionFeed(demoFeed());
          setDonutData(demoDonutData());
          demo = true;
        }

        setUsingDemo(demo);
        setState('ready');
      },
    );

    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  if (state === 'error') {
    return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t('dashboard.title', 'Centro de inteligencia deportiva')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.subtitle', 'Resumen en tiempo real de tu organización')}</p>
        </div>
        <Badge variant={usingDemo ? 'warning' : 'ai'} className="gap-1.5">
          <span className={`size-1.5 rounded-full ${usingDemo ? 'bg-warning' : 'bg-ai'}`} />{' '}
          {usingDemo
            ? t('dashboard.demoData', 'Datos de demostración')
            : t('dashboard.liveData', 'Datos en vivo')}
        </Badge>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t('dashboard.kpi.players', 'Atletas monitoreados')}
          value={kpis?.players ?? 0}
          icon={UserRound}
          accent="ai"
          isLoading={state === 'loading'}
        />
        <StatCard
          label={t('dashboard.kpi.sessions', 'Sesiones GPS')}
          value={kpis?.sessions ?? 0}
          icon={Activity}
          accent="purple"
          isLoading={state === 'loading'}
        />
        <StatCard
          label={t('dashboard.kpi.videos', 'Videos analizados')}
          value={kpis?.videos ?? 0}
          icon={Video}
          accent="ai"
          isLoading={state === 'loading'}
        />
        <StatCard
          label={t('dashboard.kpi.predictions', 'Predicciones IA')}
          value={kpis?.predictionsTotal ?? 0}
          icon={BrainCircuit}
          accent="purple"
          isLoading={state === 'loading'}
        />
        <StatCard
          label={t('dashboard.kpi.activeAlerts', 'Alertas activas')}
          value={kpis?.activeAlerts ?? 0}
          icon={AlertTriangle}
          accent={kpis && kpis.activeAlerts > 0 ? 'danger' : 'success'}
          isLoading={state === 'loading'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title={t('dashboard.chart.sessions.title', 'Sesiones GPS · últimos 14 días')}
          description={t('dashboard.chart.sessions.description', 'Volumen de sesiones registradas por toda la organización')}
          isLoading={state === 'loading'}
          className="lg:col-span-2"
          exportData={sessionSeries}
          exportColumns={[
            { key: 'date', header: t('dataviz.columns.date', 'Fecha') },
            { key: 'sesiones', header: t('dashboard.chart.sessions.seriesName', 'Sesiones') },
          ]}
        >
          <TrendAreaChart
            data={sessionSeries}
            xKey="date"
            yKey="sesiones"
            name={t('dashboard.chart.sessions.seriesName', 'Sesiones')}
            color={colors.blue}
          />
        </ChartCard>

        <ChartCard
          title={t('dashboard.chart.predictions.title', 'Distribución de predicciones')}
          description={t('dashboard.chart.predictions.description', 'Últimas 120 predicciones del modelo, por etiqueta')}
          isLoading={state === 'loading'}
          exportData={donutData}
          exportColumns={[
            { key: 'name', header: t('dataviz.columns.label', 'Etiqueta') },
            { key: 'value', header: t('dataviz.columns.count', 'Cantidad') },
          ]}
        >
          <DistributionDonutChart data={donutData} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t('dashboard.recentModels.title', 'Modelos entrenados recientes')}</CardTitle>
              <CardDescription className="mt-1">
                {t('dashboard.recentModels.description', 'Últimas versiones registradas por el pipeline de ML')}
              </CardDescription>
            </div>
            <Link to="/modelos" className="text-xs font-medium text-ai hover:underline">
              {t('dashboard.recentModels.viewAll', 'Ver todos →')}
            </Link>
          </CardHeader>
          <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.col.model', 'Modelo')}</TableHead>
                  <TableHead>{t('dashboard.col.task', 'Tarea')}</TableHead>
                  <TableHead>{t('dashboard.col.version', 'Versión')}</TableHead>
                  <TableHead>{t('dashboard.col.metrics', 'Métricas clave')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state === 'loading' ? (
                  <TableSkeletonRows columns={4} rows={4} />
                ) : (
                  models.map((model) => (
                    <TableRow key={`${model.name}-${model.version}`}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        <Badge variant="ai">{model.task}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{model.version}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {Object.entries(model.metrics || {})
                          .slice(0, 3)
                          .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(3) : String(value)}`)
                          .join(' · ')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity.title', 'Actividad reciente')}</CardTitle>
          </CardHeader>
          <ul className="space-y-3">
            {state === 'loading'
              ? Array.from({ length: 4 }).map((_, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={index} className="h-10 animate-pulse rounded-md bg-border/40" />
                ))
              : predictionFeed.map((prediction, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={index} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ai" />
                    <div>
                      <p className="text-foreground">
                        <span className="font-medium">{prediction.prediction_type}</span>{' '}
                        <span className="text-muted-foreground">→ {prediction.label}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(prediction.created_at).toLocaleString(getDateLocale())}
                      </p>
                    </div>
                  </li>
                ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
