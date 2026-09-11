/**
 * PronosticosIA — proyecciones por jugador: riesgo de lesión y fatiga
 * (modelos entrenados) + proyección ofensiva (goles/asistencias próximos 5
 * partidos, derivada del promedio de la liga). Consume /v1/insights/forecasts
 * del backend (agregado con service key para no reventar el navegador).
 *
 * Filtros: por nivel de riesgo y por posición.
 */
import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BrainCircuit, HeartPulse, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { StatCard } from '@/components/ui/StatCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { fetchForecasts, type ForecastEntry, type ForecastsResult } from '@/lib/backendApi';

type LoadState = 'loading' | 'error' | 'ready';
type RiskFilter = 'all' | 'high' | 'medium' | 'low';

function RiskBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">--</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 60 ? '#ef4444' : pct >= 35 ? '#f59e0b' : '#22c55e';
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border/60">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-9 text-right text-sm font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

/** Nivel de riesgo combinado (lesión + fatiga) para el filtro. */
function riskLevel(f: ForecastEntry): RiskFilter {
  const inj = f.injury_risk ?? 0;
  const fatigueHigh = f.fatigue_label === 'alto';
  if (inj >= 0.6 || fatigueHigh) return 'high';
  if (inj >= 0.35) return 'medium';
  return 'low';
}

export default function PronosticosIA({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<LoadState>('loading');
  const [data, setData] = useState<ForecastsResult | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [positionFilter, setPositionFilter] = useState('all');

  useEffect(() => {
    let isMounted = true;
    setState('loading');
    fetchForecasts(orgId)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
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

  const positions = useMemo(
    () => [...new Set((data?.forecasts ?? []).map((f) => f.position).filter(Boolean))],
    [data],
  );

  const filtered = useMemo(() => {
    let rows = data?.forecasts ?? [];
    if (riskFilter !== 'all') rows = rows.filter((f) => riskLevel(f) === riskFilter);
    if (positionFilter !== 'all') rows = rows.filter((f) => f.position === positionFilter);
    return rows;
  }, [data, riskFilter, positionFilter]);

  if (state === 'error') {
    return (
      <ErrorState
        title={t('pronosticos.loadError', 'No se pudieron cargar los pronósticos')}
        description={t('pronosticos.loadErrorDesc', '¿El backend está corriendo y hay modelos de riesgo entrenados?')}
        onRetry={() => setReloadToken((n) => n + 1)}
      />
    );
  }

  if (state === 'loading' || !data) {
    return <LoadingOverlay message={t('pronosticos.loading', 'Calculando pronósticos por jugador…')} />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <BrainCircuit className="size-6 text-purple" aria-hidden="true" />
          {t('pronosticos.title', 'Pronósticos IA')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pronosticos.subtitle', 'Riesgo de lesión y fatiga + proyección ofensiva por jugador, según los modelos entrenados con tus datos')}
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('pronosticos.kpi.withForecast', 'Jugadores con pronóstico')} value={data.summary.players_with_forecast} icon={Activity} accent="ai" />
        <StatCard label={t('pronosticos.kpi.highInjury', 'Riesgo de lesión alto')} value={data.summary.high_injury_risk} icon={HeartPulse} accent={data.summary.high_injury_risk > 0 ? 'danger' : 'success'} />
        <StatCard label={t('pronosticos.kpi.highFatigue', 'Riesgo de fatiga alto')} value={data.summary.high_fatigue_risk} icon={AlertTriangle} accent={data.summary.high_fatigue_risk > 0 ? 'warning' : 'success'} />
        <StatCard label={t('pronosticos.kpi.projGoals', 'Goles proyectados (próx. 5)')} value={data.summary.projected_goals_next5} icon={Target} accent="purple" />
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskFilter)}>
          <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('pronosticos.filter.allRisk', 'Todo el riesgo')}</SelectItem>
            <SelectItem value="high">{t('pronosticos.filter.high', 'Riesgo alto')}</SelectItem>
            <SelectItem value="medium">{t('pronosticos.filter.medium', 'Riesgo medio')}</SelectItem>
            <SelectItem value="low">{t('pronosticos.filter.low', 'Riesgo bajo')}</SelectItem>
          </SelectContent>
        </Select>
        {positions.length > 0 && (
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pronosticos.filter.allPositions', 'Todas las posiciones')}</SelectItem>
              {positions.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground">
          {t('pronosticos.showing', '{{count}} jugadores', { count: filtered.length })}
        </span>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>{t('pronosticos.table.title', 'Pronóstico por jugador')}</CardTitle>
            <CardDescription className="mt-1">
              {t('pronosticos.table.description', 'Riesgo (verde bajo · ámbar medio · rojo alto) y proyección ofensiva de los próximos 5 partidos.')}
            </CardDescription>
          </div>
        </CardHeader>
        {filtered.length === 0 ? (
          <EmptyState
            icon={BrainCircuit}
            title={t('pronosticos.empty.title', 'Sin pronósticos para este filtro')}
            description={t('pronosticos.empty.description', 'Cambia los filtros o entrena los modelos de riesgo y stats de liga.')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('pronosticos.col.player', 'Jugador')}</TableHead>
                <TableHead>{t('pronosticos.col.position', 'Posición')}</TableHead>
                <TableHead className="text-right">{t('pronosticos.col.injury', 'Riesgo lesión')}</TableHead>
                <TableHead className="text-right">{t('pronosticos.col.fatigue', 'Riesgo fatiga')}</TableHead>
                <TableHead className="text-right">{t('pronosticos.col.projGoals', 'Goles próx. 5')}</TableHead>
                <TableHead className="text-right">{t('pronosticos.col.projAssists', 'Asist. próx. 5')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((f) => (
                <TableRow key={f.player_id}>
                  <TableCell className="font-medium text-foreground">{f.player_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {f.position ? <Badge variant="ai">{f.position}</Badge> : '--'}
                  </TableCell>
                  <TableCell><RiskBar value={f.injury_risk} /></TableCell>
                  <TableCell><RiskBar value={f.fatigue_risk} /></TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {f.proj_goals_next5 != null ? f.proj_goals_next5 : '--'}
                  </TableCell>
                  <TableCell className="text-right font-medium text-foreground">
                    {f.proj_assists_next5 != null ? f.proj_assists_next5 : '--'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
