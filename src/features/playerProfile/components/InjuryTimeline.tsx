import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { formatDate } from '../format';
import type { Injury } from '@/types/domain';

const SEVERITY_VARIANT: Record<Injury['severity'], 'warning' | 'danger'> = {
  minor: 'warning',
  moderate: 'warning',
  severe: 'danger',
};

const SEVERITY_LABEL: Record<Injury['severity'], string> = {
  minor: 'Leve',
  moderate: 'Moderada',
  severe: 'Severa',
};

/** Historial completo de `injuries` (no solo la activa). Si viene vacío, el caller decide qué mostrar. */
export function InjuryTimeline({ injuries }: { injuries: Injury[] }) {
  const { t } = useTranslation();
  if (injuries.length === 0) return null;

  return (
    <ul className="space-y-4">
      {injuries.map((injury) => (
        <li key={injury.id} className="flex gap-3 border-l-2 border-border pl-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={SEVERITY_VARIANT[injury.severity]}>
                {t(`injuryTimeline.severity.${injury.severity}`, SEVERITY_LABEL[injury.severity])}
              </Badge>
              <span className="text-sm font-medium text-foreground">{formatDate(injury.injury_date)}</span>
              {injury.return_date && (
                <span className="text-xs text-muted-foreground">
                  {t('injuryTimeline.recovered', '→ recuperado {{date}}', { date: formatDate(injury.return_date) })}
                </span>
              )}
              {!injury.return_date && <Badge variant="danger">{t('injuryTimeline.active', 'Activa')}</Badge>}
            </div>
            {injury.body_area && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('injuryTimeline.zone', 'Zona: {{area}}', { area: injury.body_area })}
              </p>
            )}
            {injury.notes && <p className="mt-1 text-sm text-muted-foreground">{injury.notes}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
