/**
 * Espejo de `can_write()` en supabase/migrations/002_rls.sql. `athlete`
 * (030_athlete_role.sql) NO está y no debe estar: el atleta solo escribe su
 * propio wellness, por políticas RLS aparte.
 */
export const WRITE_ROLES = ['admin', 'coach', 'medical', 'analyst'] as const;

/** Rol del Portal del atleta (030). Espejo de ATHLETE_ROLE en atlos/api/v1/dependencies.py. */
export const ATHLETE_ROLE = 'athlete';

export function canWrite(role: string | null | undefined): boolean {
  return !!role && (WRITE_ROLES as readonly string[]).includes(role);
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === 'admin';
}

/**
 * El atleta no usa el dashboard: App.tsx lo manda a `AthletePortal`, sin
 * AppShell ni navegación. La UI es solo comodidad — lo que de verdad lo aísla
 * es RLS (current_org_id() es NULL para él).
 */
export function isAthlete(role: string | null | undefined): boolean {
  return role === ATHLETE_ROLE;
}

/** Espejo de ASSISTANT_ROLES en atlos/api/v1/dependencies.py — quién puede usar AthlosBot (nunca athlete). */
export function canUseAssistant(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'coach';
}

// ---------------------------------------------------------------------------
// Bienestar psicológico (032_wellbeing_checkins.sql)
// Espejo de public.wellbeing_access_level() / wellbeing_staff_can_write() y de
// wellbeing_access_level() / WELLBEING_WRITE_ROLES en
// atlos/api/v1/dependencies.py. Cambiar uno obliga a cambiar los otros.
//   admin   → 'detail' siempre (sin override).
//   medical → 'detail' por defecto (clave 'wellbeing.read').
//   coach   → 'flags' por defecto: estado y banderas, nunca respuestas.
//   'wellbeing.flags' = false baja a 'none' a medical/coach sin detail.
//   analyst, viewer, athlete → 'none' sin override posible.
// La UI solo decide qué mostrar: lo que impide leer es RLS y el backend.
// ---------------------------------------------------------------------------
export type WellbeingAccessLevel = 'detail' | 'flags' | 'none';

export const WELLBEING_READ_KEY = 'wellbeing.read';
export const WELLBEING_FLAGS_KEY = 'wellbeing.flags';
const WELLBEING_DETAIL_DEFAULTS: Record<string, boolean> = { admin: true, medical: true, coach: false };
export const WELLBEING_WRITE_ROLES = ['admin', 'medical'] as const;
/** Roles a los que la base nunca concede bienestar, aunque haya un override guardado. */
export const WELLBEING_NEVER_ROLES = ['analyst', 'viewer'] as const;

/**
 * `isAllowed(key, fallback)` resuelve el override de permission_settings para
 * el rol del usuario (ausencia de fila = fallback), igual que has_permission().
 */
export function wellbeingAccessLevel(
  role: string | null | undefined,
  isAllowed: (permissionKey: string, fallback: boolean) => boolean,
): WellbeingAccessLevel {
  if (role === 'admin') return 'detail';
  if (role !== 'medical' && role !== 'coach') return 'none';
  if (isAllowed(WELLBEING_READ_KEY, WELLBEING_DETAIL_DEFAULTS[role])) return 'detail';
  if (isAllowed(WELLBEING_FLAGS_KEY, true)) return 'flags';
  return 'none';
}

/** Cargar check-ins en nombre de un jugador: admin/medical con acceso detail. */
export function canWriteWellbeing(role: string | null | undefined, access: WellbeingAccessLevel): boolean {
  return access === 'detail' && !!role && (WELLBEING_WRITE_ROLES as readonly string[]).includes(role);
}
