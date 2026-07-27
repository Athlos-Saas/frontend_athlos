import { useEffect, useState } from 'react';

import { ParticleField } from './ParticleField';
import type { ParallaxPosition } from './useMouseParallax';

export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const handleChange = () => setIsDesktop(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);
  return isDesktop;
}

/** 3 anillos que laten desde el centro hacia afuera, como un radar. */
function RadarWaves() {
  return (
    <div className="absolute left-1/2 top-1/2 size-10">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="motion-safe:animate-radar-ping absolute left-1/2 top-1/2 size-10 rounded-full border border-ai/25"
          style={{ animationDelay: `${i * 1.6}s` }}
        />
      ))}
    </div>
  );
}

/** Trazos tipo circuito recorridos por un pulso de luz (stroke-dashoffset en loop). */
function EnergyLines() {
  return (
    <svg className="absolute inset-0 size-full" viewBox="0 0 800 800" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="energy-gradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,120 C200,80 300,220 550,160 S780,90 800,140"
        fill="none"
        stroke="url(#energy-gradient)"
        strokeWidth="1.5"
        strokeDasharray="10 14"
        className="motion-safe:animate-energy-flow"
      />
      <path
        d="M0,660 C180,610 320,710 500,650 S760,570 800,620"
        fill="none"
        stroke="url(#energy-gradient)"
        strokeWidth="1.5"
        strokeDasharray="10 14"
        className="motion-safe:animate-energy-flow"
        style={{ animationDelay: '1.2s' }}
      />
    </svg>
  );
}

/**
 * Fondo en capas — un solo archivo agrupa varias decoraciones baratas
 * (gradiente vivo, neblina, grid con parallax real, glows, radar, líneas de
 * energía) en vez de un componente por capa; el canvas de partículas
 * (`ParticleField`, la única pieza con loop propio pesado) queda aparte y
 * solo se monta en desktop.
 */
export function AmbientBackground({
  parallax,
  isActive = false,
}: {
  parallax: ParallaxPosition;
  /** true ~1s mientras el login real está en vuelo — sube la turbulencia de partículas sin inventar una transición falsa. */
  isActive?: boolean;
}) {
  const isDesktop = useIsDesktop();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Gradiente vivo */}
      <div
        className="motion-safe:animate-gradient-drift absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1100px circle at 20% 25%, rgba(59,130,246,0.16), transparent 60%), radial-gradient(950px circle at 80% 78%, rgba(124,58,237,0.14), transparent 60%)',
          backgroundSize: '160% 160%',
        }}
      />

      {/* Neblina volumétrica */}
      <div className="motion-safe:animate-mist-drift absolute left-[8%] top-[12%] size-[34rem] rounded-full bg-ai/5 blur-[110px]" />
      <div
        className="motion-safe:animate-mist-drift absolute bottom-[8%] right-[4%] size-[30rem] rounded-full bg-purple/5 blur-[110px]"
        style={{ animationDelay: '5s', animationDirection: 'reverse' }}
      />

      {/* Grid — con parallax real del mouse */}
      <div
        className="absolute inset-[-6%] opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at 30% 20%, black 0%, transparent 70%)',
          transform: `translate3d(${parallax.x * -10}px, ${parallax.y * -10}px, 0)`,
        }}
      />

      {/* Glows respirando (3 acentos, períodos distintos para que nunca coincidan) */}
      <div className="motion-safe:animate-glow-breathe absolute -left-24 -top-24 size-[460px] rounded-full bg-ai/20 blur-3xl [animation-duration:7s]" />
      <div className="motion-safe:animate-glow-breathe absolute -bottom-32 -right-16 size-[460px] rounded-full bg-purple/20 blur-3xl [animation-duration:9s] [animation-delay:1.5s]" />
      <div className="motion-safe:animate-glow-breathe absolute left-1/2 top-[65%] size-[320px] rounded-full bg-success/10 blur-3xl [animation-duration:11s] [animation-delay:3s]" />

      <RadarWaves />
      <EnergyLines />

      {isDesktop && (
        <ParticleField
          className="absolute inset-0"
          mouseVelocity={isActive ? Math.max(parallax.velocity, 2.5) : parallax.velocity}
        />
      )}
    </div>
  );
}
