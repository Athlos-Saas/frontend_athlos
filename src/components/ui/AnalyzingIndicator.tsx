import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/utils/cn';

export const VIDEO_PROCESSING_STAGE_KEYS = [
  'processing.detectingPlayers',
  'processing.trackingMovement',
  'processing.calibratingPitch',
  'processing.computingTrajectories',
  'processing.almostDone',
  'processing.stillWorking',
];
const STAGE_INTERVAL_MS = 3500;

/**
 * Indicador animado para procesos largos — anillo tipo radar + barra con
 * brillo en movimiento. `stageKeys` es opcional: si se pasa (ej. el
 * análisis de video, que puede tardar minutos), agrega un subtítulo que
 * cicla por etapas plausibles del pipeline — no representan un progreso
 * real medido, solo comunican "seguimos vivos, no está trabado" (mismo
 * criterio que `AiTicker` del login). Sin `stageKeys` (ej. "Pensando…" de
 * AthlosBot, que dura segundos) se muestra solo el label + la barra.
 */
export function AnalyzingIndicator({
  label = 'Analizando…',
  stageKeys,
  className,
}: {
  label?: string;
  stageKeys?: string[];
  className?: string;
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!stageKeys || prefersReducedMotion) return;
    const id = setInterval(() => setStageIndex((i) => (i + 1) % stageKeys.length), STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [stageKeys, prefersReducedMotion]);

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex size-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-ai/25 border-t-ai animate-spin" />
        <Activity className="size-4 text-ai animate-pulse" aria-hidden="true" />
      </div>
      <div className={cn('min-w-[140px]', stageKeys && 'min-w-[170px]')}>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/60">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-ai via-purple to-ai animate-shimmer" />
        </div>
        {stageKeys && (
          <div className="mt-1 h-4 overflow-hidden">
            {prefersReducedMotion ? (
              <p className="text-xs text-muted-foreground">{t(stageKeys[stageIndex])}</p>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={stageIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  className="text-xs text-muted-foreground"
                >
                  {t(stageKeys[stageIndex])}
                </motion.p>
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
