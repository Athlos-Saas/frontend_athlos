import { MessageCircleHeart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

import { Button } from '@/components/ui/Button';

import { DAILY_ITEMS, MOOD_EMOJI, SCALE_VALUES, WEEKLY_ITEMS, type WellbeingAnswers } from '../items';
import { AnchoredScale } from './AnchoredScale';

/** Anclas verbales de un ítem diario (cada uno tiene las suyas). */
export function itemAnchors(t: TFunction, key: string): string[] {
  return SCALE_VALUES.map((n) => t(`wellbeing.items.${key}.a${n}`));
}

/** Anclas de frecuencia, comunes a todo el check-in semanal. */
export function weeklyAnchors(t: TFunction): string[] {
  return SCALE_VALUES.map((n) => t(`wellbeing.weeklyScale.a${n}`));
}

interface DailyFieldsProps {
  answers: WellbeingAnswers;
  onAnswer: (key: string, value: number | null) => void;
  wantsToTalk: boolean;
  onWantsToTalk: (value: boolean) => void;
  /**
   * Ánimo general = wellness_entries.mood. El portal lo pregunta aquí (dentro
   * del bloque de bienestar); el staff lo carga en su formulario de wellness,
   * así que ahí se omite.
   */
  mood?: { value: number | null; onChange: (value: number | null) => void };
}

/** Bloque diario: ánimo (opcional) + 5 ítems + "¿quieres hablar con alguien?". */
export function WellbeingDailyFields({ answers, onAnswer, wantsToTalk, onWantsToTalk, mood }: DailyFieldsProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      {mood && (
        <AnchoredScale
          label={t('wellbeing.items.mood.q')}
          value={mood.value}
          onChange={mood.onChange}
          anchors={itemAnchors(t, 'mood')}
          emoji={MOOD_EMOJI}
        />
      )}
      {DAILY_ITEMS.map((item) => (
        <AnchoredScale
          key={item.key}
          label={t(`wellbeing.items.${item.key}.q`)}
          value={answers[item.key] ?? null}
          onChange={(value) => onAnswer(item.key, value)}
          anchors={itemAnchors(t, item.key)}
        />
      ))}
      <TalkToggle value={wantsToTalk} onChange={onWantsToTalk} />
    </div>
  );
}

export function TalkToggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation();
  const label = t('wellbeing.talk.q');
  return (
    <fieldset className="space-y-2 rounded-md border border-border bg-panel/60 p-3">
      <legend className="sr-only">{label}</legend>
      <p className="flex items-center gap-2 text-sm font-medium text-foreground" aria-hidden="true">
        <MessageCircleHeart className="size-4 text-ai" />
        {label}
      </p>
      <p className="text-xs text-muted-foreground">{t('wellbeing.talk.hint')}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {([false, true] as const).map((option) => (
          <Button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={value === option}
            variant={value === option ? 'primary' : 'secondary'}
            className="h-11"
            onClick={() => onChange(option)}
          >
            {option ? t('wellbeing.talk.yes') : t('wellbeing.talk.no')}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

interface WeeklyFieldsProps {
  answers: WellbeingAnswers;
  onAnswer: (key: string, value: number | null) => void;
}

/** Los 16 ítems semanales con la escala de frecuencia común. */
export function WellbeingWeeklyFields({ answers, onAnswer }: WeeklyFieldsProps) {
  const { t } = useTranslation();
  const anchors = weeklyAnchors(t);
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-foreground">{t('wellbeing.weeklyStem')}</p>
      {WEEKLY_ITEMS.map((item, index) => (
        <AnchoredScale
          key={item.key}
          label={`${index + 1}. ${t(`wellbeing.items.${item.key}.q`)}`}
          value={answers[item.key] ?? null}
          onChange={(value) => onAnswer(item.key, value)}
          anchors={anchors}
        />
      ))}
    </div>
  );
}
