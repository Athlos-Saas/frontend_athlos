import { TacticalBoard } from '@/features/tacticalBoard/TacticalBoard';

/**
 * Pizarra táctica (/pizarra): planificador de sesiones de entrenamiento con
 * pizarra, formaciones y animación. Toda la lógica vive en
 * features/tacticalBoard; la página solo inyecta org y usuario (las sesiones
 * son personales: RLS de training_sessions, migración 026).
 */
export default function PizarraTactica({ orgId, userId }: { orgId: string; userId: string }) {
  return <TacticalBoard orgId={orgId} userId={userId} />;
}
