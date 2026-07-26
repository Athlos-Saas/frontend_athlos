import { useEffect, useState } from 'react';
import { animate, motion } from 'framer-motion';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';
import { cn } from '@/utils/cn';

export interface HudWidgetProps {
  label: string;
  value: number | string;
  unit?: string;
  decimals?: number;
  variant?: 'ai' | 'success' | 'warning' | 'danger';
  delay?: number;
  className?: string;
}

const VARIANT_TEXT: Record<NonNullable<HudWidgetProps['variant']>, string> = {
  ai: 'text-ai',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const VARIANT_BAR: Record<NonNullable<HudWidgetProps['variant']>, string> = {
  ai: 'from-transparent via-ai to-transparent',
  success: 'from-transparent via-success to-transparent',
  warning: 'from-transparent via-warning to-transparent',
  danger: 'from-transparent via-danger to-transparent',
};

function CountUpValue({ target, decimals }: { target: number; decimals: number }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [display, setDisplay] = useState(prefersReducedMotion ? target : 0);

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(target);
      return;
    }
    const controls = animate(0, target, {
      duration: 1.4,
      ease: 'easeOut',
      delay: 0.3,
      onUpdate: setDisplay,
    });
    return controls.stop;
  }, [target, prefersReducedMotion]);

  return <>{display.toFixed(decimals)}</>;
}

/** Card holográfico flotante: glass + blur + glow + borde en gradiente, con un valor que cuenta al montar y una barra inferior "viva". */
export function HudWidget({ label, value, unit, decimals = 0, variant = 'ai', delay = 0, className }: HudWidgetProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isNumeric = typeof value === 'number';

  return (
    <motion.div
      className={cn('pointer-events-none select-none', className)}
      initial={{ opacity: 0, scale: 0.85, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: prefersReducedMotion ? 0 : [0, -7, 0] }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay },
        y: prefersReducedMotion
          ? { duration: 0 }
          : { duration: 4.5, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: delay + 0.5 },
      }}
    >
      <div className="glass min-w-[9.5rem] overflow-hidden rounded-xl border border-white/10 p-3 shadow-elevated">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn('mt-1 text-xl font-bold tabular-nums', VARIANT_TEXT[variant])}>
          {isNumeric ? <CountUpValue target={value} decimals={decimals} /> : value}
          {unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>}
        </p>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
          <div className={cn('motion-safe:animate-shimmer h-full w-1/2 bg-gradient-to-r', VARIANT_BAR[variant])} />
        </div>
      </div>
    </motion.div>
  );
}
