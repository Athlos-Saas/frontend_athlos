import { useMemo } from 'react';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SpeedComparisonChart } from '@/components/charts/SpeedComparisonChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartCard } from '@/components/ui/ChartCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { usePagedRows } from '@/hooks/usePagedRows';
import { colors } from '@/constants/tokens';
import { formatDate, formatDateTime } from '../format';
import { usePlayerGpsSessions, usePlayerPredictions, usePlayerVideoTracks } from '../queries';
import { buildSpeedTimeline } from '../speedTimeline';

const ALERT_TYPES = ['fatigue_risk', 'anomaly', 'player_load_expected'];
const ALERT_LABELS = ['alto', 'anomala', 'sobre_esfuerzo'];

export default function TabRendimiento({ orgId, playerId }: { orgId: string; playerId: string }) {
  const { t } = useTranslation();
  const sessions = usePlayerGpsSessions(orgId, playerId);
  const predictions = usePlayerPredictions(orgId, playerId);
  const videoTracks = usePlayerVideoTracks(orgId, playerId);

  const typeLabel = useMemo<Record<string, string>>(
    () => ({
      fatigue_risk: t('tabRendimiento.type.fatigue', 'Fatiga'),
      anomaly: t('tabRendimiento.type.anomaly', 'Anomalía'),
      player_load_expected: t('tabRendimiento.type.overexertion', 'Sobre-esfuerzo'),
    }),
    [t],
  );

  const sessionRows = sessions.data ?? [];
  const { timeline: speedTimeline, videosWithoutDate } = useMemo(
    () => buildSpeedTimeline(sessionRows, videoTracks.data ?? []),
    [sessionRows, videoTracks.data],
  );

  const alerts = (predictions.data ?? []).filter(
    (prediction) => ALERT_TYPES.includes(prediction.prediction_type) && ALERT_LABELS.includes(prediction.label),
  );
  const alertsPager = usePagedRows(alerts, 10);

  if (sessions.isLoading || predictions.isLoading || videoTracks.isLoading) return <Skeleton className="h-80 w-full" />;

  if (sessionRows.length === 0 && speedTimeline.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={t('tabRendimiento.empty.title', 'Sin datos de rendimiento')}
        description={t(
          'tabRendimiento.empty.description',
          'Este jugador todavía no tiene sesiones GPS ni video con fecha de partido registrados.',
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sessionRows.length > 0 && (
          <ChartCard title={t('tabRendimiento.chart.playerLoad', 'Player Load por sesión')}>
            <TrendLineChart
              data={sessionRows}
              xKey="session_date"
              yKey="player_load"
              name={t('tabRendimiento.chart.playerLoadSeriesName', 'Player Load')}
              color={colors.green}
            />
          </ChartCard>
        )}
        {speedTimeline.length > 0 && (
          <ChartCard title={t('tabRendimiento.chart.speedComparison', 'Velocidad máxima: GPS vs. video (km/h)')}>
            <SpeedComparisonChart data={speedTimeline} />
          </ChartCard>
        )}
      </div>
      {videosWithoutDate > 0 && (
        <p className="text-xs text-muted-foreground">
          {t(
            'tabRendimiento.videosWithoutDate',
            '{{count}} lecturas de video de este jugador no tienen fecha de partido y no aparecen en la comparación — se puede agregar la fecha editando el video en Video análisis.',
            { count: videosWithoutDate },
          )}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('tabRendimiento.alerts.title', 'Alertas del modelo')}</CardTitle>
          {alerts.length > 0 && (
            <Badge variant="danger">{t('tabRendimiento.alerts.totalCount', '{{count}} en total', { count: alerts.length })}</Badge>
          )}
        </CardHeader>
        {alerts.length === 0 ? (
          <EmptyState
            title={t('tabRendimiento.alerts.empty.title', 'Sin alertas')}
            description={t(
              'tabRendimiento.alerts.empty.description',
              'No hay fatiga, sobre-esfuerzo ni sesiones anómalas registradas para este jugador.',
            )}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tabRendimiento.col.type', 'Tipo')}</TableHead>
                  <TableHead>{t('tabRendimiento.col.label', 'Etiqueta')}</TableHead>
                  <TableHead className="text-right">{t('tabRendimiento.col.score', 'Score')}</TableHead>
                  <TableHead>{t('tabRendimiento.col.date', 'Fecha')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertsPager.paged.map((alert, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <TableRow key={index}>
                    <TableCell>{typeLabel[alert.prediction_type] ?? alert.prediction_type}</TableCell>
                    <TableCell>
                      <Badge variant={alert.label === 'anomala' ? 'warning' : 'danger'}>{alert.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{alert.score?.toFixed(3) ?? '--'}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(alert.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination page={alertsPager.page} pageCount={alertsPager.pageCount} onPageChange={alertsPager.setPage} className="mt-4" />
          </>
        )}
      </Card>

      {sessionRows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('tabRendimiento.lastSession', 'Última sesión: {{date}}', {
            date: formatDate(sessionRows[sessionRows.length - 1]?.session_date),
          })}
        </p>
      )}
    </div>
  );
}
