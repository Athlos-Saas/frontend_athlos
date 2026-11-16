import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'athlos:chunk-reload';

/**
 * `React.lazy` que sobrevive a un redeploy en Render.
 *
 * Cada build genera chunks con hash nuevo (`Analisis-<hash>.js`) y Render
 * borra los anteriores. Una pestaña abierta antes del deploy sigue pidiendo
 * los nombres viejos → 404 → "Failed to fetch dynamically imported module" y
 * el módulo nunca carga (antes de esto: pantalla en blanco). Recargar baja el
 * `index.html` nuevo con los hashes vigentes, así que se recarga UNA vez; el
 * flag en sessionStorage evita un bucle si el chunk de verdad no existe (en
 * ese caso el error sube al `ModuleErrorBoundary`).
 */
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await factory();
      safeSession(() => sessionStorage.removeItem(RELOAD_FLAG));
      return module;
    } catch (error) {
      const alreadyReloaded = safeSession(() => sessionStorage.getItem(RELOAD_FLAG)) === '1';
      if (!alreadyReloaded) {
        safeSession(() => sessionStorage.setItem(RELOAD_FLAG, '1'));
        window.location.reload();
        // La recarga ya está en curso: no resolver nunca evita pintar el error un instante.
        return new Promise<{ default: T }>(() => {});
      }
      throw error;
    }
  });
}

/** sessionStorage puede lanzar (modo privado, storage bloqueado): nunca debe romper la carga. */
function safeSession<R>(fn: () => R): R | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/** Errores que indican un chunk desaparecido (redeploy), no un bug del módulo. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically/i.test(message);
}
