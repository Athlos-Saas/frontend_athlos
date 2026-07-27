import { useEffect, useState } from 'react';
import { BrainCircuit, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { getBackendUrl, triggerTraining } from '@/lib/backendApi';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';
import { canWrite } from '@/utils/permissions';
import type { MlModel } from '@/types/domain';

type LoadState = 'loading' | 'error' | 'ready';

function formatMetrics(metrics: MlModel['metrics']) {
  return Object.entries(metrics || {})
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(3) : String(value)}`)
    .join(' · ');
}

function buildColumns(t: TFunction): DataTableColumn<MlModel>[] {
  return [
    { id: 'name', header: t('modelosIa.col.model', 'Modelo'), sortable: true, accessor: (row) => row.name, className: 'font-medium text-foreground' },
    {
      id: 'task',
      header: t('modelosIa.col.task', 'Tarea'),
      sortable: true,
      accessor: (row) => row.task,
      cell: (row) => <Badge variant="ai">{row.task}</Badge>,
    },
    { id: 'version', header: t('modelosIa.col.version', 'Versión'), sortable: true, accessor: (row) => row.version },
    { id: 'metrics', header: t('modelosIa.col.metrics', 'Métricas clave'), accessor: (row) => formatMetrics(row.metrics), className: 'text-xs text-muted-foreground' },
    {
      id: 'trained_at',
      header: t('modelosIa.col.trained', 'Entrenado'),
      sortable: true,
      accessor: (row) => row.trained_at,
      cell: (row) => new Date(row.trained_at).toLocaleDateString('es-ES'),
    },
  ];
}

export default function ModelosIa({ orgId, role }: { orgId: string; role: string | null }) {
  const { t } = useTranslation();
  const [models, setModels] = useState<MlModel[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [isTraining, setIsTraining] = useState(false);
  const backendUrl = getBackendUrl();

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    supabase
      .from('ml_models')
      .select('name, version, task, metrics, trained_at')
      .eq('org_id', orgId)
      .order('trained_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setState('error');
          return;
        }
        setModels(data ?? []);
        setState('ready');
      });
    return () => {
      isMounted = false;
    };
  }, [orgId, reloadToken]);

  const handleRetrain = async () => {
    setIsTraining(true);
    try {
      const physical = await triggerTraining('physical', { org_id: orgId });
      const technical = await triggerTraining('technical', { org_id: orgId, season });
      toast({
        title: t('modelosIa.toast.retrainSuccessTitle', 'Reentrenamiento completo'),
        description: t('modelosIa.toast.retrainSuccessDescription', '{{count}} modelos actualizados.', {
          count: physical.length + technical.length,
        }),
        variant: 'success',
      });
      setReloadToken((n) => n + 1);
    } catch (error) {
      toast({
        title: t('modelosIa.toast.retrainErrorTitle', 'No se pudo reentrenar'),
        description: error instanceof Error ? error.message : t('modelosIa.toast.unexpectedError', 'Error inesperado.'),
        variant: 'danger',
      });
    } finally {
      setIsTraining(false);
    }
  };

  if (state === 'error') return <ErrorState onRetry={() => setReloadToken((n) => n + 1)} />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('modelosIa.title', 'Modelos IA')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('modelosIa.subtitlePrefix', 'Registro de modelos entrenados por el pipeline de Machine Learning (')}
            <code>run_training.py</code>
            {t('modelosIa.subtitleSuffix', ').')}
          </p>
        </div>
        {canWrite(role) && (
          <div className="flex items-end gap-2">
            <Field label={t('modelosIa.seasonLabel', 'Temporada')} htmlFor="retrain-season" className="max-w-[140px]">
              <Input id="retrain-season" value={season} onChange={(event) => setSeason(event.target.value)} />
            </Field>
            <Button
              variant="secondary"
              size="sm"
              disabled={!backendUrl}
              isLoading={isTraining}
              onClick={handleRetrain}
              title={backendUrl ? undefined : t('modelosIa.retrainDisabledHint', 'Configura VITE_API_URL para habilitar esto (ver .env.example).')}
            >
              <RefreshCw className="size-4" aria-hidden="true" /> {t('modelosIa.retrainButton', 'Reentrenar modelos')}
            </Button>
          </div>
        )}
      </div>

      {canWrite(role) && !backendUrl && (
        <p className="mb-5 text-xs text-muted-foreground">
          {t('modelosIa.retrainHintPrefix', '"Reentrenar modelos" necesita un backend FastAPI accesible desde el navegador (VITE_API_URL). Mientras tanto, corre ')}
          <code>run_training.py</code>
          {t('modelosIa.retrainHintSuffix', ' desde el backend.')}
        </p>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('modelosIa.cardTitle', 'Modelos entrenados')}</CardTitle>
            <CardDescription className="mt-1">{t('modelosIa.cardDescription', 'Últimas 50 versiones registradas para tu organización')}</CardDescription>
          </div>
        </CardHeader>

        <DataTable
          columns={buildColumns(t)}
          data={models}
          getRowId={(row) => `${row.name}-${row.version}`}
          isLoading={state === 'loading'}
          searchPlaceholder={t('modelosIa.searchPlaceholder', 'Buscar modelo o tarea…')}
          exportFileName="modelos-ia.csv"
          emptyState={
            <EmptyState
              icon={BrainCircuit}
              title={t('modelosIa.emptyTitle', 'Sin modelos entrenados aún')}
              description={
                <>
                  {t('modelosIa.emptyDescriptionPrefix', 'Corre ')}
                  <code>run_training.py</code>
                  {t('modelosIa.emptyDescriptionSuffix', ' en el backend para generar la primera versión.')}
                </>
              }
            />
          }
        />
      </Card>
    </div>
  );
}
