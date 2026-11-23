import type { OrgUserRole } from '@/lib/backendApi';

export const ROLE_LABEL: Record<OrgUserRole, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  medical: 'Médico',
  analyst: 'Analista',
  viewer: 'Solo lectura',
  athlete: 'Atleta',
};

export const ROLE_BADGE: Record<OrgUserRole, 'purple' | 'ai' | 'success' | 'warning' | 'neutral' | 'danger'> = {
  admin: 'purple',
  coach: 'ai',
  medical: 'success',
  analyst: 'warning',
  viewer: 'neutral',
  athlete: 'danger',
};

export const ALL_ROLES = Object.keys(ROLE_LABEL) as OrgUserRole[];

/**
 * Roles de staff: los que entran al dashboard y a los que aplica la Matriz de
 * permisos. `athlete` queda fuera: la base nunca le concede permisos por
 * override (has_permission() y el CHECK `permission_settings_no_athlete` de
 * 030), así que mostrarle una columna de checkboxes prometería algo falso.
 */
export const STAFF_ROLES = ALL_ROLES.filter((role) => role !== 'athlete');
