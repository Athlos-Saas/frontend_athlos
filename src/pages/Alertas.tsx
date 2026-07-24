import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, HeartPulse, Radar } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';

/** Tipos de predicción que constituyen una alerta accionable (mismo criterio que la ficha del jugador). */
const ALERT_FILTER: Record<string, { types: string[]; labels: string[] }> = {
  all: {
    types: ['fatigue_risk', 'anomaly', 'player_load_expected'],
    labels: ['alto', 'anomala', 'sobre_esfuerzo'],
  },
  fatigue_risk: { types: ['fatigue_risk'], labels: ['alto'] },
  anomaly: { types: ['anomaly'], labels: ['anomala'] },
  player_load_expected: { types: ['player_load_expected'], labels: ['sobre_esfuerzo'] },
};

const TYPE_META: Record<string, { label: string; badge: 'danger' | 'warning'; description: string }> = {
  fatigue_risk: { label: 'Fatiga alta', badge: 'danger', description: 'El modelo clasificó la sesión como riesgo de fatiga alto' },
  anomaly: { label: 'Sesión anómala', badge: 'warning', description: 'Métricas fuera del patrón habitual del plantel' },
  player_load_expected: { label: 'Sobre-esfuerzo', badge: 'danger', description: 'Player Load muy por encima de lo esperado' },
};

interface AlertRow {
  prediction_type: string;
  label: string;
  score: number | null;
  created_at: string;
  player_id: string | null;
}

interface ActiveInjury {
  id: string;
  player_id: string;
  severity: 'minor' | 'moderate' | 'severe';
  injury_date: string;
  notes: string | null;
}

export default function Alertas({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [injuries, setInjuries] = useState<ActiveInjury[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const filter = ALERT_FILTER.all;
    Promise.all([
      supabase
        .from('ml_predictions')
        .select('prediction_type, label, score, created_at, player_id')
        .eq('org_id', orgId)
        .in('prediction_type', filter.types)
        .in('label', filter.labels)
        .order('created_at', { ascending: false })
        .limit(120),
      supabase.from('injuries').select('id, player_id, severity, injury_date, notes').eq('org_id', orgId).is('return_date', null),
    ]).then(async ([alertsRes, injuriesRes]) => {
      if (alertsRes.error) {
        toast({ title: 'No se pudieron cargar las alertas', description: alertsRes.error.message, variant: 'danger' });
        setAlerts([]);
        return;
      }
      const alertRows = (alertsRes.data as AlertRow[]) ?? [];
      const injuryRows = (injuriesRes.data as ActiveInjury[]) ?? [];
      setAlerts(alertRows);
      setInjuries(injuryRows);

      const ids = [
        ...new Set([...alertRows.map((a) => a.player_id), ...injuryRows.map((i) => i.player_id)].filter(Boolean) as string[]),
      ];
      if (ids.length > 0) {
        const { data: playersData } = await supabase.from('players').select('id, full_name').in('id', ids);
        setPlayerNames(Object.fromEntries((playersData ?? []).map((p) => [p.id, p.full_name])));
      }
    });
  }, [orgId]);

  const visibleAlerts = useMemo(() => {
    if (!alerts) return [];
    const filter = ALERT_FILTER[typeFilter] ?? ALERT_FILTER.all;
    return alerts.filter((alert) => filter.types.includes(alert.prediction_type) && filter.labels.includes(alert.label));
  }, [alerts, typeFilter]);

  if (alerts === null) return <Skeleton className="h-96 w-full" />;

  const fatigueCount = alerts.filter((a) => a.prediction_type === 'fatigue_risk').length;
  const anomalyCount = alerts.filter((a) => a.prediction_type === 'anomaly').length;
  const overexertionCount = alerts.filter((a) => a.prediction_type === 'player_load_expected').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Alertas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Señales de riesgo detectadas por los modelos de IA y lesiones activas del plantel
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Lesiones activas"
          value={<AnimatedNumber value={injuries.length} />}
          icon={HeartPulse}
          accent={injuries.length > 0 ? 'danger' : 'success'}
        />
        <StatCard label="Riesgo de fatiga" value={<AnimatedNumber value={fatigueCount} />} icon={AlertTriangle} accent="danger" />
        <StatCard label="Sobre-esfuerzo" value={<AnimatedNumber value={overexertionCount} />} icon={Bell} accent="warning" />
        <StatCard label="Sesiones anómalas" value={<AnimatedNumber value={anomalyCount} />} icon={Radar} accent="purple" />
      </div>

      {injuries.length > 0 && (
        <Card className="mb-5 border-danger/30">
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-2.5 rounded-full bg-danger animate-pulse-glow" />
                Lesiones activas
              </CardTitle>
              <CardDescription className="mt-1">Jugadores sin fecha de retorno registrada</CardDescription>
            </div>
          </CardHeader>
          <div className="space-y-2">
            {injuries.map((injury, index) => (
              <button
                key={injury.id}
                type="button"
                onClick={() => navigate(`/atletas/${injury.player_id}`)}
                className="animate-slide-up focus-ring flex w-full items-center justify-between gap-3 rounded-md border border-border bg-panel px-4 py-3 text-left transition-colors hover:border-danger/40 hover:bg-card"
                style={{ animationDelay: `${Math.min(index * 50, 400)}ms`, animationFillMode: 'backwards' }}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{playerNames[injury.player_id] ?? 'Jugador'}</p>
                  <p className="text-xs text-muted-foreground">
                    Desde {new Date(injury.injury_date).toLocaleDateString('es-ES')}
                    {injury.notes ? ` · ${injury.notes}` : ''}
                  </p>
                </div>
                <Badge variant={injury.severity === 'severe' ? 'danger' : 'warning'}>{injury.severity}</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Alertas de los modelos</CardTitle>
            <CardDescription className="mt-1">Últimas {alerts.length} señales generadas al reentrenar</CardDescription>
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="fatigue_risk">Fatiga alta</SelectItem>
              <SelectItem value="player_load_expected">Sobre-esfuerzo</SelectItem>
              <SelectItem value="anomaly">Sesiones anómalas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>

        {visibleAlerts.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Sin alertas"
            description="No hay señales de riesgo con este filtro. Se generan al reentrenar los modelos físicos."
          />
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((alert, index) => {
              const meta = TYPE_META[alert.prediction_type];
              return (
                <button
                  key={`${alert.prediction_type}-${alert.created_at}-${index}`}
                  type="button"
                  onClick={() => alert.player_id && navigate(`/atletas/${alert.player_id}`)}
                  className="animate-slide-up focus-ring flex w-full items-center justify-between gap-3 rounded-md border border-border bg-panel px-4 py-3 text-left transition-colors hover:border-ai/40 hover:bg-card"
                  style={{ animationDelay: `${Math.min(index * 30, 500)}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={meta?.badge ?? 'warning'}>{meta?.label ?? alert.prediction_type}</Badge>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {alert.player_id ? playerNames[alert.player_id] ?? 'Jugador' : 'Plantel'}
                      </p>
                      <p className="text-xs text-muted-foreground">{meta?.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {alert.score !== null && <p className="text-sm font-semibold text-foreground">{alert.score.toFixed(2)}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString('es-ES')}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
