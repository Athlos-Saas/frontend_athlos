import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

import { AmbientBackground } from '@/features/loginExperience/AmbientBackground';
import { CapabilityModules } from '@/features/loginExperience/CapabilityModules';
import { HudField } from '@/features/loginExperience/HudField';
import { LoginConsole } from '@/features/loginExperience/LoginConsole';
import { useMouseParallax } from '@/features/loginExperience/useMouseParallax';

export interface LoginProps {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
}

/**
 * Login Experience V2 — la lógica de autenticación en sí vive intacta en
 * `LoginConsole.tsx` (mismo `onSignIn`, misma validación). Este archivo
 * solo compone el layout inmersivo alrededor: fondo en capas, atleta
 * skeleton-tracking + widgets HUD, capacidades, y la consola de login.
 */
export default function Login({ onSignIn }: LoginProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const parallax = useMouseParallax(stageRef);

  return (
    <div ref={stageRef} className="relative grid min-h-screen grid-cols-1 overflow-hidden bg-bg lg:grid-cols-[1.65fr_1fr]">
      {/* Panel inmersivo — solo en desktop */}
      <div className="relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <AmbientBackground />

        <motion.div
          className="relative flex items-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <img src="/images/Logo.png" alt="ATHLOS" className="h-20 w-auto mix-blend-screen" />
          <span className="rounded-full border border-purple/30 bg-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple">
            AI Platform
          </span>
        </motion.div>

        {/* Atleta + widgets, centrados, superpuestos al texto en pantallas grandes */}
        <div className="pointer-events-none absolute inset-y-0 right-[6%] top-1/2 hidden w-[36%] -translate-y-1/2 xl:block">
          <HudField parallax={parallax} />
        </div>

        <div className="relative max-w-md">
          <motion.h1
            className="text-4xl font-bold leading-tight tracking-tight text-foreground"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Inteligencia artificial para el rendimiento deportivo de élite.
          </motion.h1>
          <motion.p
            className="mt-4 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            Datos, modelos y predicciones en una sola plataforma — construida para equipos que
            compiten con precisión.
          </motion.p>

          <div className="mt-8">
            <CapabilityModules />
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          Row Level Security por organización — tus datos, aislados y protegidos.
        </div>
      </div>

      {/* Consola de login */}
      <div className="relative flex items-center justify-center overflow-hidden p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-60 lg:hidden"
          style={{
            background:
              'radial-gradient(600px circle at 20% 20%, rgba(59,130,246,0.12), transparent 60%), radial-gradient(500px circle at 80% 80%, rgba(124,58,237,0.12), transparent 60%)',
          }}
          aria-hidden="true"
        />

        <div className="relative w-full max-w-sm">
          <div className="mb-7 lg:hidden">
            <img src="/images/Logo.png" alt="ATHLOS" className="h-16 w-auto mix-blend-screen" />
          </div>

          <LoginConsole onSignIn={onSignIn} />
        </div>
      </div>
    </div>
  );
}
