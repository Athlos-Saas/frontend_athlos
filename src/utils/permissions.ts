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
