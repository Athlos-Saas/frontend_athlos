import type { WorkBook } from 'xlsx';
import * as XLSX from 'xlsx';

import type { DetectedFile } from './types';

const CONFERENCE_SHEETS = ['Game-Scoring', 'Game-Goalkepeer'];

function headerRow(workbook: WorkBook): string[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
  return (rows[0] ?? []).map((cell) => String(cell ?? '').trim());
}

function hasAll(headers: string[], needles: string[]): boolean {
  return needles.every((needle) => headers.includes(needle));
}

/**
 * Decide a qué módulo corresponde un archivo mirando su contenido (hojas y
 * encabezados), no su nombre — así funciona sin importar cómo lo hayan
 * renombrado. Ver plan: roster / catapult / conference son las 3 fuentes
 * reales; todo lo demás (medias vs. conferencia, resúmenes) se rechaza con
 * un motivo, porque ya se recalcula solo o es un subconjunto ya incluido.
 */
export function detectKind(workbook: WorkBook): DetectedFile {
  if (CONFERENCE_SHEETS.every((name) => workbook.SheetNames.includes(name))) {
    return { kind: 'conference' };
  }

  const headers = headerRow(workbook);

  if (hasAll(headers, ['Player Name', 'Player Load'])) {
    return { kind: 'catapult' };
  }

  if (hasAll(headers, ['Name', 'Position', 'Weight', 'Height'])) {
    return { kind: 'roster' };
  }

  if (headers.some((header) => header.includes('Conferencia') || header === 'Métrica')) {
    return {
      kind: 'unknown',
      reason:
        'Este archivo ya es un resumen de equipo vs. conferencia — se recalcula automáticamente ' +
        'desde las stats de atacantes/porteros que importes en Competiciones; no hace falta cargarlo aparte.',
    };
  }

  if (hasAll(headers, ['Name', 'Team']) && headers.some((header) => header.includes('/g'))) {
    return {
      kind: 'unknown',
      reason:
        'Este archivo es un subconjunto de las stats de conferencia (ya viene completo en el Excel ' +
        'de Stats Conference); no hace falta importarlo aparte.',
    };
  }

  return {
    kind: 'unknown',
    reason:
      'No reconozco el formato de este archivo. Esperaba un roster físico (columnas Name/Position/' +
      'Weight/Height), un export de Catapult (columnas Player Name/Player Load) o el Excel de stats ' +
      'de conferencia (hojas Game-Scoring, Game-Goalkepeer, etc.).',
  };
}
