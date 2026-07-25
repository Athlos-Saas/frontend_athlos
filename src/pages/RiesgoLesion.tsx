import { useEffect, useState } from 'react';
import { HeartPulse, RefreshCw } from 'lucide-react';

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
}

export default function RiesgoLesion({ orgId, role }: { orgId: string; role: string | null }) {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
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
    ]).then(([predictionsRes, playersRes]) => {
      if (!isMounted) return;
      if (predictionsRes.error || playersRes.error) {
        setState('error');
        return;
      }
      const nameById = new Map((playersRes.data ?? []).map((p) => [p.id, p.full_name as string]));
      const nextRows: RiskRow[] = ((predictionsRes.data ?? []) as MlPrediction[])
        .filter((p) => p.player_id)
        .map((p) => {
          const features = (p.features ?? {}) as Record<string, number | null>;
          return {
            player_id: p.player_id!,
            full_name: nameById.get(p.player_id!) ?? 'Jugador desconocido',
            label: p.label,
            score: p.score ?? null,
            acwr: features.acwr ?? null,
            dias_desde_ultima_lesion: features.dias_desde_ultima_lesion ?? null,
            lesiones_ultimos_365_dias: features.lesiones_ultimos_365_dias ?? null,
          };
        })
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      setRows(nextRows);
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
      toast({ title: 'Evaluación actualizada', description: `${written} jugadores evaluados.`, variant: 'success' });
      setReloadToken((n) => n + 1);
    } catch (error) {
      toast({ title: 'No se pudo actualizar', description: error instanceof Error ? error.message : undefined, variant: 'danger' });
    } finally {
      setIsTraining(false);
    }
  };

  const columns: DataTableColumn<RiskRow>[] = [
    { id: 'full_name', header: 'Jugador', sortable: true, accessor: (row) => row.full_name, className: 'font-medium text-foreground' },
    {
      id: 'label',
      header: 'Nivel de riesgo',
      sortable: true,
      accessor: (row) => row.label,
      cell: (row) => <Badge variant={RISK_BADGE[row.label as RiskLevel] ?? 'neutral'}>{row.label}</Badge>,
    },
    {
      id: 'acwr',
      header: 'ACWR (7d/28d)',
      sortable: true,
      accessor: (row) => row.acwr ?? '',
      cell: (row) => (row.acwr != null ? row.acwr.toFixed(2) : 'Sin datos suficientes'),
    },
    {
      id: 'dias_desde_ultima_lesion',
      header: 'Última lesión',
      sortable: true,
      accessor: (row) => row.dias_desde_ultima_lesion ?? '',
      cell: (row) => (row.dias_desde_ultima_lesion != null ? `Hace ${row.dias_desde_ultima_lesion} días` : 'Sin historial'),
    },
    {
      id: 'lesiones_ultimos_365_dias',
      header: 'Lesiones (365 días)',
      sortable: true,
      accessor: (row) => row.lesiones_ultimos_365_dias ?? 0,
    },
  ];

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Riesgo de lesión</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Puntaje heurístico basado en ACWR (carga aguda 7 días / carga crónica 28 días) + historial de
            lesiones — no es un modelo entrenado, mejora con más wellness diario y lesiones tipificadas.
          </p>
        </div>
        {canWrite(role) && (
          <Button
            variant="secondary"
            size="sm"
            disabled={!backendUrl}
            isLoading={isTraining}
            onClick={handleAssess}
            title={backendUrl ? undefined : 'Configura VITE_API_URL para habilitar esto.'}
          >
            <RefreshCw className="size-4" aria-hidden="true" /> Actualizar evaluación
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Jugadores evaluados</CardTitle>
            <CardDescription className="mt-1">
              Excluye jugadores con una lesión activa (ya están lesionados, no "en riesgo").
            </CardDescription>
          </div>
        </CardHeader>

        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.player_id}
          isLoading={state === 'loading'}
          searchPlaceholder="Buscar jugador…"
          exportFileName="riesgo-lesion.csv"
          emptyState={
            <EmptyState
              icon={HeartPulse}
              title="Sin evaluación todavía"
              description="Corré la evaluación para ver el riesgo de lesión de tu plantilla."
            />
          }
        />
      </Card>
    </div>
  );
}
