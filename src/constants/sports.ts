/**
 * Configuración por deporte — el ÚNICO lugar del frontend donde vive lo que
 * cambia entre fútbol, básquet y rugby (dimensiones de campo, etiqueta,
 * superficie). Saldar la deuda documentada en CLAUDE.md: `teams.sport` existe
 * desde 001_schema.sql pero nada lo leía, y la cancha de 105x68 estaba fija en
 * `charts/SoccerPitchMap.tsx` y la etiqueta del deporte en `Header.tsx`.
 *
 * Espejo en backend: `atlos-backend/src/atlos/core/sports.py`. Las claves
 * (`soccer`, `basketball`, `rugby`) son las mismas que guarda `teams.sport`, y
 * las dimensiones tienen que coincidir con las de allá: el pipeline de video
 * proyecta las posiciones a metros con esas medidas, y si el frontend dibuja
 * otro campo los puntos caen corridos.
 *
 * Frontera de lo que sigue siendo SOLO FÚTBOL (no se condiciona por deporte
 * todavía, a propósito): la detección de eventos de video (pase, pérdida,
 * remate), el modelo de keypoints de cancha, ShotMapChart (coordenadas
 * StatsBomb 120x80) y las pantallas de goleadores/roles ofensivos. Ver
 * `soccerOnlyModules` abajo.
 */

export type SportKey = 'soccer' | 'basketball' | 'rugby';

export interface SportFieldDimensions {
  /** Largo de arco a arco / aro a aro / línea de try a línea de try, en metros. */
  lengthM: number;
  /** Ancho de banda a banda, en metros. */
  widthM: number;
}

export interface SportConfig {
  key: SportKey;
  /** Clave i18n de la etiqueta (dataviz-cluster.json). */
  labelKey: string;
  /** Texto por defecto si falta la traducción. */
  defaultLabel: string;
  field: SportFieldDimensions;
  /** Superficie del diagrama de campo: pasto o parquet. */
  surface: 'grass' | 'court';
}

export const DEFAULT_SPORT: SportKey = 'soccer';

export const SPORTS: Record<SportKey, SportConfig> = {
  // 105x68: medida recomendada FIFA para estadios y la que usó siempre el
  // pipeline (FIELD_LENGTH_M/FIELD_WIDTH_M del backend). No se cambia sin
  // cambiar también el backend: los eventos ya guardados están en esa escala.
  soccer: {
    key: 'soccer',
    labelKey: 'dataviz.sports.soccer',
    defaultLabel: 'Fútbol',
    field: { lengthM: 105, widthM: 68 },
    surface: 'grass',
  },
  // FIBA 28x15 (la NBA usa 28.65x15.24; se elige FIBA porque es la medida de
  // las ligas a las que apuntamos primero, fuera de EE. UU.).
  basketball: {
    key: 'basketball',
    labelKey: 'dataviz.sports.basketball',
    defaultLabel: 'Baloncesto',
    field: { lengthM: 28, widthM: 15 },
    surface: 'court',
  },
  // Rugby union: campo de juego de 100x70 entre líneas de try. Los in-goal
  // (hasta 22 m extra) quedan fuera: una cámara de partido rara vez los
  // encuadra y meterlos en el largo distorsionaría la escala de respaldo.
  rugby: {
    key: 'rugby',
    labelKey: 'dataviz.sports.rugby',
    defaultLabel: 'Rugby',
    field: { lengthM: 100, widthM: 70 },
    surface: 'grass',
  },
};

/**
 * Normaliza el valor crudo de `teams.sport` (o de `event_stats.sport`). Un
 * valor desconocido o vacío cae a fútbol porque es el default de la columna y
 * el único deporte con datos reales hoy; mostrar un campo de fútbol para un
 * deporte no configurado es preferible a romper el diagrama.
 */
export function resolveSport(value: string | null | undefined): SportKey {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized in SPORTS ? (normalized as SportKey) : DEFAULT_SPORT;
}

export function getSportConfig(value: string | null | undefined): SportConfig {
  return SPORTS[resolveSport(value)];
}

/**
 * Etiqueta visible de un deporte. Si el valor no está configurado se muestra
 * tal cual (en vez de "Fútbol"), para que un deporte nuevo cargado en la base
 * no aparezca disfrazado de otro en el selector del header.
 */
export function sportLabel(value: string, translate: (key: string, fallback: string) => string): string {
  const normalized = value.trim().toLowerCase();
  if (!(normalized in SPORTS)) return value;
  const config = SPORTS[normalized as SportKey];
  return translate(config.labelKey, config.defaultLabel);
}

/**
 * Módulos que hoy solo tienen sentido en fútbol. No se usa todavía para
 * ocultar nada (no hay clientes de otro deporte); existe para que la frontera
 * sea explícita y condicionarla después sea buscar este nombre, no arqueología.
 */
export const soccerOnlyModules = [
  'video-event-detection', // pase/pérdida/remate: umbrales calibrados a fútbol (backend event_detection.py)
  'pitch-keypoint-model', // homografía con keypoints de cancha de fútbol (backend pitch_calibration.py)
  'statsbomb-shot-map', // ShotMapChart: coordenadas StatsBomb 120x80
  'scouting-attacker-roles', // roles ofensivos y "goleadores" (Liga, Scouting)
] as const;
