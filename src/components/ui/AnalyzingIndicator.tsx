import { Activity } from 'lucide-react';

import { cn } from '@/utils/cn';

/** Indicador animado para procesos largos (computer vision, entrenamiento de modelos) — anillo tipo radar + barra con brillo en movimiento. */
export function AnalyzingIndicator({ label = 'Analizando…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex size-8 shrink-0 items-center justify-center">
        <span className="absolute inset-0 rounded-full border-2 border-ai/25 border-t-ai animate-spin" />
        <Activity className="size-4 text-ai animate-pulse" aria-hidden="true" />
      </div>
      <div className="min-w-[140px]">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border/60">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-ai via-purple to-ai animate-shimmer" />
        </div>
      </div>
    </div>
  );
}
