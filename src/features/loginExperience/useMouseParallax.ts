import { useEffect, useRef, useState, type RefObject } from 'react';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';

export interface ParallaxPosition {
  x: number;
  y: number;
}

const IDLE: ParallaxPosition = { x: 0, y: 0 };

/**
 * Posición normalizada del mouse (-1..1 en cada eje) relativa al centro de
 * `containerRef`. Devuelve siempre {x:0, y:0} si el usuario prefiere menos
 * movimiento, o en touch (no hay mousemove real) — nunca fuerza parallax
 * donde no corresponde.
 */
export function useMouseParallax(containerRef: RefObject<HTMLElement>) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [position, setPosition] = useState<ParallaxPosition>(IDLE);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPosition(IDLE);
      return;
    }
    const node = containerRef.current;
    if (!node) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return; // sin parallax en touch
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        setPosition({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
        frameRef.current = null;
      });
    };
    const handlePointerLeave = () => setPosition(IDLE);

    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      node.removeEventListener('pointermove', handlePointerMove);
      node.removeEventListener('pointerleave', handlePointerLeave);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [containerRef, prefersReducedMotion]);

  return position;
}
