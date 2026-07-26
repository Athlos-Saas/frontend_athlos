import { useEffect, useState } from 'react';

import { ParticleField } from './ParticleField';

function useIsDesktop() {
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

/** Fondo en capas: grid sutil + 2 glows "respirando" + partículas/líneas/barrido (solo desktop, evita gastar un canvas RAF en pantallas chicas). */
export function AmbientBackground() {
  const isDesktop = useIsDesktop();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at 30% 20%, black 0%, transparent 70%)',
        }}
      />
      <div className="motion-safe:animate-glow-breathe absolute -left-24 -top-24 size-[460px] rounded-full bg-ai/20 blur-3xl [animation-duration:7s]" />
      <div className="motion-safe:animate-glow-breathe absolute -bottom-32 -right-16 size-[460px] rounded-full bg-purple/20 blur-3xl [animation-duration:9s] [animation-delay:1.5s]" />
      {isDesktop && <ParticleField className="absolute inset-0" />}
    </div>
  );
}
