import { backendFetch, backendFetchPublic } from '@/lib/backendApi';

/**
 * Cliente del perfil verificado (backend: api/v1/endpoints/athlete_profiles.py,
 * migración 029). Tres canales:
 *  - gestión (admin/coach de la org) con la sesión del usuario;
 *  - ficha pública SIN sesión (`backendFetchPublic`) — la página /p/:slug vive
 *    fuera del gate de login;
 *  - vitrina (cualquier staff logueado de una org cliente).
 *
 * Los tipos públicos espejan EXACTAMENTE la lista blanca de
 * `build_public_payload`: no hay campos de salud porque el backend no los
 * envía, y no se deben añadir aquí "por si acaso".
 */

export const PROFILE_SECTIONS = ['bio', 'attributes', 'physical', 'media', 'competition'] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

// ---------------------------------------------------------------------------
// Ficha pública (lista blanca)
// ---------------------------------------------------------------------------

export interface PublicAthleteAttributes {
  overall: number;
  values: { RIT: number; RES: number; ACE: number; TIR: number; CRE: number };
  scale: string;
}

export interface PublicGpsMetrics {
  sessions: number;
  matches_tracked: number;
  period_from: string | null;
  period_to: string | null;
  top_speed_p95_kmh: number | null;
  distance_per_session_km: number | null;
  distance_per_match_km: number | null;
  sprint_distance_per_session_m: number | null;
  max_acceleration_p95_ms2: number | null;
}

export interface PublicVideoMetrics {
  matches_analyzed: number;
  top_speed_p95_kmh: number | null;
  distance_per_match_km: number | null;
  visible_minutes_per_match: number | null;
}

export interface PublicCompetitionRow {
  season: string | null;
  competition: string | null;
  team_name: string | null;
  provider: string | null;
  appearances: number | null;
  lineups: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  shots: number | null;
  shots_on: number | null;
  goals_conceded: number | null;
  saves: number | null;
}

export interface PublicAthleteProfile {
  verified_by: 'ATHLOS';
  athlete: {
    display_name: string;
    position?: string | null;
    age?: number | null;
    height_cm?: number | null;
    class_year?: number | null;
    headline?: string | null;
    bio?: string | null;
  };
  club: { name: string | null; team: string | null };
  sport: string;
  country: string | null;
  sections: ProfileSection[];
  updated_at: string | null;
  attributes?: PublicAthleteAttributes;
  physical?: { gps: PublicGpsMetrics | null; video: PublicVideoMetrics | null };
  media?: { photo_url: string | null; action_photo_url: string | null };
  competition?: PublicCompetitionRow[];
  contact?: { label: string | null; email: string };
}

