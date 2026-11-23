/**
 * Exportación de gráficos (PNG con firma ATHLOS) y de datos (CSV).
 *
 * Por qué sin dependencias: los charts de la app son SVG (Recharts y los
 * diagramas de campo propios), así que alcanza con serializar el SVG, pintarlo
 * en un canvas y pedirle el PNG. Se descartó `html2canvas` (~200 KB min, y
 * re-implementa el layout CSS con diferencias visibles en gradientes y
 * blend modes) y `html-to-image` (usa foreignObject, que Safari pinta en
 * blanco). El costo de no usarlas: lo que es HTML dentro de la card (leyendas
 * HTML de Recharts, grillas de divs) no sale en la imagen — por eso el título
 * y la descripción se dibujan aparte en el canvas.
 *
 * La firma (logo + "ATHLOS" + fecha) va en una franja al pie, no encima del
 * gráfico: la idea es que la imagen se pueda compartir en redes con la marca
 * visible pero sin tapar datos.
 */

import { colors } from '@/constants/tokens';

// ------------------------------------------------------------------ CSV

export interface CsvColumn {
  /** Clave de la fila (propiedad del objeto). */
  key: string;
  /** Encabezado visible; por defecto la clave. */
  header?: string;
  /** Transforma el valor antes de escribirlo (redondeo, etiqueta, etc.). */
  format?: (value: unknown, row: Record<string, unknown>) => unknown;
}

/**
 * Celdas que empiezan con = + - @ las interpreta Excel/Sheets como fórmula
 * (inyección CSV). Se neutralizan con un apóstrofo, salvo que sean números
 * (un "-3.2" es un valor legítimo y no debe cambiar).
 */
function sanitizeCell(raw: string): string {
  if (/^[=+\-@]/.test(raw) && Number.isNaN(Number(raw))) return `'${raw}`;
  return raw;
}

function toCsvCell(value: unknown): string {
  let raw: string;
  if (value === null || value === undefined) raw = '';
  else if (typeof value === 'object') raw = JSON.stringify(value);
  else raw = String(value);
  return `"${sanitizeCell(raw).replace(/"/g, '""')}"`;
}

/** Arma la matriz [encabezado, ...filas] a partir de objetos. Sin columnas
 * explícitas se usan las claves que aparecen en las filas, en orden de
 * aparición (las primeras 200 filas bastan para descubrirlas). */
export function objectsToRows(data: ReadonlyArray<object>, columns?: CsvColumn[]): string[][] {
  const records = data as ReadonlyArray<Record<string, unknown>>;
  let resolved = columns;
  if (!resolved || resolved.length === 0) {
    const keys: string[] = [];
    for (const row of records.slice(0, 200)) {
      for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
    }
    resolved = keys.map((key) => ({ key }));
  }
  const header = resolved.map((column) => column.header ?? column.key);
  const body = records.map((row) =>
    resolved!.map((column) => {
      const value = column.format ? column.format(row[column.key], row) : row[column.key];
      if (value === null || value === undefined) return '';
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }),
  );
  return [header, ...body];
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Se libera en el próximo tick: revocar en el mismo tick cancela la
  // descarga en Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Descarga un CSV. Lleva BOM UTF-8 porque sin él Excel en Windows abre el
 * archivo como ANSI y rompe tildes y eñes ("Ã±") — que en nombres de
 * jugadores en español es casi siempre.
 */
export function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n');
  downloadBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' }), fileName);
}

/** "Mapa de tiros · Liga" -> "mapa-de-tiros-liga". */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'grafico'
  );
}

/** Nombre de archivo con marca y fecha: `mapa-de-tiros-athlos-2026-11-23.png`. */
export function brandedFileName(base: string, extension: 'png' | 'csv'): string {
  const date = new Date().toISOString().slice(0, 10);
  return `${slugify(base)}-athlos-${date}.${extension}`;
}

// ------------------------------------------------------------------ PNG

/**
 * Propiedades que se copian del estilo computado al SVG clonado. Hace falta
 * porque el SVG serializado se pinta como imagen aislada: no ve las clases de
 * Tailwind ni las variables CSS de la página, solo lo que lleve inline.
 */
const INLINE_STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'letter-spacing',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
  'mix-blend-mode',
  'visibility',
] as const;

function inlineComputedStyles(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const declarations: string[] = [];
  for (const prop of INLINE_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (!value) continue;
    // Referencias a gradientes/patrones (`url(#id)`): algunos navegadores las
    // devuelven con la URL absoluta de la página, que dentro de la imagen
    // aislada no resuelve. Se deja el atributo original, que sí funciona.
    if (value.includes('url(')) continue;
    declarations.push(`${prop}:${value}`);
  }
  if (computed.display === 'none') declarations.push('display:none');
  const existing = target.getAttribute('style');
  target.setAttribute('style', `${existing ? `${existing};` : ''}${declarations.join(';')}`);

  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length && i < targetChildren.length; i += 1) {
    inlineComputedStyles(sourceChildren[i], targetChildren[i]);
  }
}

