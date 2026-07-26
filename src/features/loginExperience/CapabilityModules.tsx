import { motion } from 'framer-motion';
import { Activity, BrainCircuit, Sparkles, Video, type LucideIcon } from 'lucide-react';

interface Capability {
  icon: LucideIcon;
  label: string;
  description: string;
}

const CAPABILITIES: Capability[] = [
  { icon: BrainCircuit, label: 'Modelos de ML en producción', description: 'Fatiga, clustering y clasificación en tiempo real' },
  { icon: Activity, label: 'Monitoreo GPS y wellness', description: 'Carga física y prevención de lesiones' },
  { icon: Video, label: 'Video análisis', description: 'Tracking de jugadores con computer vision' },
  { icon: Sparkles, label: 'AI Intelligence Center', description: 'Insights y predicciones consolidadas' },
];

/** Grilla de capacidades con entrada escalonada y hover vivo (glass + glow de borde). */
export function CapabilityModules() {
  return (
    <motion.div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 1.1 } } }}
    >
      {CAPABILITIES.map((capability) => (
        <motion.div
          key={capability.label}
          variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          whileHover={{ y: -3, borderColor: 'rgba(59,130,246,0.4)' }}
          className="glass rounded-lg border border-border p-4 transition-colors"
        >
          <capability.icon className="size-5 text-ai" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">{capability.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{capability.description}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