/** GET /v1/public/athletes/{slug} — sin auth. 404 genérico si no está publicado. */
export function getPublicAthleteProfile(slug: string): Promise<PublicAthleteProfile> {
  return backendFetchPublic(`/v1/public/athletes/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Gestión (admin/coach)
// ---------------------------------------------------------------------------

export interface ManagedAthleteProfile {
  id: string;
  slug: string;
  is_published: boolean;
  listed_in_showcase: boolean;
  published_at: string | null;
  visible_sections: ProfileSection[];
  headline: string | null;
  bio: string | null;
  class_year: number | null;
  sport: string;
  country: string | null;
  open_to_contact: boolean;
  contact_label: string | null;
  contact_email: string | null;
  athlete_consent: boolean;
  guardian_consent: boolean;
  consent_recorded_at: string | null;
  consent_recorded_by_name: string | null;
  consent_evidence_ref: string | null;
  consent_valid: boolean;
  updated_at: string | null;
}

export interface AthleteProfileManageView {
  profile: ManagedAthleteProfile | null;
  athlete: { has_birthdate: boolean; age: number | null; requires_guardian_consent: boolean };
  allowed_sections: ProfileSection[];
  unpublished_due_to_consent?: boolean;
}

export interface AthleteProfileSettings {
  visible_sections: ProfileSection[];
  headline: string | null;
  bio: string | null;
  class_year: number | null;
  country: string | null;
  open_to_contact: boolean;
  contact_label: string | null;
  contact_email: string | null;
  listed_in_showcase: boolean;
  athlete_consent: boolean;
  guardian_consent: boolean;
  consent_evidence_ref: string | null;
}

const managePath = (orgId: string, playerId: string, suffix = '') =>
  `/v1/athlete-profiles/${encodeURIComponent(playerId)}${suffix}?org_id=${encodeURIComponent(orgId)}`;

export function getAthleteProfileManage(orgId: string, playerId: string): Promise<AthleteProfileManageView> {
  return backendFetch(managePath(orgId, playerId));
}

export function saveAthleteProfile(
  orgId: string,
  playerId: string,
  settings: AthleteProfileSettings,
): Promise<AthleteProfileManageView> {
  return backendFetch(managePath(orgId, playerId), { method: 'PUT', body: JSON.stringify(settings) });
}

export function publishAthleteProfile(
  orgId: string,
  playerId: string,
  listedInShowcase: boolean,
): Promise<AthleteProfileManageView> {
  return backendFetch(managePath(orgId, playerId, '/publish'), {
    method: 'POST',
    body: JSON.stringify({ listed_in_showcase: listedInShowcase }),
  });
}

export function unpublishAthleteProfile(orgId: string, playerId: string): Promise<AthleteProfileManageView> {
  return backendFetch(managePath(orgId, playerId, '/unpublish'), { method: 'POST' });
}

export function regenerateAthleteProfileLink(orgId: string, playerId: string): Promise<AthleteProfileManageView> {
  return backendFetch(managePath(orgId, playerId, '/regenerate-link'), { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Vitrina
// ---------------------------------------------------------------------------

export interface ShowcaseCard {
  card_id: string;
  display_name: string;
  club: string | null;
  sport: string | null;
  country: string | null;
  position: string | null;
  age: number | null;
  class_year: number | null;
  top_speed_p95_kmh: number | null;
  distance_per_match_km: number | null;
  photo_url: string | null;
  open_to_contact: boolean;
}

export interface ShowcaseSearchResult {
  items: ShowcaseCard[];
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ShowcaseFilters {
  sport?: string;
  country?: string;
  position?: string;
  ageMin?: number;
  ageMax?: number;
  minTopSpeedKmh?: number;
  minDistancePerMatchKm?: number;
  page?: number;
  pageSize?: number;
}

/** Espejo de SHOWCASE_MAX_PAGE_SIZE / SHOWCASE_MAX_PAGE del servicio. */
export const SHOWCASE_PAGE_SIZE = 12;
export const SHOWCASE_MAX_PAGE = 20;

export function searchShowcase(filters: ShowcaseFilters): Promise<ShowcaseSearchResult> {
  const q = new URLSearchParams();
  if (filters.sport) q.set('sport', filters.sport);
  if (filters.country) q.set('country', filters.country);
  if (filters.position) q.set('position', filters.position);
  if (filters.ageMin != null) q.set('age_min', String(filters.ageMin));
  if (filters.ageMax != null) q.set('age_max', String(filters.ageMax));
  if (filters.minTopSpeedKmh != null) q.set('min_top_speed_kmh', String(filters.minTopSpeedKmh));
  if (filters.minDistancePerMatchKm != null) q.set('min_distance_per_match_km', String(filters.minDistancePerMatchKm));
  q.set('page', String(filters.page ?? 1));
  q.set('page_size', String(filters.pageSize ?? SHOWCASE_PAGE_SIZE));
  return backendFetch(`/v1/showcase/athletes?${q.toString()}`);
}

export function getShowcaseAthlete(cardId: string): Promise<PublicAthleteProfile> {
  return backendFetch(`/v1/showcase/athletes/${encodeURIComponent(cardId)}`);
}
