import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { PlayerRadar, type RadarDatum } from '../components/PlayerRadar';
import { deriveInsights, deriveStatus } from '../insights';
import { usePlayerGpsSessions, usePlayerInjuries, usePlayerLeagueStats, usePlayerPredictions } from '../queries';
import type { GpsSession } from '@/types/domain';

const FEATURE_KEYS = ['distance_km', 'sprint_distance_m', 'top_speed_kmh', 'player_load'] as const;

const FEATURE_ACCESSORS: Record<string, (session: GpsSession) => number | null | undefined> = {
  distance_km: (session) => session.distance_km,
  sprint_distance_m: (session) => session.sprint_distance_m,
  top_speed_kmh: (session) => session.top_speed_kmh,
  player_load: (session) => session.player_load,
};

/**
 * Normaliza cada métrica del perfil físico (ml_predictions.features) contra
 * el propio historial de sesiones del jugador (0-100 = mínimo-máximo que ÉL
 * mismo registró) — nunca contra un umbral inventado. Si hay menos de 2
 * sesiones con esa métrica, o no varía, ese eje se omite (nunca se fuerza
 * un valor).
 */
function buildRadarData(
  features: Record<string, number> | null | undefined,
  sessions: GpsSession[],
  featureLabels: Record<string, string>,
): RadarDatum[] {
  if (!features) return [];
  const data: RadarDatum[] = [];
  for (const key of FEATURE_KEYS) {
    const rawValue = features[key];
    if (rawValue === undefined || rawValue === null) continue;
    const accessor = FEATURE_ACCESSORS[key];
    const values = sessions.map(accessor).filter((value): value is number => typeof value === 'number');
    if (values.length < 2) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) continue;
    const pct = Math.max(0, Math.min(100, ((rawValue - min) / (max - min)) * 100));
    data.push({ metric: featureLabels[key], value: Math.round(pct) });
  }
  return data;
}

export default function TabResumen({ orgId, playerId, playerName }: { orgId: string; playerId: string; playerName: string }) {
  const { t } = useTranslation();
  const predictions = usePlayerPredictions(orgId, playerId);
  const sessions = usePlayerGpsSessions(orgId, playerId);
  const injuries = usePlayerInjuries(orgId, playerId);
  const leagueStats = usePlayerLeagueStats(orgId, playerId);

  const featureLabels = useMemo<Record<string, string>>(
    () => ({
      distance_km: t('tabResumen.feature.distance', 'Distancia'),
      sprint_distance_m: t('tabResumen.feature.sprint', 'Sprint'),
      top_speed_kmh: t('tabResumen.feature.topSpeed', 'Vel. máxima'),
      player_load: t('tabResumen.feature.playerLoad', 'Player Load'),
    }),
    [t],
  );

  const isLoading = predictions.isLoading || sessions.isLoading || injuries.isLoading || leagueStats.isLoading;

  const physicalProfile = predictions.data?.find((p) => p.prediction_type === 'physical_profile');
  const fatigueRisk = predictions.data?.find((p) => p.prediction_type === 'fatigue_risk');
  const loadExpected = predictions.data?.find((p) => p.prediction_type === 'player_load_expected');

  const status = useMemo(() => deriveStatus(injuries.data ?? []), [injuries.data]);
  const insights = useMemo(
    () =>
      deriveInsights({
        physicalProfileLabel: physicalProfile?.label,
        roleName: leagueStats.data?.attacker[0]?.role_name,
        gkRole: leagueStats.data?.goalkeeper[0]?.gk_role,
        probaTopScorer: leagueStats.data?.attacker[0]?.proba_top_scorer,
        fatigueLabel: fatigueRisk?.label,
        loadLabel: loadExpected?.label,
      }),
    [physicalProfile, fatigueRisk, loadExpected, leagueStats.data],
  );
  const radarData = useMemo(
    () => buildRadarData(physicalProfile?.features, sessions.data ?? [], featureLabels),
    [physicalProfile, sessions.data, featureLabels],
  );

  const gamesPlayed = leagueStats.data?.attacker[0]?.gp ?? leagueStats.data?.goalkeeper[0]?.gp ?? null;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('tabResumen.stat.physicalProfile', 'Perfil físico')} value={physicalProfile?.label ?? '--'} accent="purple" />
        <StatCard
          label={t('tabResumen.stat.fatigueRisk', 'Riesgo de fatiga')}
          value={fatigueRisk ? fatigueRisk.label : '--'}
          accent={fatigueRisk?.label === 'alto' ? 'danger' : 'success'}
        />
        <StatCard
          label={t('tabResumen.stat.availability', 'Disponibilidad')}
          value={status.label}
          accent={status.variant === 'danger' ? 'danger' : status.variant === 'warning' ? 'warning' : 'success'}
        />
        <StatCard label={t('tabResumen.stat.gamesPlayed', 'Partidos jugados')} value={gamesPlayed ?? '--'} accent="ai" />
      </div>

      <PlayerRadar data={radarData} playerName={playerName} />

      {(insights.strengths.length > 0 || insights.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {insights.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tabResumen.strengths', 'Fortalezas')}</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {insights.strengths.map((strength) => (
                  <Badge key={strength} variant="success">
                    {strength}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
          {insights.weaknesses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('tabResumen.weaknesses', 'Áreas de mejora')}</CardTitle>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                {insights.weaknesses.map((weakness) => (
                  <Badge key={weakness} variant="warning">
                    {weakness}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
