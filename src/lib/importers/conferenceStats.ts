import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';

/**
 * Puerto de src/atlos/etl/conference_stats_loader.py + ATTACKER_RENAMES/
 * GOALKEEPER_RENAMES de league_stats_loader.py (atlos-backend). Léelos ahí
 * si cambia el formato del Excel de conferencia. No incluye las columnas de
 * ML (role_cluster, proba_top_scorer, gk_role...): esas se calculan aparte
 * con run_training.py, igual que al importar por CLI.
 */
export interface AttackerImportRow {
  player_name: string;
  team_name: string;
  gp: number | null;
  gs: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  shots: number | null;
  shots_on_goal: number | null;
  sh_pct: number | null;
  sog_pct: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  penalty_kicks: number | null;
  game_winning: number | null;
  goals_per_game: number | null;
  assists_per_game: number | null;
  points_per_game: number | null;
  shots_per_game: number | null;
  sh_pct_per_game: number | null;
  sog_per_game: number | null;
  sog_pct_per_game: number | null;
}

export interface GoalkeeperImportRow {
  player_name: string;
  team_name: string;
  gp: number | null;
  gs: number | null;
  ga_per_game: number | null;
  gaa: number | null;
  saves_per_game: number | null;
  goals_against: number | null;
  saves: number | null;
  save_pct: number | null;
}

export interface ParsedConferenceStats {
  attackers: AttackerImportRow[];
  goalkeepers: GoalkeeperImportRow[];
}

const ATTACKER_RENAMES: Record<string, keyof AttackerImportRow> = {
  Name: 'player_name',
  Team: 'team_name',
  gp: 'gp',
  gs: 'gs',
  g: 'goals',
  a: 'assists',
  pts: 'points',
  sh: 'shots',
  sog: 'shots_on_goal',
  'sh%': 'sh_pct',
  'sog%': 'sog_pct',
  yc: 'yellow_cards',
  rc: 'red_cards',
  pk: 'penalty_kicks',
  gw: 'game_winning',
  'g/g': 'goals_per_game',
  'a/g': 'assists_per_game',
  'pts/g': 'points_per_game',
  'sh/g': 'shots_per_game',
  'sh%/g': 'sh_pct_per_game',
  'sog/g': 'sog_per_game',
  'sog%/g': 'sog_pct_per_game',
};

const GOALKEEPER_RENAMES: Record<string, keyof GoalkeeperImportRow> = {
  Name: 'player_name',
  Team: 'team_name',
  gp: 'gp',
  gs: 'gs',
  'ga/g': 'ga_per_game',
  gaa: 'gaa',
  'sv/g': 'saves_per_game',
  ga: 'goals_against',
  sv: 'saves',
  'sv%': 'save_pct',
};

const IDENTIFIER_COLUMNS = new Set(['Rk', 'Name', 'Team']);
const INT_COLUMNS = new Set(['gp', 'goals', 'assists', 'points', 'shots', 'shots_on_goal', 'yellow_cards', 'red_cards', 'game_winning']);

type RawRecord = Record<string, unknown>;

function trimmed(record: RawRecord): RawRecord {
  const out: RawRecord = {};
  for (const [key, value] of Object.entries(record)) out[key.trim()] = value;
  return out;
}

function readSheet(workbook: WorkBook, name: string): RawRecord[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Falta la hoja "${name}" en el Excel de conferencia.`);
  return XLSX.utils.sheet_to_json<RawRecord>(sheet, { defval: null }).map(trimmed);
}

function coerceNumeric(record: RawRecord): RawRecord {
  const out: RawRecord = {};
  for (const [key, value] of Object.entries(record)) {
    if (IDENTIFIER_COLUMNS.has(key)) {
      out[key] = value;
      continue;
    }
    // Una celda con formato fecha (dato corrupto en el Excel fuente, ej. "pk") se
    // trata igual que pandas: no es un número válido, queda null.
    if (value instanceof Date || value === null || value === undefined || value === '') {
      out[key] = null;
      continue;
    }
    const number = Number(value);
    out[key] = Number.isNaN(number) ? null : number;
  }
  return out;
}

function keyOf(record: RawRecord): string {
  return `${String(record.Name ?? '').trim()}|${String(record.Team ?? '').trim()}`;
}

function indexBy(records: RawRecord[]): Map<string, RawRecord> {
  const map = new Map<string, RawRecord>();
  for (const record of records) map.set(keyOf(record), record);
  return map;
}

function leftMergeColumns(base: RawRecord[], other: RawRecord[], columns: string[]): RawRecord[] {
  const index = indexBy(other);
  return base.map((row) => {
    const match = index.get(keyOf(row));
    const merged = { ...row };
    for (const column of columns) merged[column] = match ? match[column] ?? null : null;
    return merged;
  });
}

function buildRows(records: RawRecord[], renames: Record<string, string>): RawRecord[] {
  const rows: RawRecord[] = [];
  for (const raw of records) {
    const numeric = coerceNumeric(raw);
    const row: RawRecord = {};
    for (const [source, target] of Object.entries(renames)) {
      if (source in numeric) row[target] = numeric[source];
    }
    if (row.player_name && row.team_name) rows.push(row);
  }
  return rows;
}

// Redondea a entero las columnas que en Supabase son int (evita 18.0 -> falla de tipo).
function roundIntColumns(row: RawRecord): RawRecord {
  const out = { ...row };
  for (const column of Object.keys(out)) {
    if (INT_COLUMNS.has(column) && typeof out[column] === 'number') {
      out[column] = Math.round(out[column] as number);
    }
  }
  return out;
}

export function parseConferenceStats(workbook: WorkBook): ParsedConferenceStats {
  const gameScoring = readSheet(workbook, 'Game-Scoring');
  const gameShooting = readSheet(workbook, 'Game-Shooting');
  const gameGk = readSheet(workbook, 'Game-Goalkepeer');
  const seasonScoring = readSheet(workbook, 'Season-Scoring');
  const seasonShooting = readSheet(workbook, 'Season-Shooting');
  const seasonMisc = readSheet(workbook, 'Season-Misc');
  const seasonGk = readSheet(workbook, 'Season-Goalkepeer');

  let attackersMerged = leftMergeColumns(gameScoring, gameShooting, ['sh/g', 'sh%/g', 'sog/g', 'sog%/g']);
  attackersMerged = leftMergeColumns(attackersMerged, seasonScoring, ['g', 'a', 'pts']);
  attackersMerged = leftMergeColumns(attackersMerged, seasonShooting, ['sh', 'sh%', 'sog', 'sog%']);
  attackersMerged = leftMergeColumns(attackersMerged, seasonMisc, ['yc', 'rc', 'pk', 'gw']);

  const goalkeepersMerged = leftMergeColumns(gameGk, seasonGk, ['ga', 'sv', 'sv%']);

  const attackers = buildRows(attackersMerged, ATTACKER_RENAMES).map(roundIntColumns) as unknown as AttackerImportRow[];
  const goalkeepers = buildRows(goalkeepersMerged, GOALKEEPER_RENAMES).map(roundIntColumns) as unknown as GoalkeeperImportRow[];

  return { attackers, goalkeepers };
}
