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
import { getDateLocale } from '@/utils/dateLocale';
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
      cell: (row) => new Date(row.trained_at).toLocaleDateString(getDateLocale()),
    },
  ];
}

/**
 * Catálogo fijo de modelos de IA con su explicación, features, métrica y uso.
 * El contenido es documentación — no sale de una query, porque la explicación
 * de "qué hace el modelo" no cambia en cada entrenamiento.
 */
const MODEL_CATALOG = [
  {
    name: 'physical_profile_kmeans',
    task: 'Clustering',
    what: 'Agrupa jugadores en 3 perfiles físicos (Velocista, Equilibrado, Resistente) según sus medias de sesiones GPS.',
    features: 'distance_km, sprint_distance_m, top_speed_kmh, player_load (medias por jugador).',
    metric: 'Inercia del cluster (menor = más compacto). No hay accuracy: es clustering, no clasificación.',
    usage: 'Identifica el motor físico de cada jugador para dosificar cargas y programar entrenamientos diferenciados.',
  },
  {
    name: 'fatigue_risk_rf',
    task: 'Clasificación',
    what: 'Clasifica cada sesión GPS como riesgo de fatiga "alto" o "normal" con un Random Forest.',
    features: 'distance_km, sprint_distance_m, player_load, top_speed_kmh, impacts, hr_load.',
    metric: 'Accuracy 0.93, recall 0.88 (validación cruzada). La etiqueta de entrenamiento es z-score(player_load) > +1.',
    usage: 'Alerta en tiempo real de sesiones de carga excesiva antes de que el sobreuso cause una lesión.',
  },
  {
    name: 'session_anomaly_iforest',
    task: 'Detección de anomalías',
    what: 'Detecta sesiones GPS atípicas con Isolation Forest (5% de contaminación).',
    features: 'Las mismas que fatigue_risk, normalizadas.',
    metric: 'Tasa de anomalías detectadas (aprox. 5%). No hay accuracy: es anomalía, no etiqueta conocida.',
    usage: 'Separa errores de captura de esfuerzos anómalos reales que merecen revisión del staff.',
  },
  {
    name: 'player_load_ridge',
    task: 'Regresión',
    what: 'Predice el Player Load esperado de una sesión (Ridge) para detectar sobre-esfuerzo (real > esperado).',
    features: 'distance_km, sprint_distance_m, duration_s, top_speed_kmh.',
    metric: 'R² ≈ 0.90, MAE ≈ 24 (validación cruzada).',
    usage: 'Si la carga real supera mucho la esperada, marca "sobre-esfuerzo" como señal de riesgo.',
  },
  {
    name: 'injury_risk_rf',
    task: 'Clasificación',
    what: 'Predice la probabilidad de lesión en los próximos 14 días con Random Forest, usando GPS + wellness + historial.',
    features: 'ACWR, carga aguda/crónica, media 7d de RPE, soreness, sleep, mood, lesiones previas.',
    metric: 'AUC ≈ 0.79. Precision/recall bajas al umbral 0.5 por evento raro (~10%), no por fallo del modelo.',
    usage: 'Proyecta qué jugadores tienen mayor riesgo de lesionarse esta semana. Clave para rotaciones.',
  },
  {
    name: 'top_scorer_logreg',
    task: 'Clasificación',
    what: 'Rankea atacantes de la liga por probabilidad de ser "goleador de élite" (regresión logística).',
    features: 'goals/game, assists/game, shots/game, sh_pct, sog_pct (por partido).',
    metric: 'AUC 0.891, accuracy 0.824 (validación cruzada).',
    usage: 'Identifica prospectos ofensivos de la liga con perfil de goleador para el scouting.',
  },
  {
    name: 'attacker_roles_kmeans',
    task: 'Clustering',
    what: 'Clasifica atacantes de la liga en 4 roles: Finalizador, Creador/mixto, Llegador desde atrás, Bajo volumen.',
    features: 'goals/game, assists/game, points/game, shots/game.',
    metric: 'Conteo por rol y jugadores asignados.',
    usage: 'Etiqueta el estilo de cada atacante para entender qué aporta y a quién se parece.',
  },
  {
    name: 'goalkeeper_roles_kmeans',
    task: 'Clustering',
    what: 'Clasifica porteros de la liga en 3 roles: Shot-stopper, Alto volumen, Eficiente.',
    features: 'gaa, save_pct, saves/game.',
    metric: 'Conteo por rol.',
    usage: 'Perfila porteros para scouting y comparación dentro de la conferencia.',
  },
  {
    name: 'xg_statsbomb',
    task: 'Clasificación (xG)',
    what: 'Modelo xG propio entrenado con +86K tiros de partidos de élite (Gradient Boosting).',
    features: 'Distancia, ángulo, body_part, shot_type, play_pattern, presión, primer toque, regate, portería vacía.',
    metric: 'AUC ~0.80, MAE vs StatsBomb ≈ 0.04.',
    usage: 'Mide la calidad real de cada oportunidad de gol. Base del xG interactivo y del análisis de tiros.',
  },
  {
    name: 'player_similarity_statsbomb',
    task: 'Similitud',
    what: 'Para cada jugador de élite, encuentra los 10 más parecidos por distancia euclidiana en 11 dimensiones tácticas.',
    features: 'Pases, pases progresivos, key passes, tiros, xG, regates, tackles, intercepciones, presiones, carries, duelos aéreos (todo p90).',
    metric: 'Distancia al más similar (menor = más parecido).',
    usage: 'Motor de scouting: "dame jugadores parecidos a X" en segundos.',
  },
  {
    name: 'tactical_roles_statsbomb',
    task: 'Clustering',
    what: 'Roles tácticos emergentes por K-Means multidimensional sobre stats p90.',
    features: 'Las 11 dimensiones tácticas normalizadas.',
    metric: 'Silhouette score.',
    usage: 'Descubre patrones de juego no evidentes: "este jugador juega como un volante de contención aunque sea mediapunta".',
  },
  {
    name: 'best_xi_suggestion',
    task: 'Optimización de alineación',
    what: 'Sugiere el 11 ideal de un equipo combinando disponibilidad física y aporte técnico, respetando la formación.',
    features: 'Readiness (fatiga, lesión, carga, anomalías) + contribución técnica (stats de liga).',
    metric: 'Score medio del 11 sugerido.',
    usage: 'Herramienta de decisión pre-partido: quién está disponible Y quién rinde más, por posición.',
  },
];

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

      {/* ---- Catálogo explicativo de cada modelo de IA ---- */}
      <div className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          {t('modelosIa.catalog.title', 'Catálogo de modelos')}
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {t('modelosIa.catalog.description', 'Qué hace cada modelo, con qué datos se entrena, qué métrica mide y cómo ayuda al cuerpo técnico.')}
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {MODEL_CATALOG.map((m) => (
            <Card key={m.name}>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {m.name} <Badge variant="ai">{m.task}</Badge>
                  </CardTitle>
                </div>
              </CardHeader>
              <div className="space-y-2 text-xs">
                <p className="text-foreground">{m.what}</p>
                <p className="text-muted-foreground"><strong>Features:</strong> {m.features}</p>
                <p className="text-muted-foreground"><strong>Métrica clave:</strong> {m.metric}</p>
                <p className="text-muted-foreground"><strong>Uso práctico:</strong> {m.usage}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
