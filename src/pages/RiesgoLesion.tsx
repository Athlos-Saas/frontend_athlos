import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, HeartPulse, RefreshCw } from 'lucide-react';

import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getBackendUrl, triggerTraining } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import type { MlPrediction } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

type RiskLevel = 'bajo' | 'medio' | 'alto';
type Confidence = 'alta' | 'baja';

const RISK_BADGE: Record<RiskLevel, 'success' | 'warning' | 'danger'> = {
  bajo: 'success',
  medio: 'warning',
  alto: 'danger',
};

interface RiskRow {
  player_id: string;
  full_name: string;
  label: string;
  score: number | null;
  acwr: number | null;
  dias_desde_ultima_lesion: number | null;
  lesiones_ultimos_365_dias: number | null;
  confianza: Confidence | null;
}

export default function RiesgoLesion({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const backendUrl = getBackendUrl();

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    Promise.all([
      supabase
        .from('ml_predictions')
        .select('player_id, label, score, features, created_at')
        .eq('org_id', orgId)
        .eq('prediction_type', 'injury_risk'),
      supabase.from('players').select('id, full_name').eq('org_id', orgId),
      supabase
        .from('ml_models')
        .select('metrics')
        .eq('org_id', orgId)
        .eq('name', 'injury_risk_acwr_heuristic')
        .order('trained_at', { ascending: false })
        .limit(1),
    ]).then(([predictionsRes, playersRes, modelsRes]) => {
      if (!isMounted) return;
      if (predictionsRes.error || playersRes.error) {
        setState('error');
        return;
      }
      const nameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.full_name as string]));
      const nextRows: RiskRow[] = ((predictionsRes.data ?? []) as MlPrediction[])
        .filter((p) => p.player_id)
        .map((p) => {
          const features = (p.features ?? {}) as Record<string, number | string | null>;
          return {
            player_id: p.player_id!,
            full_name: nameById.get(p.player_id!) ?? t('riesgoLesion.unknownPlayer', 'Jugador desconocido'),
            label: p.label,
            score: p.score ?? null,
            acwr: (features.acwr as number | null) ?? null,
            dias_desde_ultima_lesion: (features.dias_desde_ultima_lesion as number | null) ?? null,
            lesiones_ultimos_365_dias: (features.lesiones_ultimos_365_dias as number | null) ?? null,
            confianza: (features.confianza as Confidence | null) ?? null,
          };
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setRows(nextRows);
      const metrics = modelsRes.data?.[0]?.metrics as Record<string, unknown> | undefined;
      setWarning(typeof metrics?.advertencia === 'string' ? metrics.advertencia : null);
      setState('ready');
    });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  const handleAssess = async () => {
    setIsTraining(true);
    try {
      const results = await triggerTraining('injury_risk', { org_id: orgId });
      const written = results[0]?.predictions_written ?? 0;
      const metrics = results[0]?.metrics as Record<string, unknown> | undefined;
      setWarning(typeof metrics?.advertencia === 'string' ? metrics.advertencia : null);
      toast({
        title: t('riesgoLesion.toast.updated.title', 'Evaluación actualizada'),
        description: t('riesgoLesion.toast.updated.description', '{{count}} jugadores evaluados.', {
          count: written,
        }),
        variant: 'success',
      });
      setReloadToken((n) => n + 1);
    } catch (error) {
      toast({
        title: t('riesgoLesion.toast.failed.title', 'No se pudo actualizar'),
        description: error instanceof Error ? error.message : undefined,
        variant: 'danger',
      });
    } finally {
      setIsTraining(false);
    }
  };

  const columns: DataTableColumn<RiskRow>[] = [
    {
      id: 'full_name',
      header: t('riesgoLesion.col.player', 'Jugador'),
      sortable: true,
      accessor: (row) => row.full_name,
      className: 'font-medium text-foreground',
    },
    {
      id: 'label',
      header: t('riesgoLesion.col.riskLevel', 'Nivel de riesgo'),
      sortable: true,
      accessor: (row) => row.label,
      cell: (row) => <Badge variant={RISK_BADGE[row.label as RiskLevel] ?? 'neutral'}>{row.label}</Badge>,
    },
    {
      id: 'acwr',
      header: t('riesgoLesion.col.acwr', 'ACWR (7d/28d)'),
      sortable: true,
      accessor: (row) => row.acwr ?? '',
      cell: (row) => (row.acwr != null ? row.acwr.toFixed(2) : t('riesgoLesion.insufficientData', 'Sin datos suficientes')),
    },
    {
      id: 'dias_desde_ultima_lesion',
      header: t('riesgoLesion.col.lastInjury', 'Última lesión'),
      sortable: true,
      accessor: (row) => row.dias_desde_ultima_lesion ?? '',
      cell: (row) =>
        row.dias_desde_ultima_lesion != null
          ? t('riesgoLesion.daysAgo', 'Hace {{count}} días', { count: row.dias_desde_ultima_lesion })
          : t('riesgoLesion.noHistory', 'Sin historial'),
    },
    {
      id: 'lesiones_ultimos_365_dias',
      header: t('riesgoLesion.col.injuries365', 'Lesiones (365 días)'),
      sortable: true,
      accessor: (row) => row.lesiones_ultimos_365_dias ?? 0,
    },
    {
      id: 'confianza',
      header: t('riesgoLesion.col.confidence', 'Confianza'),
      sortable: true,
      accessor: (row) => row.confianza ?? '',
      cell: (row) =>
        row.confianza ? (
          <Badge variant={row.confianza === 'alta' ? 'success' : 'warning'}>{row.confianza}</Badge>
        ) : (
          '—'
        ),
    },
  ];

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t('riesgoLesion.title', 'Riesgo de lesión')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'riesgoLesion.subtitle',
              'Puntaje heurístico basado en ACWR (carga aguda 7 días / carga crónica 28 días) + historial de lesiones — no es un modelo entrenado, mejora con más wellness diario y lesiones tipificadas.'
            )}
          </p>
        </div>
        {canWrite(role) && (
          <Button
            variant="secondary"
            size="sm"
            disabled={!backendUrl}
            isLoading={isTraining}
            onClick={handleAssess}
            title={
              backendUrl
                ? undefined
                : t('riesgoLesion.backendUrlRequired', 'Configura VITE_API_URL para habilitar esto.')
            }
          >
            <RefreshCw className="size-4" aria-hidden="true" />{' '}
            {t('riesgoLesion.updateAssessment', 'Actualizar evaluación')}
          </Button>
        )}
      </div>

      {warning && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('riesgoLesion.evaluatedPlayers', 'Jugadores evaluados')}</CardTitle>
            <CardDescription className="mt-1">
              {t(
                'riesgoLesion.evaluatedPlayersDescription',
                'Excluye jugadores con una lesión activa (ya están lesionados, no "en riesgo").'
              )}
            </CardDescription>
          </div>
        </CardHeader>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.player_id}
          isLoading={state === 'loading'}
          searchPlaceholder={t('riesgoLesion.searchPlaceholder', 'Buscar jugador…')}
          exportFileName="riesgo-lesion.csv"
          emptyState={
            <EmptyState
              icon={HeartPulse}
              title={t('riesgoLesion.empty.title', 'Sin evaluación todavía')}
              description={t(
                'riesgoLesion.empty.description',
                'Corré la evaluación para ver el riesgo de lesión de tu plantilla.'
              )}
            />
          }
        />
      </Card>
    </div>
  );
}
