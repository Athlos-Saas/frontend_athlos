import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, Sparkles, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DistributionDonutChart, type DonutDatum } from '@/components/charts/DistributionDonutChart';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { TimelineList, type TimelineItem } from '@/components/charts/TimelineList';
import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { StatCard } from '@/components/ui/StatCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { chartSeriesPalette, colors } from '@/constants/tokens';
import { fetchInsightsSummary, type InsightsSummary } from '@/lib/backendApi';
import { getDateLocale } from '@/utils/dateLocale';

type LoadState = 'loading' | 'error' | 'ready';

const ALERT_LABELS = ['alto', 'anomala', 'alta'];

function normalize(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.round((value / max) * 100);
}

/**
 * AI Intelligence Center — consume /v1/insights/summary del backend en vez de
 * consultar ml_predictions (124K filas) desde el navegador, que devolvía 500
 * de PostgREST vía RLS y dejaba la pantalla vacía. El backend agrega con la
 * service key y devuelve un payload pequeño.
 */
export default function AiIntelligenceCenter({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [summary, setSummary] = useState<InsightsSummary | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    fetchInsightsSummary(orgId)
      .then((data) => {
        if (!isMounted) return;
        setSummary(data);
        setState('ready');
      })
      .catch(() => {
        if (!isMounted) return;
        setState('error');
      });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  const counts = summary?.counts;
  const models = summary?.recent_models ?? [];

  const avgPrecision = summary?.avg_accuracy ?? null;

  const coverageData = useMemo(() => {
    if (!counts) return [];
    const raw = [
      { axis: t('aiIntelligenceCenter.axis.players', 'Atletas'), value: counts.players },
      { axis: t('aiIntelligenceCenter.axis.sessions', 'Sesiones GPS'), value: counts.sessions },
      { axis: t('aiIntelligenceCenter.axis.videos', 'Videos'), value: counts.videos },
      { axis: t('aiIntelligenceCenter.axis.predictions', 'Predicciones'), value: counts.predictions_total },
      { axis: t('aiIntelligenceCenter.axis.models', 'Modelos'), value: counts.models },
    ];
    const max = Math.max(...raw.map((r) => r.value), 1);
    return raw.map((r) => ({ axis: r.axis, cobertura: normalize(r.value, max) }));
  }, [counts, t]);

  const donutData: DonutDatum[] = useMemo(
    () =>
      (summary?.distribution ?? []).map((d, i) => ({
        name: d.name,
        value: d.value,
        color: chartSeriesPalette[i % chartSeriesPalette.length],
      })),
    [summary?.distribution],
  );

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
        timestamp: new Date(model.trained_at).toLocaleString(getDateLocale()),
        accent: 'purple',
      })),
    [models, i18n.language],
  );

  if (state === 'error') {
    return (
      <ErrorState
        title={t('aiIntelligenceCenter.loadError', 'No se pudo cargar el centro de inteligencia')}
        description={t('aiIntelligenceCenter.loadErrorDesc', '¿El backend está corriendo y accesible desde el navegador (VITE_API_URL)?')}
        onRetry={() => setReloadToken((n) => n + 1)}
      />
    );
  }

  if (state === 'loading' || !summary) {
    return <LoadingOverlay message={t('aiIntelligenceCenter.loading', 'Analizando modelos y predicciones…')} />;
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Sparkles className="size-6 text-purple" aria-hidden="true" />
            {t('aiIntelligenceCenter.title', 'Centro de Inteligencia IA')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('aiIntelligenceCenter.subtitle', 'Insights, predicciones y salud de los modelos de Machine Learning de tu organización')}
          </p>
        </div>
        <Badge variant="purple">{counts?.models ?? 0} {t('aiIntelligenceCenter.modelsBadge', 'modelos')}</Badge>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('aiIntelligenceCenter.kpi.activeModels', 'Modelos activos')}
          value={counts?.models ?? 0}
          icon={BrainCircuit}
          accent="purple"
        />
        <StatCard
          label={t('aiIntelligenceCenter.kpi.predictions30d', 'Predicciones (30 días)')}
          value={counts?.predictions_30d ?? 0}
          icon={Sparkles}
          accent="ai"
        />
        <StatCard
          label={t('aiIntelligenceCenter.kpi.anomalies', 'Alertas activas')}
          value={counts?.active_alerts ?? 0}
          icon={AlertTriangle}
          accent={(counts?.active_alerts ?? 0) > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label={t('aiIntelligenceCenter.kpi.avgPrecision', 'Precisión media')}
          value={avgPrecision !== null ? `${avgPrecision.toFixed(1)}%` : '—'}
          icon={Target}
          accent="success"
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title={t('aiIntelligenceCenter.chart.precision.title', 'Precisión media de modelos')}
          description={t('aiIntelligenceCenter.chart.precision.description', 'Promedio de la primera métrica numérica reportada por cada modelo')}
        >
          <GaugeChart
            value={avgPrecision ?? 0}
            label={t('aiIntelligenceCenter.chart.precision.gaugeLabel', 'Precisión')}
            formatValue={(v) => `${v.toFixed(0)}%`}
            color={colors.green}
          />
        </ChartCard>
        <ChartCard
          title={t('aiIntelligenceCenter.chart.coverage.title', 'Cobertura del sistema IA')}
          description={t('aiIntelligenceCenter.chart.coverage.description', 'Volumen relativo por categoría, normalizado 0-100')}
          className="lg:col-span-2"
        >
          <RadarComparisonChart
            data={coverageData}
            dataKey="cobertura"
            angleKey="axis"
            name={t('aiIntelligenceCenter.chart.coverage.seriesName', 'Cobertura')}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t('aiIntelligenceCenter.distribution.title', 'Distribución de predicciones recientes')}</CardTitle>
              <CardDescription className="mt-1">
                {t('aiIntelligenceCenter.distribution.description', 'Etiquetas de las últimas predicciones generadas por los modelos')}
              </CardDescription>
            </div>
          </CardHeader>
          {donutData.length === 0 ? (
            <EmptyState icon={Sparkles} title={t('aiIntelligenceCenter.distribution.empty', 'Sin predicciones recientes')} />
          ) : (
            <div className="h-72">
              <DistributionDonutChart data={donutData} />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('aiIntelligenceCenter.modelHistory.title', 'Historial de modelos')}</CardTitle>
          </CardHeader>
          {timelineItems.length > 0 ? (
            <TimelineList items={timelineItems} />
          ) : (
            <EmptyState icon={BrainCircuit} title={t('aiIntelligenceCenter.modelHistory.empty', 'Sin modelos aún')} />
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{t('aiIntelligenceCenter.recentActivity.title', 'Actividad reciente')}</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('aiIntelligenceCenter.col.type', 'Tipo')}</TableHead>
              <TableHead>{t('aiIntelligenceCenter.col.label', 'Etiqueta')}</TableHead>
              <TableHead>{t('aiIntelligenceCenter.col.date', 'Fecha')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(summary.recent_activity ?? []).map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <TableRow key={index}>
                <TableCell className="font-medium text-foreground">{row.prediction_type}</TableCell>
                <TableCell>
                  <Badge variant={ALERT_LABELS.includes((row.label || '').toLowerCase()) ? 'danger' : 'ai'}>
                    {row.label}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(row.created_at).toLocaleString(getDateLocale())}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