function svgToImage(svg: SVGSVGElement, width: number, height: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  // Tamaño explícito en px: los charts usan width="100%", que en una imagen
  // aislada no tiene contra qué resolverse y sale en 0x0 o en 300x150.
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));

  // Fondo CSS del <svg> (los diagramas de campo lo usan): como imagen aislada
  // se pierde, así que se agrega como <rect> si es un color sólido.
  const background = window.getComputedStyle(svg).backgroundColor;
  if (background && background !== 'rgba(0, 0, 0, 0)' && background !== 'transparent') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', background);
    clone.insertBefore(rect, clone.firstChild);
  }

  const xml = new XMLSerializer().serializeToString(clone);
  // data: URL y no blob: — con blob: algunos Safari marcan el canvas como
  // "tainted" y `toBlob` falla con SecurityError.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo rasterizar el SVG del gráfico.'));
    image.src = url;
  });
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    // Sin logo la imagen se exporta igual, con la firma solo en texto.
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/** Recorta el texto con "…" para que entre en `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 0 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) end -= 1;
  return `${text.slice(0, end)}…`;
}

export interface ChartPngOptions {
  title: string;
  subtitle?: string;
  /** Nombre de archivo final (con .png). */
  fileName: string;
  /** Fecha ya formateada en el idioma de la UI. */
  dateLabel: string;
}

const LOGO_SRC = '/images/Logo.png';
// Región del isotipo "A" dentro de Logo.png (1254x1254, blanco sobre negro).
// Se usa solo el isotipo: el logo completo a 18 px de alto es ilegible.
const LOGO_MARK_CROP = { sx: 410, sy: 305, sw: 455, sh: 395 } as const;
// 2x para que la imagen se vea nítida en pantallas retina y al subirla a redes
// (que recomprimen y castigan las imágenes chicas).
const EXPORT_SCALE = 2;
const PAD = 24;
const FOOTER_H = 40;
const MIN_WIDTH = 520;

/**
 * Captura los SVG de `container` (respetando su posición relativa) y descarga
 * un PNG con título, descripción y la firma ATHLOS. Lanza un Error si no hay
 * nada dibujable: el que llama lo muestra en un toast, no se descarga una
 * imagen vacía.
 */
export async function exportChartPng(container: HTMLElement, options: ChartPngOptions): Promise<void> {
  const containerRect = container.getBoundingClientRect();
  // Solo los SVG de primer nivel y con tamaño de gráfico: los íconos de
  // lucide (16-24 px) y los SVG anidados no se dibujan por separado.
  const svgs = Array.from(container.querySelectorAll('svg')).filter((svg) => {
    if (svg.parentElement?.closest('svg')) return false;
    if (svg.closest('[data-export-ignore]')) return false;
    const rect = svg.getBoundingClientRect();
    return rect.width >= 40 && rect.height >= 40;
  });
  if (svgs.length === 0) throw new Error('Este gráfico no tiene contenido exportable como imagen.');

  const chartW = Math.ceil(containerRect.width);
  const chartH = Math.ceil(containerRect.height);
  const width = Math.max(MIN_WIDTH, chartW + PAD * 2);
  const headerH = options.subtitle ? 58 : 40;
  const height = PAD + headerH + chartH + 12 + FOOTER_H;

  const [images, logo] = await Promise.all([
    Promise.all(
      svgs.map(async (svg) => {
        const rect = svg.getBoundingClientRect();
        return {
          image: await svgToImage(svg, rect.width, rect.height),
          x: rect.left - containerRect.left,
          y: rect.top - containerRect.top,
          w: rect.width,
          h: rect.height,
        };
      }),
    ),
    loadImage(LOGO_SRC),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = width * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no permite generar la imagen.');
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  ctx.fillStyle = colors.card;
  ctx.fillRect(0, 0, width, height);

  // Encabezado: misma jerarquía que la ChartCard (título + descripción).
  const font = 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = colors.textPrimary;
  ctx.font = `600 16px ${font}`;
  ctx.fillText(fitText(ctx, options.title, width - PAD * 2), PAD, PAD);
  if (options.subtitle) {
    ctx.fillStyle = colors.textSecondary;
    ctx.font = `400 12px ${font}`;
    ctx.fillText(fitText(ctx, options.subtitle, width - PAD * 2), PAD, PAD + 24);
  }

  const chartX = (width - chartW) / 2;
  const chartY = PAD + headerH;
  for (const item of images) {
    ctx.drawImage(item.image, chartX + item.x, chartY + item.y, item.w, item.h);
  }

  // Firma al pie: separador, isotipo + ATHLOS a la izquierda, fecha a la derecha.
  const footerY = height - FOOTER_H;
  ctx.fillStyle = colors.border;
  ctx.fillRect(PAD, footerY, width - PAD * 2, 1);
  const centerY = footerY + FOOTER_H / 2;
  let textX = PAD;
  if (logo) {
    const markH = 16;
    const markW = (LOGO_MARK_CROP.sw / LOGO_MARK_CROP.sh) * markH;
    // `screen` elimina el fondo negro del PNG del logo sobre el fondo oscuro
    // (el mismo truco que usa Login.tsx con mix-blend-screen).
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(
      logo,
      LOGO_MARK_CROP.sx,
      LOGO_MARK_CROP.sy,
      LOGO_MARK_CROP.sw,
      LOGO_MARK_CROP.sh,
      PAD,
      centerY - markH / 2,
      markW,
      markH,
    );
    ctx.restore();
    textX += markW + 8;
  }
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.textPrimary;
  ctx.font = `700 12px ${font}`;
  // Espaciado de letras a mano: `ctx.letterSpacing` no existe en Firefox < 115.
  for (const char of 'ATHLOS') {
    ctx.fillText(char, textX, centerY);
    textX += ctx.measureText(char).width + 2.5;
  }
  ctx.fillStyle = colors.textSecondary;
  ctx.font = `400 11px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(options.dateLabel, width - PAD, centerY);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo generar el PNG.');
  downloadBlob(blob, options.fileName);
}
