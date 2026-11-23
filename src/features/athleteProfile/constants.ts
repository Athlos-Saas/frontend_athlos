/**
 * Espejo de PUBLIC_PROFILE_ROLES (atlos/api/v1/dependencies.py) y de
 * public.can_manage_public_profiles() (029). Más estricto que canWrite():
 * medical/analyst no deciden exponer a un atleta fuera de la org. El backend
 * es quien decide; esto solo evita mostrar un botón que daría 403.
 */
export function canManageVerifiedProfile(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'coach';
}

/** Sitio público de ATHLOS (CTA de la ficha). Configurable por entorno. */
export const ATHLOS_WEBSITE_URL: string =
  (import.meta.env.VITE_WEBSITE_URL as string | undefined) ?? 'https://athlos-7uio.onrender.com';

/** Enlace público de un perfil: misma app, ruta /p/:slug fuera del login. */
export function publicProfileUrl(slug: string): string {
  return `${window.location.origin}/p/${slug}`;
}
