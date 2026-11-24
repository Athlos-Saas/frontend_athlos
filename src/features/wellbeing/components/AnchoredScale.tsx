import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

import { SCALE_VALUES } from '../items';

export interface AnchoredScaleProps {
  label: string;
  hint?: string;
  /** null = sin responder (los ítems de bienestar no arrancan preseleccionados: evita sesgar la respuesta). */
  value: number | null;
  onChange: (value: number | null) => void;
  /** Ancla verbal de cada valor 1..5 (índice 0 = valor 1). Es lo accesible: el emoji es decorativo. */
  anchors: readonly string[];
  emoji?: Record<number, string>;
  /** Volver a tocar la opción elegida la borra (ítems opcionales). */
  clearable?: boolean;
}

/**
 * Escala 1-5 con anclas verbales, botones de 44 px para el pulgar.
 *
 * Los colores NO cambian por valor (nada de verde = "bien"): en preguntas de
 * bienestar un color "correcto" empuja la respuesta. El único estado visual es
 * "elegido".
 */
export function AnchoredScale({ label, hint, value, onChange, anchors, emoji, clearable = true }: AnchoredScaleProps) {
  const { t } = useTranslation();
  const selectedAnchor = value ? anchors[value - 1] : null;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={label}>
        {SCALE_VALUES.map((option) => {
          const checked = option === value;
          return (
            <Button
              key={option}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={`${option} — ${anchors[option - 1]}`}
              variant={checked ? 'primary' : 'secondary'}
              className={cn('h-11 min-h-11 flex-col gap-0 px-0 text-base leading-none', emoji && 'h-12')}
              onClick={() => onChange(checked && clearable ? null : option)}
            >
              {emoji ? (
                <>
                  <span aria-hidden="true" className="text-lg leading-none">
                    {emoji[option]}
                  </span>
                  <span aria-hidden="true" className="text-[10px] leading-none opacity-80">
                    {option}
                  </span>
                </>
              ) : (
                option
              )}
            </Button>
          );
        })}
      </div>
      <div className="flex items-start justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="max-w-[30%]">{anchors[0]}</span>
        <span className="flex-1 text-center font-medium text-foreground" aria-live="polite">
          {selectedAnchor ?? t('wellbeing.form.notAnswered', 'Sin responder')}
        </span>
        <span className="max-w-[30%] text-right">{anchors[4]}</span>
      </div>
    </fieldset>
  );
}
