import { type ReactNode } from 'react';

import { cn } from '@/utils/cn';

/**
 * Marco "holograma" para el avatar del jugador — reusa las mismas piezas
 * CSS ya probadas del Login (anillo en gradiente con giro de matiz lento,
 * `border-gradient`/`border-gradient-live`, y el barrido `sheen-sweep`) en
 * vez de inventar un sistema nuevo. Puramente decorativo: `aria-hidden` en
 * las capas de encima, el contenido real (foto/ícono) sigue siendo lo único
 * accesible.
 */
export function HoloAvatarFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <div
        aria-hidden="true"
        className="absolute -inset-1.5 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.35),transparent_70%)] blur-md motion-safe:animate-glow-breathe"
      />
      <div className="border-gradient border-gradient-live relative rounded-full">
        <div className="relative overflow-hidden rounded-full">
          {children}
          <div
            aria-hidden="true"
            className="motion-safe:animate-sheen-sweep pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(115deg, transparent 40%, rgba(59,130,246,0.28) 50%, transparent 60%)',
              backgroundSize: '250% 100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}
