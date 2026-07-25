import type { OrgUserRole } from '@/lib/backendApi';

export const ROLE_LABEL: Record<OrgUserRole, string> = {
  admin: 'Administrador',
  coach: 'Entrenador',
  medical: 'Médico',
  analyst: 'Analista',
  viewer: 'Solo lectura',
};

export const ROLE_BADGE: Record<OrgUserRole, 'purple' | 'ai' | 'success' | 'warning' | 'neutral'> = {
  admin: 'purple',
  coach: 'ai',
  medical: 'success',
  analyst: 'warning',
  viewer: 'neutral',
};

export const ALL_ROLES = Object.keys(ROLE_LABEL) as OrgUserRole[];
