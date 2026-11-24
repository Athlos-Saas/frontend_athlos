/**
 * Espejo de PUBLIC_PROFILE_ROLES (atlos/api/v1/dependencies.py) y de
 * public.can_manage_public_profiles() (029). Más estricto que canWrite():
 * medical/analyst no deciden exponer a un atleta fuera de la org. El backend
 * es quien decide; esto solo evita mostrar un botón que daría 403.
 */
export function canManageVerifiedProfile(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'coach';
}

// ---------------------------------------------------------------------------
// Valores cerrados de la vitrina y del formulario de publicación.
// Regla de producto: el usuario nunca escribe un filtro ni un campo
// estructurado; elige de una lista. Así lo que se guarda y lo que se busca
// coinciden siempre (antes "Colombia" ≠ "colombia" ≠ "CO" y "Defender" no
// encontraba a un "Lateral Derecho"). El backend valida los mismos conjuntos
// (services/public_athlete_profile_service.py).
// ---------------------------------------------------------------------------

/**
 * Frontera fútbol: grupos de posición. El roster guarda texto libre mezclado
 * ("Midfielder", "Mediocampista Defensivo", "Portero"...); el backend lo
 * agrupa con `position_group` (market_scouting_service.py) al publicar y la
 * vitrina filtra por igualdad contra estos códigos. Otro deporte → condicionar
 * aquí por `sport`.
 */
export const POSITION_GROUPS = ['GK', 'DEF', 'MID', 'FWD'] as const;
export type PositionGroup = (typeof POSITION_GROUPS)[number];

/**
 * Países ofrecidos (ISO 3166-1 alfa-2): Latinoamérica, Caribe, Norteamérica y
 * los mercados europeos más habituales de academias y becas. Se guarda el
 * código; el nombre lo localiza `countryName` con Intl.DisplayNames, sin 70
 * claves de i18n duplicadas. Ampliar la lista no requiere migración.
 */
export const PROFILE_COUNTRIES = [
  // Sudamérica
  'AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'PY', 'PE', 'UY', 'VE',
  // Centroamérica y México
  'MX', 'GT', 'SV', 'HN', 'NI', 'CR', 'PA',
  // Caribe
  'CU', 'DO', 'PR', 'HT', 'JM', 'TT', 'BS', 'BB',
  // Norteamérica
  'US', 'CA',
  // Europa
  'ES', 'PT', 'GB', 'FR', 'DE', 'IT', 'NL',
] as const;

/** Nombre localizado de un código de país; texto tal cual si no es un código. */
export function countryName(value: string | null | undefined, language: string): string {
  if (!value) return '';
  if (!/^[A-Z]{2}$/.test(value)) return value;
  try {
    return new Intl.DisplayNames([language || 'es'], { type: 'region' }).of(value) ?? value;
  } catch {
    return value;
  }
}

/** Países ordenados por su nombre en el idioma actual (para los desplegables). */
export function sortedCountries(language: string): { code: string; name: string }[] {
  return PROFILE_COUNTRIES.map((code) => ({ code, name: countryName(code, language) })).sort((a, b) =>
    a.name.localeCompare(b.name, language || 'es'),
  );
}

/**
 * Área de contacto institucional (sale al público junto al email). Lista
 * cerrada: con texto libre alguien podía escribir el teléfono del atleta.
 * Espejo de CONTACT_LABEL_CODES del backend.
 */
export const CONTACT_LABEL_CODES = [
  'sporting_director',
  'head_coach',
  'coaching_staff',
  'recruiting',
  'athletics_department',
  'academy_director',
  'scholarships_office',
  'administration',
] as const;

/**
 * Dónde está archivado el consentimiento firmado (interno, nunca sale). Lista
 * cerrada: con texto libre se terminaba escribiendo el nombre del tutor.
 * Espejo de CONSENT_EVIDENCE_CODES del backend.
 */
export const CONSENT_EVIDENCE_CODES = [
  'signed_paper_club_archive',
  'signed_digital_club_drive',
  'esignature_platform',
  'enrollment_file',
  'federation_registration',
] as const;

/**
 * Promociones ofrecidas: del año pasado a +8 (un juvenil de 14 años que se
 * gradúa del secundario y busca beca). El CHECK de 029 admite 2000-2100; si un
 * perfil ya tiene un año fuera de este rango el diálogo lo agrega como opción.
 */
export function classYearOptions(current: number | null, today = new Date()): number[] {
  const year = today.getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => year - 1 + i);
  if (current != null && !years.includes(current)) years.push(current);
  return years.sort((a, b) => a - b);
}

/** Umbrales de los filtros de la vitrina (rango que admite el backend: edad 8-60). */
export const SHOWCASE_AGE_OPTIONS = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 28, 30, 35] as const;
/**
 * Velocidad p95 (km/h). Referencias: en fútbol las máximas medidas rondan
 * 36-37 km/h y el p95 de un juvenil/universitario cae típicamente en 24-30.
 */
export const SHOWCASE_SPEED_OPTIONS = [20, 24, 26, 28, 30, 32] as const;
/** Distancia por partido (km); un partido completo de fútbol ronda 9-11 km. */
export const SHOWCASE_DISTANCE_OPTIONS = [6, 8, 9, 10, 11] as const;

/** Sitio público de ATHLOS (CTA de la ficha). Configurable por entorno. */
export const ATHLOS_WEBSITE_URL: string =
  (import.meta.env.VITE_WEBSITE_URL as string | undefined) ?? 'https://athlos-7uio.onrender.com';

/** Enlace público de un perfil: misma app, ruta /p/:slug fuera del login. */
export function publicProfileUrl(slug: string): string {
  return `${window.location.origin}/p/${slug}`;
}
