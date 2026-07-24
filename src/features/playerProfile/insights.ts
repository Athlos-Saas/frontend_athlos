import { daysSince } from './format';
import type { Injury } from '@/types/domain';

export interface PlayerStatus {
  label: 'Disponible' | 'Lesionado' | 'Recuperación';
  variant: 'success' | 'warning' | 'danger';
  activeInjury?: Injury;
}

const RECOVERY_WINDOW_DAYS = 14;

/**
 * Deriva el estado del jugador solo de `injuries` (nunca inventa "Suspendido":
 * no existe ningún dato de suspensiones en el esquema, así que esa opción no
 * se puede producir nunca).
 * - Hay una lesión sin `return_date` -> "Lesionado".
 * - Sin lesión activa pero con una cerrada hace <= 14 días -> "Recuperación"
 *   (regla explícita, no un campo de la BD).
 * - Si no, "Disponible".
 */
export function deriveStatus(injuries: Injury[]): PlayerStatus {
  const active = injuries.find((injury) => !injury.return_date);
  if (active) return { label: 'Lesionado', variant: 'danger', activeInjury: active };

  const recentlyRecovered = injuries.find((injury) => {
    const days = daysSince(injury.return_date);
    return days !== null && days <= RECOVERY_WINDOW_DAYS;
  });
  if (recentlyRecovered) return { label: 'Recuperación', variant: 'warning', activeInjury: recentlyRecovered };

  return { label: 'Disponible', variant: 'success' };
}

export interface DerivedInsights {
  strengths: string[];
  weaknesses: string[];
}

export interface InsightInputs {
  physicalProfileLabel?: string | null;
  roleName?: string | null;
  gkRole?: string | null;
  probaTopScorer?: number | null;
  fatigueLabel?: string | null;
  loadLabel?: string | null;
}

/**
 * Fortalezas/áreas de mejora derivadas ÚNICAMENTE de señales que ya existen
 * en ml_predictions/league_*_stats — nunca frases genéricas inventadas
 * ("Excelente visión" etc.). Si no hay ninguna señal, ambas listas quedan
 * vacías y el bloque correspondiente se oculta en la UI.
 */
export function deriveInsights(input: InsightInputs): DerivedInsights {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (input.physicalProfileLabel) strengths.push(`Perfil físico: ${input.physicalProfileLabel}`);
  if (input.roleName) strengths.push(`Rol ofensivo: ${input.roleName}`);
  if (input.gkRole) strengths.push(`Rol de portero: ${input.gkRole}`);
  if (input.probaTopScorer !== null && input.probaTopScorer !== undefined && input.probaTopScorer >= 0.7) {
    strengths.push(`Alta probabilidad de goleador de élite (${Math.round(input.probaTopScorer * 100)}%)`);
  }

  if (input.fatigueLabel === 'alto') weaknesses.push('Riesgo de fatiga alto en sesiones recientes');
  if (input.loadLabel === 'sobre_esfuerzo') weaknesses.push('Sobre-esfuerzo reciente (Player Load muy por encima de lo esperado)');

  return { strengths, weaknesses };
}
