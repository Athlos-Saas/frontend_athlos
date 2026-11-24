import { useMemo, useState } from 'react';
import { CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatDate } from '@/features/playerProfile/format';
import { toast } from '@/store/toastStore';

import { WEEKLY_ITEMS, type WellbeingAnswers } from '../items';
import { useMyWellbeingCheckins, useSubmitWellbeing } from '../queries';
import { shiftIsoDate } from '../dates';
import { TalkToggle, WellbeingWeeklyFields } from './WellbeingFields';
import { WellbeingPrivacyNote } from './WellbeingNotices';

/** Días entre check-ins semanales: el portal lo vuelve a sugerir a partir del 7.º día. */
const WEEKLY_EVERY_DAYS = 7;
/** Ventana que lee el portal (cubre el semanal anterior y el diario de hoy con una sola consulta). */
export const PORTAL_WELLBEING_LOOKBACK_DAYS = 13;

/**
 * Check-in semanal OPCIONAL (~2 min, 16 ítems). Se sugiere una vez por semana;
 * el atleta puede posponerlo. Para enviarlo se piden todos los ítems: el
 * perfil por dimensiones compara semana contra semana y una semana a medias
 * no es comparable.
 */
export function WeeklyCheckinCard({ orgId, playerId, today }: { orgId: string; playerId: string; today: string }) {
  const { t } = useTranslation();
  const since = shiftIsoDate(today, -PORTAL_WELLBEING_LOOKBACK_DAYS);
  const checkins = useMyWellbeingCheckins(orgId, playerId, since);
  const submit = useSubmitWellbeing(orgId);
  const [isOpen, setIsOpen] = useState(false);
  const [answers, setAnswers] = useState<WellbeingAnswers>({});
  const [wantsToTalk, setWantsToTalk] = useState(false);

  const lastWeekly = useMemo(() => (checkins.data ?? []).find((row) => row.kind === 'weekly'), [checkins.data]);
  const nextDue = lastWeekly ? shiftIsoDate(lastWeekly.entry_date, WEEKLY_EVERY_DAYS) : null;
  const isDue = !nextDue || nextDue <= today;
  const answered = WEEKLY_ITEMS.filter((item) => typeof answers[item.key] === 'number').length;

  if (checkins.isLoading) return <Skeleton className="h-28 w-full" />;
  if (checkins.isError) {
    return (
      <ErrorState
        title={t('wellbeing.portal.weeklyErrorTitle')}
        description={checkins.error instanceof Error ? checkins.error.message : undefined}
        onRetry={() => checkins.refetch()}
      />
    );
  }

  if (!isDue && nextDue) {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="font-semibold text-foreground">{t('wellbeing.portal.weeklyDoneTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('wellbeing.portal.weeklyDoneDescription', { date: formatDate(nextDue) })}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const handleSubmit = () => {
    submit.mutate(
      { playerId, entryDate: today, kind: 'weekly', answers, wantsToTalk },
      {
        onSuccess: () => {
          setIsOpen(false);
          setAnswers({});
          toast({
            title: t('wellbeing.portal.weeklySavedTitle'),
            description: wantsToTalk ? t('wellbeing.talk.sent') : undefined,
            variant: 'success',
          });
        },
        onError: (error) => {
          toast({
            title: t('wellbeing.portal.saveErrorTitle'),
            description: error instanceof Error ? error.message : undefined,
            variant: 'danger',
          });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="size-5 text-ai" aria-hidden="true" />
            {t('wellbeing.portal.weeklyTitle')}
          </CardTitle>
          <CardDescription className="mt-1">{t('wellbeing.portal.weeklySubtitle')}</CardDescription>
        </div>
      </CardHeader>
      {!isOpen ? (
        <Button className="h-11 w-full" onClick={() => setIsOpen(true)}>
          {t('wellbeing.portal.weeklyStart')}
        </Button>
      ) : (
        <div className="space-y-5">
          <WellbeingPrivacyNote />
          <WellbeingWeeklyFields answers={answers} onAnswer={(key, value) => setAnswers((prev) => ({ ...prev, [key]: value ?? undefined }))} />
          <TalkToggle value={wantsToTalk} onChange={setWantsToTalk} />
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {t('wellbeing.portal.weeklyProgress', { answered, total: WEEKLY_ITEMS.length })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" className="h-11" onClick={() => setIsOpen(false)}>
              {t('wellbeing.portal.weeklyLater')}
            </Button>
            <Button className="h-11" isLoading={submit.isPending} disabled={answered < WEEKLY_ITEMS.length} onClick={handleSubmit}>
              {t('wellbeing.portal.weeklySubmit')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
