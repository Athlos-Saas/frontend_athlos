import { useTranslation } from 'react-i18next';

export interface ModulePreview {
  description: string;
  bullets: string[];
  kpis: string[];
}

const ROUTE_KEYS: Record<string, string> = {
  '/equipos': 'equipos',
  '/temporadas': 'temporadas',
  '/pronosticos': 'pronosticos',
  '/scouting': 'scouting',
  '/reportes': 'reportes',
  '/dispositivos': 'dispositivos',
  '/integraciones': 'integraciones',
  '/alertas': 'alertas',
  '/clientes': 'clientes',
  '/configuracion': 'configuracion',
};

/**
 * Contenido de los módulos que todavía no tienen tabla propia en Supabase.
 * No se inventan datos — solo se describe qué va a mostrar cada módulo una
 * vez que el backend exponga la fuente correspondiente (ver Fase 1 de la
 * auditoría en docs/DESIGN_SYSTEM.md). `bullets`/`kpis` se piden con
 * `returnObjects: true` porque son arrays, no strings sueltos.
 */
export function useModulePreviews(): Record<string, ModulePreview> {
  const { t } = useTranslation();
  const result: Record<string, ModulePreview> = {};
  for (const [route, key] of Object.entries(ROUTE_KEYS)) {
    result[route] = {
      description: t(`modulePreviews.${key}.description`, ''),
      bullets: t(`modulePreviews.${key}.bullets`, { returnObjects: true, defaultValue: [] }) as string[],
      kpis: t(`modulePreviews.${key}.kpis`, { returnObjects: true, defaultValue: [] }) as string[],
    };
  }
  return result;
}
