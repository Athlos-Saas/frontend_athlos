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

/**
 * Redimensiona/comprime una imagen en el navegador y la devuelve como Blob
 * JPEG, lista para subir al bucket `player-media`.
 */
export function resizeImageToBlob(file: File, maxSize = 640, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('No se pudo procesar la imagen en este navegador.'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen comprimida.'))),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('El archivo seleccionado no es una imagen válida.'));
    };
    img.src = objectUrl;
  });
}

export type Model3DExtension = 'glb' | 'gltf' | 'obj' | 'fbx';

/** Devuelve el formato 3D soportado a partir de la extensión, o null si no se reconoce/soporta (p. ej. usdz). */
export function detectModel3DFormat(filename: string): Model3DExtension | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'glb' || ext === 'gltf' || ext === 'obj' || ext === 'fbx') return ext;
  return null;
}
