import { useEffect } from 'react';

/**
 * Guarda window.scrollY en sessionStorage al desmontar y lo restaura al
 * montar — usado en páginas de lista que navegan a un detalle y necesitan
 * volver exactamente donde estaban (sessionStorage en vez de depender del
 * botón "atrás" del navegador, para que funcione igual con cualquier forma
 * de volver).
 */
export function useScrollRestoration(key: string) {
  useEffect(() => {
    const saved = sessionStorage.getItem(`scroll:${key}`);
    if (saved) {
      // Espera al siguiente frame: el contenido real (tabla con datos) aún
      // no terminó de pintarse en el primer render.
      requestAnimationFrame(() => window.scrollTo(0, Number(saved)));
    }

    return () => {
      sessionStorage.setItem(`scroll:${key}`, String(window.scrollY));
    };
  }, [key]);
}
