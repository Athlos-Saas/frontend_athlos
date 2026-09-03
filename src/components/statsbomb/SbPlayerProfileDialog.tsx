/**
 * SbPlayerProfileDialog — ficha detallada de un jugador de StatsBomb, estilo
 * la ficha de Atletas (atributos + radar + stats crudas). Componente
 * compartido entre la vista "Jugadores StatsBomb" y el módulo de Scouting:
 * en ambos, hacer clic en un jugador abre esta misma ficha.
 */
import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { RadarComparisonChart } from '@/components/charts/RadarComparisonChart';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { colors } from '@/constants/tokens';
import { getSbProfile, type SbPlayerProfile } from '@/lib/backendApi';
import { toast } from '@/store/toastStore';

type LoadState = 'loading' | 'error' | 'ready';

const ATTR_LABELS: Record<string, string> = {
  RIT: 'RIT',
  TIR: 'TIR',
  PAS: 'PAS',
  REG: 'REG',
  DEF: 'DEF',
  FIS: 'FÍS',
};

/** Color del rating según su valor, escala tipo FIFA. */
export function ratingColor(value: number): string {
  if (value >= 85) return '#22c55e';
  if (value >= 75) return '#84cc16';
  if (value >= 65) return '#eab308';
  if (value >= 50) return '#f97316';
  return '#94a3b8';
}

export function SbPlayerProfileDialog({
  playerId,
  onClose,
}: {
  playerId: number | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<SbPlayerProfile | null>(null);
  const [state, setState] = useState<LoadState>('loading');

  useEffect(() => {
    if (playerId == null) return;
    let mounted = true;
    setState('loading');
    setProfile(null);
    getSbProfile(playerId)
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setState('ready');
      })
      .catch((err) => {
        if (!mounted) return;
        setState('error');
        toast({
          title: t('sbPlayers.loadProfileError', 'No se pudo cargar la ficha'),
          description: err instanceof Error ? err.message : String(err),
          variant: 'danger',
        });
      });
    return () => {
      mounted = false;
    };
  }, [playerId, t]);

  return (
    <Dialog open={playerId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        {state === 'loading' && <Skeleton className="h-96 w-full" />}
        {state === 'error' && <ErrorState title={t('sbPlayers.loadProfileError', 'No se pudo cargar la ficha')} />}
        {state === 'ready' && profile && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div
                className="flex size-20 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                style={{ background: `linear-gradient(135deg, ${ratingColor(profile.overall)}, #0f172a)` }}
              >
                <span className="text-3xl font-black leading-none">{profile.overall}</span>
                <span className="text-[10px] uppercase tracking-wider opacity-80">Overall</span>
              </div>
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-full border border-border bg-panel">
                <UserRound className="size-8 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{profile.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {profile.country && <Badge variant="ai">{profile.country}</Badge>}
                  <span>
                    {profile.matches} {t('sbPlayers.matches', 'partidos')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  {t('sbPlayers.attributes', 'Atributos')}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {(['RIT', 'TIR', 'PAS', 'REG', 'DEF', 'FIS'] as const).map((code) => (
                    <div key={code} className="flex items-center justify-between rounded-md bg-panel px-3 py-2">
                      <span className="text-sm text-muted-foreground">{ATTR_LABELS[code]}</span>
                      <span className="text-lg font-bold" style={{ color: ratingColor(profile.attributes[code]) }}>
                        {profile.attributes[code]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-56">
                <RadarComparisonChart
                  data={profile.radar}
                  dataKey="value"
                  angleKey="attribute"
                  name={profile.name}
                  color={colors.purple}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-foreground">
                {t('sbPlayers.rawStats', 'Estadísticas (acumuladas)')}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label={t('sbPlayers.goals', 'Goles')} value={profile.stats.goals} />
                <StatCard label="xG" value={profile.stats.xg_total} />
                <StatCard label={t('sbPlayers.assists', 'Asistencias')} value={profile.stats.assists} />
                <StatCard label="xA" value={profile.stats.xa_total} />
                <StatCard label={t('sbPlayers.shots', 'Tiros')} value={profile.stats.shots} />
                <StatCard label={t('sbPlayers.keyPasses', 'Pases clave')} value={profile.stats.key_passes} />
                <StatCard label={t('sbPlayers.passPct', '% Pase')} value={`${profile.stats.pass_completion_pct}%`} />
                <StatCard label={t('sbPlayers.dribbles', 'Regates')} value={profile.stats.dribbles_completed} />
                <StatCard label={t('sbPlayers.tackles', 'Entradas')} value={profile.stats.tackles} />
                <StatCard label={t('sbPlayers.interceptions', 'Intercep.')} value={profile.stats.interceptions} />
                <StatCard label={t('sbPlayers.pressures', 'Presiones')} value={profile.stats.pressures} />
                <StatCard label={t('sbPlayers.xgPer90', 'xG/90')} value={profile.stats.xg_per_90} />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{profile.basis}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
