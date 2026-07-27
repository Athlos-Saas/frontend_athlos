import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/utils/cn';

const MESSAGE_KEYS = ['login.ticker.analyzing', 'login.ticker.processing', 'login.ticker.predictionDone', 'login.ticker.newTraining'];
const INTERVAL_MS = 4000;

/** Ticker de estado tipo "consola de IA en vivo" — cicla mensajes cortos; durante `isActive` (login en vuelo) se fija en "Autenticando…" y el punto pulsa más rápido. */
export function AiTicker({ className, isActive = false }: { className?: string; isActive?: boolean }) {
  const { t } = useTranslation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || isActive) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % MESSAGE_KEYS.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [prefersReducedMotion, isActive]);

  const message = isActive ? t('login.ticker.authenticating') : t(MESSAGE_KEYS[index]);
  const messageKey = isActive ? 'active' : index;

  return (
    <div
      className={cn('pointer-events-none flex items-center gap-2 text-xs text-muted-foreground', className)}
      aria-hidden="true"
    >
      <motion.span
        className="size-1.5 rounded-full bg-ai"
        animate={prefersReducedMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
        transition={prefersReducedMotion ? undefined : { duration: isActive ? 0.6 : 1.6, repeat: Infinity }}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={messageKey}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="font-mono tracking-wide"
        >
          {message}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
