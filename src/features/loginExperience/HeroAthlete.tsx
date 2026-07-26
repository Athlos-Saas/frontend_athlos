import { motion } from 'framer-motion';

import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * El "atleta" es directamente un rig de skeleton-tracking (joints + bones
 * glowing) en pose de remate — no un intento de silueta fotorealista (no
 * generamos imágenes/3D en este entorno). Encaja con la estética "la IA te
 * está analizando en tiempo real" pedida en el brief, sin depender de
 * ningún asset externo: es 100% SVG + Framer Motion.
 */
const JOINTS = {
  head: { x: 210, y: 68 },
  neck: { x: 207, y: 96 },
  shoulderL: { x: 170, y: 118 },
  shoulderR: { x: 244, y: 111 },
  elbowL: { x: 134, y: 162 },
  elbowR: { x: 274, y: 146 },
  wristL: { x: 110, y: 202 },
  wristR: { x: 300, y: 122 },
  chest: { x: 205, y: 140 },
  hipCenter: { x: 199, y: 228 },
  hipL: { x: 176, y: 234 },
  hipR: { x: 223, y: 225 },
  kneeL: { x: 160, y: 338 },
  kneeR: { x: 274, y: 293 },
  ankleL: { x: 146, y: 458 },
  ankleR: { x: 336, y: 324 },
} as const;

type JointKey = keyof typeof JOINTS;

const BONES: [JointKey, JointKey][] = [
  ['head', 'neck'],
  ['neck', 'shoulderL'],
  ['neck', 'shoulderR'],
  ['shoulderL', 'shoulderR'],
  ['shoulderL', 'elbowL'],
  ['elbowL', 'wristL'],
  ['shoulderR', 'elbowR'],
  ['elbowR', 'wristR'],
  ['neck', 'chest'],
  ['chest', 'hipCenter'],
  ['hipCenter', 'hipL'],
  ['hipCenter', 'hipR'],
  ['hipL', 'hipR'],
  ['hipL', 'kneeL'],
  ['kneeL', 'ankleL'],
  ['hipR', 'kneeR'],
  ['kneeR', 'ankleR'],
];

const BALL = { x: 360, y: 340, r: 14 };

export function HeroAthlete({ className }: { className?: string }) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <motion.svg
      viewBox="0 0 420 500"
      className={className}
      aria-hidden="true"
      initial={false}
      animate={prefersReducedMotion ? undefined : { y: [0, -10, 0], rotate: [0, 0.6, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <defs>
        <linearGradient id="hero-bone-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
        <filter id="hero-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Estelas de movimiento detrás de la pierna de remate */}
      {!prefersReducedMotion && (
        <motion.g
          stroke="#60a5fa"
          strokeLinecap="round"
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut', delay: 0.6 }}
        >
          <line x1={210} y1={300} x2={260} y2={288} />
          <line x1={220} y1={330} x2={272} y2={315} />
          <line x1={230} y1={362} x2={286} y2={345} />
        </motion.g>
      )}

      {/* Huesos */}
      <g filter="url(#hero-glow)">
        {BONES.map(([from, to], index) => {
          const a = JOINTS[from];
          const b = JOINTS[to];
          return (
            <motion.line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#hero-bone-gradient)"
              strokeWidth={4}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.85 }}
              transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : index * 0.045, ease: 'easeOut' }}
            />
          );
        })}
      </g>

      {/* Articulaciones */}
      {(Object.keys(JOINTS) as JointKey[]).map((key, index) => {
        const joint = JOINTS[key];
        return (
          <motion.circle
            key={key}
            cx={joint.x}
            cy={joint.y}
            r={key === 'head' ? 20 : 5}
            fill={key === 'head' ? 'rgba(15,23,42,0.4)' : '#eff6ff'}
            stroke="url(#hero-bone-gradient)"
            strokeWidth={key === 'head' ? 3 : 0}
            filter="url(#hero-glow)"
            initial={{ scale: 0, opacity: 0 }}
            animate={
              prefersReducedMotion
                ? { scale: 1, opacity: 1 }
                : { scale: [0, 1.3, 1], opacity: [0, 1, 0.9] }
            }
            transition={{ duration: 0.4, delay: index * 0.045 + 0.1, ease: 'backOut' }}
          />
        );
      })}

      {/* Pelota */}
      <motion.circle
        cx={BALL.x}
        cy={BALL.y}
        r={BALL.r}
        fill="none"
        stroke="url(#hero-bone-gradient)"
        strokeWidth={2.5}
        filter="url(#hero-glow)"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.9 }}
        transition={{ duration: 0.4, delay: 0.9, ease: 'backOut' }}
      />
    </motion.svg>
  );
}
