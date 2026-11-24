import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Pantalla completa de un elemento (no de toda la app) con la Fullscreen API.
 *
 * Safari ≤16.3 solo expone los métodos con prefijo webkit; en iPhone no hay
 * pantalla completa para elementos que no sean <video>, por eso `supported`
 * permite ocultar el botón en lugar de mostrar uno que no hace nada.
 *
 * El estado se lee del evento `fullscreenchange` y no del click: el usuario
 * puede salir con Esc o con el gesto del navegador sin pasar por el botón.
 */

type FsDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const fsDoc = () => document as FsDocument;
const currentFsElement = () => fsDoc().fullscreenElement ?? fsDoc().webkitFullscreenElement ?? null;

async function exitFs() {
  const d = fsDoc();
  try {
    if (d.exitFullscreen) await d.exitFullscreen();
    else await d.webkitExitFullscreen?.();
  } catch {
    // ya no estaba en pantalla completa (salida por Esc en paralelo)
  }
}

export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  const supported = typeof document !== 'undefined' && !!(fsDoc().fullscreenEnabled || fsDoc().webkitFullscreenEnabled);

  useEffect(() => {
    const node = ref.current;
    const sync = () => setActive(!!node && currentFsElement() === node);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      // Si se navega a otra ruta estando en pantalla completa, el elemento se
      // desmonta pero el documento seguiría en modo pantalla completa vacío.
      if (node && currentFsElement() === node) void exitFs();
    };
  }, [ref]);

  const toggle = useCallback(async () => {
    const el = ref.current as FsElement | null;
    if (!el) return;
    if (currentFsElement()) {
      await exitFs();
      return;
    }
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
    } catch {
      // denegado por el navegador (iframe sin allowfullscreen, política): no-op
    }
  }, [ref]);

  return { active, supported, toggle };
}
