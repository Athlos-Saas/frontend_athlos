import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, Gauge, UserRound, Video } from 'lucide-react';
import { Link } from 'react-router-dom';

import { DistributionDonutChart, type DonutDatum } from '@/components/charts/DistributionDonutChart';
import { TrendAreaChart } from '@/components/charts/TrendAreaChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
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

export default function Dashboard({ orgId }: { orgId: string }) {
  const [state, setState] = useState<LoadState>('loading');
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [models, setModels] = useState<MlModel[]>([]);
  const [sessionSeries, setSessionSeries] = useState<{ date: string; sesiones: number }[]>([]);
  const [predictionFeed, setPredictionFeed] = useState<MlPrediction[]>([]);
  const [donutData, setDonutData] = useState<DonutDatum[]>([]);
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

        const hasError = [playersRes, sessionsRes, videosRes, predictionsRes, alertsRes, modelsRes, sessionDatesRes, feedRes].some(
          (res) => res.error,
        );
        if (hasError) {
          setState('error');
          return;
        }

        setKpis({
          players: playersRes.count ?? 0,
          sessions: sessionsRes.count ?? 0,
          videos: videosRes.count ?? 0,
          predictionsTotal: predictionsRes.count ?? 0,
          activeAlerts: alertsRes.count ?? 0,
        });
        setModels(modelsRes.data ?? []);
        setSessionSeries(buildDailySessionSeries((sessionDatesRes.data ?? []).map((row) => row.session_date)));
        const feed = feedRes.data ?? [];
        setPredictionFeed(feed.slice(0, 6));
        setDonutData(buildDonutData(feed));
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Centro de inteligencia deportiva</h1>
          <p className="mt-1 text-sm text-muted-foreground">Resumen en tiempo real de tu organización</p>
        </div>
        <Badge variant="ai" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-ai" /> Datos en vivo
        </Badge>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Atletas monitoreados" value={kpis?.players ?? 0} icon={UserRound} accent="ai" isLoading={state === 'loading'} />
        <StatCard label="Sesiones GPS" value={kpis?.sessions ?? 0} icon={Activity} accent="purple" isLoading={state === 'loading'} />
        <StatCard label="Videos analizados" value={kpis?.videos ?? 0} icon={Video} accent="ai" isLoading={state === 'loading'} />
        <StatCard
          label="Predicciones IA"
          value={kpis?.predictionsTotal ?? 0}
          icon={BrainCircuit}
          accent="purple"
          isLoading={state === 'loading'}
        />
        <StatCard
          label="Alertas activas"
          value={kpis?.activeAlerts ?? 0}
          icon={AlertTriangle}
          accent={kpis && kpis.activeAlerts > 0 ? 'danger' : 'success'}
          isLoading={state === 'loading'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Sesiones GPS · últimos 14 días"
          description="Volumen de sesiones registradas por toda la organización"
          isLoading={state === 'loading'}
          className="lg:col-span-2"
        >
          <TrendAreaChart data={sessionSeries} xKey="date" yKey="sesiones" name="Sesiones" color={colors.blue} />
        </ChartCard>

        <ChartCard
          title="Distribución de predicciones"
          description="Últimas 120 predicciones del modelo, por etiqueta"
          isLoading={state === 'loading'}
        >
          {donutData.length === 0 ? (
            <EmptyState icon={Gauge} title="Sin predicciones recientes" />
          ) : (
            <DistributionDonutChart data={donutData} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Modelos entrenados recientes</CardTitle>
              <CardDescription className="mt-1">Últimas versiones registradas por el pipeline de ML</CardDescription>
            </div>
            <Link to="/modelos" className="text-xs font-medium text-ai hover:underline">
              Ver todos →
            </Link>
          </CardHeader>
          {state === 'ready' && models.length === 0 ? (
            <EmptyState
              icon={BrainCircuit}
              title="Sin modelos aún"
              description={
                <>
                  Corre <code>run_training.py</code> en el backend.
                </>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Versión</TableHead>
                  <TableHead>Métricas clave</TableHead>
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
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actividad reciente</CardTitle>
          </CardHeader>
          {state === 'ready' && predictionFeed.length === 0 && (
            <EmptyState icon={Activity} title="Sin actividad reciente" />
          )}
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
                        {new Date(prediction.created_at).toLocaleString('es-ES')}
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
