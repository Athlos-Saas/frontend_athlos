import { useEffect, useRef } from 'react';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

const MAX_LINE_DISTANCE = 140;
const SWEEP_INTERVAL_MS = 9000;
const SWEEP_DURATION_MS = 2200;

/**
 * Canvas 2D: partículas flotando + líneas de conexión entre las cercanas +
 * un barrido horizontal periódico ("escaneo"). Sin librerías — vanilla
 * canvas + requestAnimationFrame, más liviano que cualquier lib de
 * partículas para este volumen. Con prefers-reduced-motion dibuja un solo
 * frame estático (partículas quietas) y no arranca el loop.
 */
export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let animationFrame = 0;
    let lastSweepAt = -SWEEP_INTERVAL_MS + 2000; // primer barrido a los ~2s

    const countForWidth = (w: number) => Math.max(24, Math.min(90, Math.round(w / 16)));

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      width = rect?.width ?? window.innerWidth;
      height = rect?.height ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = countForWidth(width);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        radius: Math.random() * 1.4 + 0.6,
      }));
    };

    resize();
    window.addEventListener('resize', resize);

    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(148, 197, 255, 0.35)';
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      return () => window.removeEventListener('resize', resize);
    }

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const elapsedSinceSweep = time - lastSweepAt;
      if (elapsedSinceSweep > SWEEP_INTERVAL_MS) lastSweepAt = time;
      if (elapsedSinceSweep >= 0 && elapsedSinceSweep < SWEEP_DURATION_MS) {
        const progress = elapsedSinceSweep / SWEEP_DURATION_MS;
        const sweepX = -width * 0.3 + progress * width * 1.6;
        const gradient = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 80, 0);
        gradient.addColorStop(0, 'rgba(124, 58, 237, 0)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.10)');
        gradient.addColorStop(1, 'rgba(124, 58, 237, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        for (let j = i + 1; j < particles.length; j += 1) {
          const other = particles[j];
          const dx = p.x - other.x;
          const dy = p.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance < MAX_LINE_DISTANCE) {
            ctx.strokeStyle = `rgba(59, 130, 246, ${0.12 * (1 - distance / MAX_LINE_DISTANCE)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        }

        ctx.beginPath();
        ctx.fillStyle = 'rgba(148, 197, 255, 0.55)';
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [prefersReducedMotion]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
