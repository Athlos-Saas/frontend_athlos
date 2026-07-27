/** Helpers de formato para la ficha de jugador. Siempre devuelven `null` si falta el dato de origen — nunca inventan un valor. */

export function calculateAge(birthdate?: string | null): number | null {
  if (!birthdate) return null;
  const born = new Date(birthdate);
  if (Number.isNaN(born.getTime())) return null;
  const diffMs = Date.now() - born.getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

export function calculateBmi(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function daysSince(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '--';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Muestra un número con `decimals` decimales, o "--" si es null/undefined. Nunca redondea a 0 por defecto. */
export function formatNumber(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  return value.toFixed(decimals);
}

export type Model3DExtension = 'glb' | 'gltf' | 'obj' | 'fbx';

/** Devuelve el formato 3D soportado a partir de la extensión, o null si no se reconoce/soporta (p. ej. usdz). */
export function detectModel3DFormat(filename: string): Model3DExtension | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf' || ext === 'obj' || ext === 'fbx') return ext;
  return null;
}
