import * as XLSX from 'xlsx';

/**
 * Plantillas descargables para cada tipo de import. Los encabezados tienen
 * que calzar exactamente con lo que esperan detect.ts/roster.ts/catapult.ts/
 * conferenceStats.ts — si cambias una columna ahí, actualízala aquí también.
 */

function buildWorkbook(sheets: Array<{ name: string; rows: Record<string, unknown>[] }>): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  for (const { name, rows } of sheets) {
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return workbook;
}

export function buildRosterTemplateWorkbook(): XLSX.WorkBook {
  return buildWorkbook([
    {
      name: 'Sheet1',
      rows: [
        {
          No: 0,
          Name: 'Nombre Apellido',
          Position: 'Goalkeeper',
          Weight: 180,
          Height: "6'1",
          Class: 'Sr.',
          'Age (month/day/year)': new Date(2003, 8, 9),
          Hometown: 'Ciudad, País',
          'Recent injuries': '',
        },
      ],
    },
  ]);
}

export function downloadRosterTemplate(): void {
  XLSX.writeFile(buildRosterTemplateWorkbook(), 'plantilla-roster.xlsx');
}

export function buildCatapultTemplateWorkbook(): XLSX.WorkBook {
  return buildWorkbook([
    {
      name: 'Sheet1',
      rows: [
        {
          Date: '4/21/2025',
          'Session Title': 'April 21 2025',
          'Player Name': 'Nombre Apellido',
          'Split Name': 'all',
          Tags: 'training',
          Duration: 6000,
          'Distance (km)': 6.0,
          'Sprint Distance (m)': 100,
          'Power Plays': 15,
          'Energy (kcal)': 350,
          Impacts: 2,
          'Hr Load': 0,
          'Time In Red Zone (min)': 0,
          'Player Load': 300,
          'Top Speed (km/h)': 22,
          'Distance Per Min (m/min)': 55,
          'Power Score (w/kg)': 4.5,
          'Work Ratio': 18,
          'Hr Max (bpm)': 0,
          'Max Deceleration (m/s/s)': 6,
          'Max Acceleration (m/s/s)': 5,
        },
      ],
    },
  ]);
}

export function downloadCatapultTemplate(): void {
  XLSX.writeFile(buildCatapultTemplateWorkbook(), 'plantilla-catapult.csv');
}

export function buildConferenceTemplateWorkbook(): XLSX.WorkBook {
  const player = { Name: 'Nombre Apellido', Team: 'Mi Equipo' };
  return buildWorkbook([
    { name: 'Game-Scoring', rows: [{ Rk: 1, ...player, gp: 18, gs: 18, 'g/g': 0, 'a/g': 0, 'pts/g': 0 }] },
    { name: 'Game-Shooting', rows: [{ Rk: 1, ...player, gp: 18, 'sh/g': 0, 'sh%/g': 0, 'sog/g': 0, 'sog%/g': 0 }] },
    { name: 'Game-Goalkepeer', rows: [{ Rk: 1, ...player, gp: 0, gs: 0, 'ga/g': 0, gaa: 0, 'sv/g': 0 }] },
    { name: 'Season-Scoring', rows: [{ Rk: 1, ...player, gp: 18, gs: 18, g: 0, a: 0, pts: 0 }] },
    { name: 'Season-Shooting', rows: [{ Rk: 1, ...player, gp: 18, sh: 0, 'sh%': 0, sog: 0, 'sog%': 0 }] },
    { name: 'Season-Misc', rows: [{ Rk: 1, ...player, gp: 18, yc: 0, rc: 0, pk: 0, gw: 0 }] },
    { name: 'Season-Goalkepeer', rows: [{ Rk: 1, ...player, gp: 0, gs: 0, ga: 0, sv: 0, 'sv%': 0 }] },
  ]);
}

export function downloadConferenceTemplate(): void {
  XLSX.writeFile(buildConferenceTemplateWorkbook(), 'plantilla-stats-conferencia.xlsx');
}
