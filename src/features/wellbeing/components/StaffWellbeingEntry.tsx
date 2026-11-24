import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { localIsoDate } from '@/features/athletePortal/queries';
import { toast } from '@/store/toastStore';
import { canWriteWellbeing } from '@/utils/permissions';

import { compactAnswers, WEEKLY_ITEMS, type WellbeingAnswers, type WellbeingKind } from '../items';
import { useSubmitWellbeing, useWellbeingAccess, useWellbeingCheckin } from '../queries';
import { TalkToggle, WellbeingDailyFields, WellbeingWeeklyFields } from './WellbeingFields';
import { WellbeingDisclaimer } from './WellbeingNotices';

/**
 * Carga del check-in de bienestar EN NOMBRE del jugador (p. ej. lo respondió
 * en papel o en una consulta). Solo admin/medical con acceso detail: espejo
 * de wellbeing_staff_can_write() (032). Para el resto de roles no se renderiza
 * nada — RLS rechazaría el guardado igual.
 *
 * El ánimo general NO va aquí: el staff lo carga en el formulario de wellness
 * de al lado (wellness_entries.mood), igual que antes.
 */
export function StaffWellbeingEntry({
  orgId,
  role,
  players,
}: {
  orgId: string;
  role: string | null;
  players: Array<{ id: string; full_name: string }>;
}) {
  const { t } = useTranslation();
  const access = useWellbeingAccess(orgId, role);
  const canWrite = canWriteWellbeing(role, access.level);
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [entryDate, setEntryDate] = useState(localIsoDate());
  const [kind, setKind] = useState<WellbeingKind>('daily');
  const [answers, setAnswers] = useState<WellbeingAnswers>({});
  const [wantsToTalk, setWantsToTalk] = useState(false);
  const existing = useWellbeingCheckin(orgId, playerId, entryDate, kind, canWrite);
  const submit = useSubmitWellbeing(orgId);

  // Si ya hay un check-in para esa combinación, se precarga para corregirlo.
  useEffect(() => {
    setAnswers(existing.data?.answers ?? {});
    setWantsToTalk(existing.data?.wants_to_talk ?? false);
  }, [existing.data, playerId, entryDate, kind]);

  if (!canWrite) return null;

  const answeredCount = Object.keys(compactAnswers(answers)).length;
  const canSave = answeredCount > 0 || wantsToTalk;
  const onAnswer = (key: string, value: number | null) => setAnswers((prev) => ({ ...prev, [key]: value ?? undefined }));

  const handleSave = () => {
    submit.mutate(
      { playerId, entryDate, kind, answers, wantsToTalk },
      {
        onSuccess: () => toast({ title: t('wellbeing.staff.savedTitle'), variant: 'success' }),
        onError: (error) =>
          toast({
            title: t('wellbeing.staff.saveErrorTitle'),
            description: error instanceof Error ? error.message : undefined,
            variant: 'danger',
          }),
      },
    );
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Brain className="size-4 text-purple" aria-hidden="true" />
            {t('wellbeing.staff.title')}
          </CardTitle>
          <CardDescription className="mt-1">{t('wellbeing.staff.subtitle')}</CardDescription>
        </div>
      </CardHeader>
      <WellbeingDisclaimer compact className="mb-4" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('wellbeing.staff.player')} htmlFor="wellbeing-player">
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger id="wellbeing-player">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {players.map((player) => (
                <SelectItem key={player.id} value={player.id}>
                  {player.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t('wellbeing.staff.date')} htmlFor="wellbeing-date">
          <Input id="wellbeing-date" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        </Field>
        <Field label={t('wellbeing.staff.kind')} htmlFor="wellbeing-kind">
          <Select value={kind} onValueChange={(value) => setKind(value as WellbeingKind)}>
            <SelectTrigger id="wellbeing-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t('wellbeing.staff.kindDaily')}</SelectItem>
              <SelectItem value="weekly">{t('wellbeing.staff.kindWeekly')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {existing.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : existing.isError ? (
        <ErrorState
          className="mt-4"
          title={t('wellbeing.staff.loadErrorTitle')}
          description={existing.error instanceof Error ? existing.error.message : undefined}
          onRetry={() => existing.refetch()}
        />
      ) : (
        <div className="mt-4 space-y-5">
          {existing.data && <p className="text-xs text-muted-foreground">{t('wellbeing.staff.editingExisting')}</p>}
          {kind === 'daily' ? (
            <>
              <p className="text-xs text-muted-foreground">{t('wellbeing.staff.moodElsewhere')}</p>
              <WellbeingDailyFields answers={answers} onAnswer={onAnswer} wantsToTalk={wantsToTalk} onWantsToTalk={setWantsToTalk} />
            </>
          ) : (
            <>
              <WellbeingWeeklyFields answers={answers} onAnswer={onAnswer} />
              <TalkToggle value={wantsToTalk} onChange={setWantsToTalk} />
              <p className="text-xs text-muted-foreground">
                {t('wellbeing.portal.weeklyProgress', { answered: answeredCount, total: WEEKLY_ITEMS.length })}
              </p>
            </>
          )}
          <Button className="w-full" isLoading={submit.isPending} disabled={!canSave || !playerId} onClick={handleSave}>
            {t('wellbeing.staff.save')}
          </Button>
        </div>
      )}
    </Card>
  );
}
