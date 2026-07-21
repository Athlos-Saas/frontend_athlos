import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';

/**
 * Puerto de src/atlos/etl/catapult_loader.py (atlos-backend). Léelo ahí si
 * cambia el formato del export de Catapult — esta es la misma lógica en
 * TypeScript para poder importar desde el navegador. No resuelve
 * player_id: devuelve player_name para que el caller (que ya tiene el mapa
 * nombre→id de la organización) lo complete.
 */
export interface CatapultSessionRow {
  player_name: string;
  session_date: string;
  session_title: string;
  split_name: string;
  tags: string | null;
  duration_s: number | null;
  distance_km: number | null;
  sprint_distance_m: number | null;
  power_plays: number | null;
  energy_kcal: number | null;
  impacts: number | null;
  hr_load: number | null;
  time_in_red_zone_min: number | null;
  player_load: number | null;
  top_speed_kmh: number | null;
  distance_per_min: number | null;
  power_score_wkg: number | null;
  work_ratio: number | null;
  hr_max_bpm: number | null;
  max_deceleration_ms2: number | null;
  max_acceleration_ms2: number | null;
  speed_zones: Record<string, number>;
  hr_zones: Record<string, number>;
  acceleration_zones: Record<string, number>;
  deceleration_zones: Record<string, number>;
  power_zones: Record<string, number>;
  impact_zones: Record<string, number>;
  normalized_metrics: Record<string, number>;
  source: 'catapult';
}

const CORE_COLUMN_MAP: Record<string, string> = {
  Date: 'session_date',
  'Session Title': 'session_title',
  'Player Name': 'player_name',
  'Split Name': 'split_name',
  Tags: 'tags',
  Duration: 'duration_s',
  'Distance (km)': 'distance_km',
  'Sprint Distance (m)': 'sprint_distance_m',
  'Power Plays': 'power_plays',
  'Energy (kcal)': 'energy_kcal',
  Impacts: 'impacts',
  'Hr Load': 'hr_load',
  'Time In Red Zone (min)': 'time_in_red_zone_min',
  'Player Load': 'player_load',
  'Top Speed (km/h)': 'top_speed_kmh',
  'Distance Per Min (m/min)': 'distance_per_min',
  'Power Score (w/kg)': 'power_score_wkg',
  'Work Ratio': 'work_ratio',
  'Hr Max (bpm)': 'hr_max_bpm',
  'Max Deceleration (m/s/s)': 'max_deceleration_ms2',
  'Max Acceleration (m/s/s)': 'max_acceleration_ms2',
};

const ZONE_PREFIX_MAP: Array<[string, string]> = [
  ['Distance in Speed Zone', 'speed_zones'],
  ['Time in Speed Zone', 'speed_zones'],
  ['Time in HR Load Zone', 'hr_zones'],
  ['Distance in Acceleration Zones', 'acceleration_zones'],
  ['Time in Acceleration Zones', 'acceleration_zones'],
  ['Accelerations Zone Count', 'acceleration_zones'],
  ['Distance in Deceleration Zones', 'deceleration_zones'],
  ['Time in Deceleration Zones', 'deceleration_zones'],
  ['Deceleration Zone Count', 'deceleration_zones'],
  ['Distance in Power Zone', 'power_zones'],
  ['Time in Power Zone', 'power_zones'],
  ['Power Play Duration Zones', 'power_zones'],
  ['Impact Zones', 'impact_zones'],
];

const NORMALIZED_KEYWORD = 'Normalizada';

const INT_FIELDS = new Set(['duration_s', 'power_plays', 'impacts', 'hr_load', 'hr_max_bpm']);

function zoneFieldFor(column: string): string | null {
  const match = ZONE_PREFIX_MAP.find(([prefix]) => column.startsWith(prefix));
  return match ? match[1] : null;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(number) ? null : number;
}

/** "4/21/2025" -> "2025-04-21" (evita desfases de zona horaria de `new Date`). */
function parseSessionDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value ?? '').trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function extractPlayerNames(workbook: WorkBook): string[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  const names = new Set<string>();
  for (const record of records) {
    const name = String(record['Player Name'] ?? '').trim();
    if (name) names.add(name);
  }
  return [...names].sort();
}

