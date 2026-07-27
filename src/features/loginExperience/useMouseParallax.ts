import { useEffect, useRef, useState, type RefObject } from 'react';

import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

export interface ParallaxPosition {
  x: number;
  y: number;
  /** Magnitud del desplazamiento entre los últimos dos frames (px/frame, ya suavizada) — 0 si el mouse está quieto o recién entró. */
  velocity: number;
}

const IDLE: ParallaxPosition = { x: 0, y: 0, velocity: 0 };
// Suaviza la velocidad cruda (ruidosa frame a frame) para que la turbulencia
// no "tiemble" — media móvil exponencial simple.
const VELOCITY_SMOOTHING = 0.35;

/**
 * Posición normalizada del mouse (-1..1 en cada eje) relativa al centro de
 * `containerRef`, más una `velocity` suavizada para disparar efectos de
 * turbulencia en movimientos rápidos. Devuelve siempre el estado idle si el
 * usuario prefiere menos movimiento, o en touch (no hay mousemove real) —
 * nunca fuerza parallax donde no corresponde.
 */
export function useMouseParallax(containerRef: RefObject<HTMLElement>) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [position, setPosition] = useState<ParallaxPosition>(IDLE);
  const frameRef = useRef<number | null>(null);
  const lastPointRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const smoothedVelocityRef = useRef(0);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setPosition(IDLE);
      return;
    }
    const node = containerRef.current;
    if (!node) return;

    const settleToIdleVelocity = () => {
      smoothedVelocityRef.current = 0;
      setPosition((prev) => ({ ...prev, velocity: 0 }));
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return; // sin parallax en touch
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(settleToIdleVelocity, 220); // capa 20: al detenerse, vuelve a 0

      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;

        const now = performance.now();
        const last = lastPointRef.current;
        let rawVelocity = 0;
        if (last) {
          const dt = Math.max(1, now - last.t);
          const dist = Math.hypot(event.clientX - last.x, event.clientY - last.y);
          rawVelocity = dist / dt; // px/ms
        }
        lastPointRef.current = { x: event.clientX, y: event.clientY, t: now };
        smoothedVelocityRef.current =
          smoothedVelocityRef.current + (rawVelocity - smoothedVelocityRef.current) * VELOCITY_SMOOTHING;

        setPosition({
          x: Math.max(-1, Math.min(1, x)),
          y: Math.max(-1, Math.min(1, y)),
          velocity: smoothedVelocityRef.current,
        });
        frameRef.current = null;
      });
    };
    const handlePointerLeave = () => {
      lastPointRef.current = null;
      setPosition(IDLE);
    };

    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      node.removeEventListener('pointermove', handlePointerMove);
      node.removeEventListener('pointerleave', handlePointerLeave);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [containerRef, prefersReducedMotion]);

  return position;
}
