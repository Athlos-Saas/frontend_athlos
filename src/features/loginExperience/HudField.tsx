import type { CSSProperties } from 'react';

import { HeroAthlete } from './HeroAthlete';
import { HudWidget } from './HudWidget';
import type { ParallaxPosition } from './useMouseParallax';

function parallaxStyle(parallax: ParallaxPosition, factor: number): CSSProperties {
  return { transform: `translate3d(${parallax.x * factor}px, ${parallax.y * factor}px, 0)` };
}

/** El "stage": atleta (skeleton-tracking) + 4 widgets HUD flotando alrededor, cada uno a una profundidad de parallax distinta. */
export function HudField({ parallax }: { parallax: ParallaxPosition }) {
  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-sm lg:max-w-md">
      <div className="absolute inset-0 drop-shadow-[0_0_40px_rgba(59,130,246,0.15)]" style={parallaxStyle(parallax, -6)}>
        <HeroAthlete className="h-full w-full" />
      </div>

      <div className="absolute left-[-4%] top-[10%] hidden lg:block" style={parallaxStyle(parallax, 16)}>
        <HudWidget label="Velocidad" value={31.6} decimals={1} unit="km/h" variant="ai" delay={0.5} />
      </div>
      <div className="absolute right-[-6%] top-[24%] hidden md:block" style={parallaxStyle(parallax, 22)}>
        <HudWidget label="Carga interna" value={82} unit="%" variant="warning" delay={0.7} />
      </div>
      <div className="absolute right-[-2%] top-[54%] hidden lg:block" style={parallaxStyle(parallax, 12)}>
        <HudWidget label="Score de rendimiento" value={92} unit="/100" variant="success" delay={0.9} />
      </div>
      <div className="absolute left-[-2%] bottom-[4%] hidden md:block" style={parallaxStyle(parallax, 18)}>
        <HudWidget label="Riesgo de lesión" value="Bajo" variant="success" delay={1.1} />
      </div>
    </div>
  );
}
