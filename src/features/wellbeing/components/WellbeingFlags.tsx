import { useNavigate } from 'react-router-dom';
import { Brain, MessageCircleHeart, TrendingDown, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/features/playerProfile/format';

import { useWellbeingFlags, type WellbeingFlag, type WellbeingFlagType, type WellbeingStatus } from '../queries';
import { WellbeingDisclaimer } from './WellbeingNotices';

const FLAG_ICON: Record<WellbeingFlagType, typeof Brain> = {
  wants_to_talk: MessageCircleHeart,
  sustained_decline: TrendingDown,
  stress_spike: Zap,
};
const FLAG_BADGE: Record<WellbeingFlagType, 'danger' | 'warning'> = {
  wants_to_talk: 'danger',
  sustained_decline: 'warning',
  stress_spike: 'warning',
};
const STATUS_BADGE: Record<WellbeingStatus, 'success' | 'warning' | 'neutral'> = {
  ok: 'success',
  attention: 'warning',
  building_baseline: 'neutral',
  no_data: 'neutral',
};

export function WellbeingStatusBadge({ status }: { status: WellbeingStatus }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_BADGE[status]}>{t(`wellbeing.status.${status}`)}</Badge>;
}

/** Lista de banderas de UN atleta (sin números: sirve igual para 'detail' y 'flags'). */
export function WellbeingFlagList({ flags }: { flags: WellbeingFlag[] }) {
  const { t } = useTranslation();
  if (flags.length === 0) return <p className="text-sm text-muted-foreground">{t('wellbeing.flags.none')}</p>;
  return (
    <ul className="space-y-2">
      {flags.map((flag) => {
        const Icon = FLAG_ICON[flag.type];
        return (
          <li key={flag.type} className="flex items-start gap-3 rounded-md border border-border bg-panel px-3 py-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{t(`wellbeing.flags.${flag.type}.label`)}</p>
              <p className="text-xs text-muted-foreground">{t(`wellbeing.flags.${flag.type}.description`)}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatDate(flag.date)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Bloque de Alertas. El backend decide qué ve cada rol: 'detail' recibe
 * también "pidió hablar"; 'flags' (coach) solo descenso/pico; 'none' una lista
 * vacía, y entonces no se renderiza nada (ni siquiera se insinúa que existe).
 */
export function WellbeingAlertsCard({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const flags = useWellbeingFlags(orgId);

  if (flags.isLoading) return <Skeleton className="mb-5 h-28 w-full" />;
  if (flags.isError) {
    return (
      <ErrorState
        className="mb-5"
        title={t('wellbeing.alerts.errorTitle')}
        description={flags.error instanceof Error ? flags.error.message : undefined}
        onRetry={() => flags.refetch()}
      />
    );
  }
  if (!flags.data || flags.data.access === 'none') return null;

  const players = flags.data.players;
  return (
    <Card className="mb-5 border-purple/30">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-purple" aria-hidden="true" />
            {t('wellbeing.alerts.title')}
          </CardTitle>
          <CardDescription className="mt-1">
            {flags.data.access === 'detail' ? t('wellbeing.alerts.descriptionDetail') : t('wellbeing.alerts.descriptionFlags')}
          </CardDescription>
        </div>
        {players.length > 0 && <Badge variant="warning">{players.length}</Badge>}
      </CardHeader>
      <WellbeingDisclaimer compact className="mb-3" />
      {players.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('wellbeing.alerts.empty')}</p>
      ) : (
        <div className="space-y-2">
          {players.map((player) => (
            <button
              key={player.player_id}
              type="button"
              onClick={() => navigate(`/atletas/${player.player_id}`)}
              className="focus-ring flex w-full flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel px-4 py-3 text-left transition-colors hover:border-purple/40 hover:bg-card"
            >
              <span className="text-sm font-medium text-foreground">{player.full_name}</span>
              <span className="flex flex-wrap gap-1.5">
                {player.flags.map((flag) => (
                  <Badge key={flag.type} variant={FLAG_BADGE[flag.type]}>
                    {t(`wellbeing.flags.${flag.type}.label`)} · {formatDate(flag.date)}
                  </Badge>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
