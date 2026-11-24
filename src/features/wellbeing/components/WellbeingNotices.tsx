import { Info, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';

/**
 * Aviso PERMANENTE para el staff: monitoreo, no diagnóstico. Se muestra en
 * toda vista con datos de bienestar (ficha, Alertas, carga del staff) y no se
 * puede cerrar a propósito.
 */
export function WellbeingDisclaimer({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="note" className={cn('flex items-start gap-2.5 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-foreground', className)}>
      <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{t('wellbeing.disclaimer.title')}</p>
        {!compact && <p className="text-muted-foreground">{t('wellbeing.disclaimer.body')}</p>}
        <p className="text-muted-foreground">{t('wellbeing.disclaimer.referral')}</p>
      </div>
    </div>
  );
}

/** Mensaje de privacidad para el atleta: quién ve sus respuestas. */
export function WellbeingPrivacyNote({ className, includeMood = false }: { className?: string; includeMood?: boolean }) {
  const { t } = useTranslation();
  return (
    <div role="note" className={cn('flex items-start gap-2.5 rounded-md border border-border bg-panel/60 p-3 text-xs', className)}>
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <div className="space-y-1 text-muted-foreground">
        <p className="font-semibold text-foreground">{t('wellbeing.privacy.title')}</p>
        <p>{t('wellbeing.privacy.body')}</p>
        {includeMood && <p>{t('wellbeing.privacy.mood')}</p>}
        <p>{t('wellbeing.privacy.noWrongAnswers')}</p>
        <p>{t('wellbeing.privacy.urgent')}</p>
      </div>
    </div>
  );
}
