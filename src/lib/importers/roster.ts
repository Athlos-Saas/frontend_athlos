import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';

/**
 * Puerto de src/atlos/etl/roster_loader.py (atlos-backend). Léelo ahí si
 * cambia el formato del Excel — esta es la misma lógica en TypeScript para
 * poder importar desde el navegador.
 */
export interface RosterPlayerRow {
  full_name: string;
  position: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  birthdate: string | null;
}

export interface RosterInjuryRow {
  full_name: string;
  injury_date: string;
  return_date: string | null;
  severity: 'minor' | 'moderate' | 'severe';
  notes: string;
}

export interface ParsedRoster {
  players: RosterPlayerRow[];
  injuries: RosterInjuryRow[];
}

const HEIGHT_RE = /(\d+)'\s*(\d+)/;
const LB_TO_KG = 0.453592;
const MONTH_DAY_RE =
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})/i;

function heightToCm(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const match = HEIGHT_RE.exec(String(value));
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  return Math.round((feet * 12 + inches) * 2.54 * 10) / 10;
}

function weightToKg(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const pounds = Number(value);
  if (Number.isNaN(pounds)) return null;
  return Math.round(pounds * LB_TO_KG * 10) / 10;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

/** injury_date es NOT NULL en la tabla pero el Excel solo trae texto libre. */
function guessInjuryDate(note: string, season: string): string {
  const year = (season.match(/\d{4}/)?.[0]) ?? '2000';
  const match = MONTH_DAY_RE.exec(note);
  if (match) {
    const parsed = new Date(`${match[1]} ${match[2]}, ${year}`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return `${year}-01-01`;
}

export function parseRoster(workbook: WorkBook, season: string): ParsedRoster {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const players: RosterPlayerRow[] = [];
  const injuries: RosterInjuryRow[] = [];

  for (const record of records) {
    const fullName = String(record.Name ?? '').trim();
    if (!fullName) continue;

    players.push({
      full_name: fullName,
      position: record.Position ? String(record.Position).trim() : null,
      height_cm: heightToCm(record.Height),
      weight_kg: weightToKg(record.Weight),
      birthdate: toIsoDate(record['Age (month/day/year)']),
    });

    const rawNote = record['Recent injuries'];
    if (rawNote === null || rawNote === undefined) continue;
    const note = String(rawNote).trim();
    if (!note) continue;

    const noteLower = note.toLowerCase();
    const injuryDate = guessInjuryDate(note, season);
    const isRecovered = noteLower.includes('recovered');
    injuries.push({
      full_name: fullName,
      injury_date: injuryDate,
      return_date: isRecovered ? injuryDate : null,
      severity: noteLower.includes('season') ? 'severe' : 'moderate',
      notes: note,
    });
  }

  return { players, injuries };
}

function ageFromBirthdate(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const years = (Date.now() - new Date(birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

/** Rangos plausibles para un jugador de fútbol universitario; no bloquean el import, solo avisan. */
export function validateRoster(parsed: ParsedRoster): string[] {
  const warnings: string[] = [];
  for (const player of parsed.players) {
    if (player.height_cm !== null && (player.height_cm < 140 || player.height_cm > 220)) {
      warnings.push(`${player.full_name}: altura ${player.height_cm}cm fuera de lo esperado (140-220cm).`);
    }
    if (player.weight_kg !== null && (player.weight_kg < 40 || player.weight_kg > 150)) {
      warnings.push(`${player.full_name}: peso ${player.weight_kg}kg fuera de lo esperado (40-150kg).`);
    }
    const age = ageFromBirthdate(player.birthdate);
    if (age !== null && (age < 14 || age > 50)) {
      warnings.push(`${player.full_name}: edad calculada ${age} años fuera de lo esperado (14-50).`);
    }
  }
  return warnings;
}
