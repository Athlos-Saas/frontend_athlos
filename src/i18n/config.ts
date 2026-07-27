import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

export const SUPPORTED_LANGUAGES = ['es', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Traducción incremental: solo el "chrome" siempre visible (barra lateral,
 * topbar, login) y los mensajes de espera de video están cubiertos hasta
 * ahora — el resto de las páginas todavía vive hardcodeado en español.
 * `fallbackLng: 'es'` hace que cualquier clave sin traducir en inglés
 * muestre español en vez de romperse o mostrar la clave cruda — así el
 * selector de idioma puede activarse ya mismo sin dejar la app a medias
 * traducida de forma visible.
 */
i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { es: { translation: es }, en: { translation: en } },
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
