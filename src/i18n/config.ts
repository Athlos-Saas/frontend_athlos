import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Cada módulo/página vive en su propio archivo bajo `locales/<lng>/<modulo>.json`
 * (en vez de un único `es.json`/`en.json` gigante) para que distintas partes
 * de la app se puedan traducir en paralelo sin que dos ediciones choquen en
 * el mismo archivo. `import.meta.glob` con `eager: true` los carga todos en
 * build time y los mezcla en un solo namespace — agregar un archivo nuevo
 * alcanza, no hace falta tocar este archivo.
 */
function mergeLocaleModules(glob: Record<string, { default: Record<string, unknown> }>) {
  return Object.values(glob).reduce((acc, module) => Object.assign(acc, module.default), {} as Record<string, unknown>);
}

const esModules = import.meta.glob('./locales/es/*.json', { eager: true }) as Record<string, { default: Record<string, unknown> }>;
const enModules = import.meta.glob('./locales/en/*.json', { eager: true }) as Record<string, { default: Record<string, unknown> }>;

/**
 * Traducción incremental: `fallbackLng: 'es'` hace que cualquier clave sin
 * traducir en inglés (o cualquier página que todavía no tenga su archivo de
 * módulo) muestre español en vez de romperse o mostrar la clave cruda — así
 * el selector de idioma puede estar activo ya mismo aunque la cobertura siga
 * creciendo módulo por módulo.
 */
i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: mergeLocaleModules(esModules) }, en: { translation: mergeLocaleModules(enModules) } },
    fallbackLng: 'es',
    supportedLngs: SUPPORTED_LANGUAGES,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'athlos-language',
    },
  });

export default i18next;