export function parseCatapult(workbook: WorkBook): CatapultSessionRow[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const rows: CatapultSessionRow[] = [];

  for (const record of records) {
    const playerName = String(record['Player Name'] ?? '').trim();
    const sessionDate = parseSessionDate(record.Date);
    if (!playerName || !sessionDate) continue;

    const core: Record<string, unknown> = {};
    const zones: Record<string, Record<string, number>> = {
      speed_zones: {},
      hr_zones: {},
      acceleration_zones: {},
      deceleration_zones: {},
      power_zones: {},
      impact_zones: {},
    };
    const normalized: Record<string, number> = {};

    for (const [column, rawValue] of Object.entries(record)) {
      if (column in CORE_COLUMN_MAP) {
        const target = CORE_COLUMN_MAP[column];
        if (target === 'session_date' || target === 'player_name') continue;
        let value: unknown = target === 'session_title' || target === 'split_name' || target === 'tags'
          ? (rawValue === null ? null : String(rawValue))
          : cleanNumber(rawValue);
        if (value !== null && INT_FIELDS.has(target)) value = Math.round(Number(value));
        core[target] = value;
        continue;
      }
      if (column.includes(NORMALIZED_KEYWORD)) {
        const value = cleanNumber(rawValue);
        if (value !== null) normalized[column] = value;
        continue;
      }
      const zoneField = zoneFieldFor(column);
      if (zoneField) {
        const value = cleanNumber(rawValue);
        if (value !== null) zones[zoneField][column] = value;
      }
    }

    rows.push({
      player_name: playerName,
      session_date: sessionDate,
      session_title: (core.session_title as string) ?? '',
      split_name: (core.split_name as string) ?? 'Session',
      tags: (core.tags as string | null) ?? null,
      duration_s: (core.duration_s as number | null) ?? null,
      distance_km: (core.distance_km as number | null) ?? null,
      sprint_distance_m: (core.sprint_distance_m as number | null) ?? null,
      power_plays: (core.power_plays as number | null) ?? null,
      energy_kcal: (core.energy_kcal as number | null) ?? null,
      impacts: (core.impacts as number | null) ?? null,
      hr_load: (core.hr_load as number | null) ?? null,
      time_in_red_zone_min: (core.time_in_red_zone_min as number | null) ?? null,
      player_load: (core.player_load as number | null) ?? null,
      top_speed_kmh: (core.top_speed_kmh as number | null) ?? null,
      distance_per_min: (core.distance_per_min as number | null) ?? null,
      power_score_wkg: (core.power_score_wkg as number | null) ?? null,
      work_ratio: (core.work_ratio as number | null) ?? null,
      hr_max_bpm: (core.hr_max_bpm as number | null) ?? null,
      max_deceleration_ms2: (core.max_deceleration_ms2 as number | null) ?? null,
      max_acceleration_ms2: (core.max_acceleration_ms2 as number | null) ?? null,
      speed_zones: zones.speed_zones,
      hr_zones: zones.hr_zones,
      acceleration_zones: zones.acceleration_zones,
      deceleration_zones: zones.deceleration_zones,
      power_zones: zones.power_zones,
      impact_zones: zones.impact_zones,
      normalized_metrics: normalized,
      source: 'catapult',
    });
  }

  return rows;
}

/** Rangos plausibles para una sesión GPS; no bloquean el import, solo avisan. */
export function validateCatapult(rows: CatapultSessionRow[]): string[] {
  const warnings: string[] = [];
  for (const row of rows) {
    const label = `${row.player_name} (${row.session_date})`;
    if (row.distance_km !== null && (row.distance_km < 0 || row.distance_km > 20)) {
      warnings.push(`${label}: distancia ${row.distance_km}km fuera de lo esperado (0-20km).`);
    }
    if (row.top_speed_kmh !== null && (row.top_speed_kmh < 0 || row.top_speed_kmh > 45)) {
      warnings.push(`${label}: velocidad máx ${row.top_speed_kmh}km/h fuera de lo esperado (0-45km/h).`);
    }
    if (row.duration_s !== null && row.duration_s <= 0) {
      warnings.push(`${label}: duración ${row.duration_s}s inválida.`);
    }
  }
  return warnings;
}
