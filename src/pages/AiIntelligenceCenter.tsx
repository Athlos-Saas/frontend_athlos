import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Sparkles, Target } from 'lucide-react';

import { DataTable, type DataTableColumn, type DataTableFilter } from '@/components/tables/DataTable';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { TimelineList, type TimelineItem } from '@/components/charts/TimelineList';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatCard } from '@/components/ui/StatCard';
import { colors } from '@/constants/tokens';
import { supabase } from '@/lib/supabase';
import type { MlModel, MlPrediction } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

const ANOMALY_LABELS = ['alto', 'anomala'];

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function extractPrimaryMetric(metrics: MlModel['metrics']): number | null {
  if (!metrics) return null;
  const numeric = Object.values(metrics).find((value): value is number => typeof value === 'number');
  return numeric ?? null;
}

function normalize(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.round((value / max) * 100);
}

export default function AiIntelligenceCenter({ orgId }: { orgId: string }) {
  const [state, setState] = useState<LoadState>('loading');
  const [models, setModels] = useState<MlModel[]>([]);
  const [predictions, setPredictions] = useState<MlPrediction[]>([]);
  const [counts, setCounts] = useState({ players: 0, sessions: 0, videos: 0, predictionsTotal: 0, predictions30d: 0, anomalies: 0 });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');

    Promise.all([
      supabase
        .from('ml_models')
        .select('name, version, task, metrics, trained_at')
        .eq('org_id', orgId)
        .order('trained_at', { ascending: false })
        .limit(50),
      supabase
        .from('ml_predictions')
        .select('player_id, prediction_type, label, score, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('gps_sessions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('video_analyses').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase.from('ml_predictions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
      supabase
        .from('ml_predictions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .gte('created_at', daysAgoIso(30)),
      supabase
        .from('ml_predictions')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .in('prediction_type', ['fatigue_risk', 'anomaly'])
        .in('label', ANOMALY_LABELS),
    ]).then(([modelsRes, predictionsRes, playersRes, sessionsRes, videosRes, predictionsTotalRes, predictions30dRes, anomaliesRes]) => {
      if (!isMounted) return;

      const hasError = [modelsRes, predictionsRes, playersRes, sessionsRes, videosRes, predictionsTotalRes, predictions30dRes, anomaliesRes].some(
        (res) => res.error,
      );
      if (hasError) {
        setState('error');
        return;
      }

      setModels(modelsRes.data ?? []);
      setPredictions(predictionsRes.data ?? []);
      setCounts({
        players: playersRes.count ?? 0,
        sessions: sessionsRes.count ?? 0,
        videos: videosRes.count ?? 0,
        predictionsTotal: predictionsTotalRes.count ?? 0,
        predictions30d: predictions30dRes.count ?? 0,
        anomalies: anomaliesRes.count ?? 0,
      });
      setState('ready');
    });

    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  const avgPrecision = useMemo(() => {
    const values = models.map((model) => extractPrimaryMetric(model.metrics)).filter((v): v is number => v !== null);
    if (values.length === 0) return null;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return avg <= 1 ? avg * 100 : avg;
  }, [models]);

  const coverageData = useMemo(() => {
    const raw = [
      { axis: 'Atletas', value: counts.players },
      { axis: 'Sesiones GPS', value: counts.sessions },
      { axis: 'Videos', value: counts.videos },
      { axis: 'Predicciones', value: counts.predictionsTotal },
      { axis: 'Modelos', value: models.length },
    ];
    const max = Math.max(...raw.map((r) => r.value), 1);
    return raw.map((r) => ({ axis: r.axis, cobertura: normalize(r.value, max) }));
  }, [counts, models.length]);

  const timelineItems: TimelineItem[] = useMemo(
    () =>
      models.slice(0, 8).map((model) => ({
        id: `${model.name}-${model.version}`,
        title: (
          <>
            <span className="font-semibold">{model.name}</span> · v{model.version}
          </>
        ),
        description: <Badge variant="ai">{model.task}</Badge>,
        timestamp: new Date(model.trained_at).toLocaleString('es-ES'),
        accent: 'purple',
      })),
    [models],
  );

  const predictionTypes = useMemo(() => [...new Set(predictions.map((p) => p.prediction_type))], [predictions]);

  const predictionColumns: DataTableColumn<MlPrediction>[] = useMemo(
    () => [
      { id: 'prediction_type', header: 'Tipo', sortable: true, accessor: (row) => row.prediction_type },
      {
        id: 'label',
        header: 'Etiqueta',
        sortable: true,
        accessor: (row) => row.label,
        cell: (row) => <Badge variant={ANOMALY_LABELS.includes(row.label) ? 'danger' : 'ai'}>{row.label}</Badge>,
      },
      { id: 'score', header: 'Score', sortable: true, align: 'right', accessor: (row) => row.score ?? 0 },
      {
        id: 'created_at',
        header: 'Fecha',
        sortable: true,
        accessor: (row) => row.created_at,
        cell: (row) => new Date(row.created_at).toLocaleString('es-ES'),
      },
    ],
    [],
  );

  const predictionTypeFilter: DataTableFilter<MlPrediction> = {
    columnId: 'prediction_type',
    label: 'Tipo',
    options: predictionTypes,
    accessor: (row) => row.prediction_type,
  };

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Sparkles className="size-6 text-purple" aria-hidden="true" />
            AI Intelligence Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Insights, predicciones y salud de los modelos de Machine Learning de tu organización
          </p>
        </div>
        <Badge variant="purple">ml_models · ml_predictions</Badge>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Modelos activos" value={models.length} icon={BrainCircuit} accent="purple" isLoading={state === 'loading'} />
        <StatCard
          label="Predicciones (30 días)"
          value={counts.predictions30d}
          icon={Sparkles}
          accent="ai"
          isLoading={state === 'loading'}
        />
        <StatCard
          label="Anomalías detectadas"
          value={counts.anomalies}
          icon={AlertTriangle}
          accent={counts.anomalies > 0 ? 'danger' : 'success'}
          isLoading={state === 'loading'}
        />
        <StatCard
          label="Precisión media"
          value={avgPrecision !== null ? `${avgPrecision.toFixed(1)}%` : '—'}
          icon={Target}
          accent="success"
          isLoading={state === 'loading'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title="Precisión media de modelos"
          description="Promedio de la primera métrica numérica reportada por cada modelo"
          isLoading={state === 'loading'}
        >
          <GaugeChart value={avgPrecision ?? 0} label="Precisión" formatValue={(v) => `${v.toFixed(0)}%`} color={colors.green} />
        </ChartCard>
        <ChartCard
          title="Cobertura del sistema IA"
          description="Volumen relativo por categoría, normalizado 0-100"
          isLoading={state === 'loading'}
          className="lg:col-span-2"
        >
          <RadarComparisonChart data={coverageData} dataKey="cobertura" angleKey="axis" name="Cobertura" />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Predicciones recientes</CardTitle>
              <CardDescription className="mt-1">Últimas 200 predicciones generadas por los modelos</CardDescription>
            </div>
          </CardHeader>
          <DataTable
            columns={predictionColumns}
            data={predictions}
            getRowId={(row) => `${row.player_id}-${row.created_at}-${row.prediction_type}`}
            isLoading={state === 'loading'}
            searchPlaceholder="Buscar por tipo o etiqueta…"
            filters={predictionTypes.length > 1 ? [predictionTypeFilter] : undefined}
            exportFileName="predicciones-ia.csv"
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historial de modelos</CardTitle>
          </CardHeader>
          {timelineItems.length > 0 && <TimelineList items={timelineItems} />}
        </Card>
      </div>
    </div>
  );
}
