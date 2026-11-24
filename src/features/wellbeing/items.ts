/**
 * Catálogo del check-in de bienestar psicológico.
 *
 * Espejo de `public.wellbeing_item_spec()` (atlos-backend/supabase/migrations/
 * 032_wellbeing_checkins.sql) y de `ITEMS` en services/wellbeing_service.py.
 * La base es la fuente de verdad: valida las claves y calcula las
 * puntuaciones; si este archivo diverge, el guardado falla (CHECK) en vez de
 * guardar algo mal. Cambiar uno obliga a cambiar los otros.
 *
 * Los textos son ORIGINALES (i18n: wellbeing.items.<clave>). Fuente
 * conceptual documentada en la cabecera de 032: Hooper/McLean para el formato
 * diario corto 1-5 y las dimensiones POMS/BRUMS solo como ejes (sin copiar
 * ítems, que tienen copyright).
 *
 * El ánimo diario NO está aquí: es `wellness_entries.mood` (ya existía). El
 * portal lo muestra dentro del bloque de bienestar con anclas verbales.
 */

export type WellbeingKind = 'daily' | 'weekly';
export type WellbeingAccess = 'detail' | 'flags' | 'none';

export interface WellbeingItem {
  key: string;
  kind: WellbeingKind;
  dimension: string;
  /** Redactado en sentido desfavorable: más acuerdo = peor estado (la base lo invierte). */
  reversed: boolean;
}

export const DAILY_ITEMS: WellbeingItem[] = [
  { key: 'd_stress', kind: 'daily', dimension: 'calm', reversed: true },
  { key: 'd_motivation', kind: 'daily', dimension: 'motivation', reversed: false },
  { key: 'd_confidence', kind: 'daily', dimension: 'confidence', reversed: false },
  { key: 'd_focus', kind: 'daily', dimension: 'focus', reversed: false },
  { key: 'd_connection', kind: 'daily', dimension: 'connection', reversed: false },
];

export const WEEKLY_ITEMS: WellbeingItem[] = [
  { key: 'w_energy', kind: 'weekly', dimension: 'energy', reversed: false },
  { key: 'w_tension_nerves', kind: 'weekly', dimension: 'calm', reversed: true },
  { key: 'w_tension_switch_off', kind: 'weekly', dimension: 'calm', reversed: true },
  { key: 'w_mood_enjoy', kind: 'weekly', dimension: 'mood', reversed: false },
  { key: 'w_mood_down', kind: 'weekly', dimension: 'mood', reversed: true },
  { key: 'w_irritability', kind: 'weekly', dimension: 'serenity', reversed: true },
  { key: 'w_mental_fatigue', kind: 'weekly', dimension: 'mental_freshness', reversed: true },
  { key: 'w_confidence', kind: 'weekly', dimension: 'confidence', reversed: false },
  { key: 'w_motivation', kind: 'weekly', dimension: 'motivation', reversed: false },
  { key: 'w_pressure_perform', kind: 'weekly', dimension: 'pressure', reversed: false },
  { key: 'w_pressure_block', kind: 'weekly', dimension: 'pressure', reversed: true },
  { key: 'w_resilience_reset', kind: 'weekly', dimension: 'resilience', reversed: false },
  { key: 'w_resilience_dwell', kind: 'weekly', dimension: 'resilience', reversed: true },
  { key: 'w_cohesion', kind: 'weekly', dimension: 'cohesion', reversed: false },
  { key: 'w_balance_organize', kind: 'weekly', dimension: 'life_balance', reversed: false },
  { key: 'w_balance_crowded', kind: 'weekly', dimension: 'life_balance', reversed: true },
];

/** Orden de las dimensiones en el perfil (mismo orden que el backend). */
export const DAILY_DIMENSIONS = ['mood', 'calm', 'motivation', 'confidence', 'focus', 'connection'] as const;
export const WEEKLY_DIMENSIONS = [
  'energy',
  'calm',
  'mood',
  'serenity',
  'mental_freshness',
  'confidence',
  'motivation',
  'pressure',
  'resilience',
  'cohesion',
  'life_balance',
] as const;

export const SCALE_VALUES = [1, 2, 3, 4, 5] as const;

/** Emojis del ítem de ánimo: decorativos (aria-hidden); el ancla verbal es lo accesible. */
export const MOOD_EMOJI: Record<number, string> = { 1: '😞', 2: '🙁', 3: '😐', 4: '🙂', 5: '😄' };

/** Respuestas parciales: el check-in diario permite saltarse ítems. */
export type WellbeingAnswers = Partial<Record<string, number>>;

/** Solo las respuestas contestadas (la base rechaza null o claves extra). */
export function compactAnswers(answers: WellbeingAnswers): Record<string, number> {
  return Object.fromEntries(Object.entries(answers).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
}
