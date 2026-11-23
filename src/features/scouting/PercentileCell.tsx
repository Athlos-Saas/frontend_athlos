import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { percentileTone } from './marketFormat';

/**
 * Percentil 0-100 con barra. Sin percentil se distingue "no elegible"
 * (muestra insuficiente: pocos minutos) de "sin dato" (el proveedor no
 * publica la métrica): son dos razones distintas y la UI no las mezcla.
 */
export function PercentileCell({ pct, eligible }: { pct: number | null; eligible: boolean }) {
  const { t } = useTranslation();
  if (pct == null) {
    return eligible ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <Badge variant="neutral">{t('market.lowSample', 'Muestra insuficiente')}</Badge>
    );
  }
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border/60">
        <div className={`h-full rounded-full ${percentileTone(pct)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-sm font-semibold text-foreground">{pct}</span>
    </div>
  );
}
