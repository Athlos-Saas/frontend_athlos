import { motion } from 'framer-motion';
import { Activity, BrainCircuit, Sparkles, Video, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Capability {
  icon: LucideIcon;
  key: string;
}

const CAPABILITIES: Capability[] = [
  { icon: BrainCircuit, key: 'ml' },
  { icon: Activity, key: 'gps' },
  { icon: Video, key: 'video' },
  { icon: Sparkles, key: 'ai' },
];

/** Grilla de capacidades con entrada escalonada y hover vivo (glass + glow de borde). */
export function CapabilityModules() {
  const { t } = useTranslation();
  return (
    <motion.div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 1.1 } } }}
    >
      {CAPABILITIES.map((capability) => (
        <motion.div
          key={capability.key}
          variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
          whileHover={{ y: -3, borderColor: 'rgba(59,130,246,0.4)' }}
          className="glass rounded-lg border border-border p-4 transition-colors"
        >
          <capability.icon className="size-5 text-ai" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">{t(`login.capabilities.${capability.key}.label`)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t(`login.capabilities.${capability.key}.description`)}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}
