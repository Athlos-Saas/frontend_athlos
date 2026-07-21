/** Espejo de `can_write()` en supabase/migrations/002_rls.sql. */
export const WRITE_ROLES = ['admin', 'coach', 'medical', 'analyst'] as const;

export function canWrite(role: string | null | undefined): boolean {
  return !!role && (WRITE_ROLES as readonly string[]).includes(role);
}
