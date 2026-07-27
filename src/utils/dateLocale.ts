import i18next from '@/i18n/config';

const LOCALE_BY_LANGUAGE: Record<string, string> = { es: 'es-ES', en: 'en-US' };

/**
 * Locale real para `toLocaleDateString`/`toLocaleString` según el idioma
 * elegido (selector del Header) — antes estas llamadas tenían 'es-ES' fijo
 * en todo el código, así que las fechas no reaccionaban al cambiar a
 * inglés. Se lee del singleton de i18next (no de un hook) para que
 * funciones de formato puras (`formatDate`/`formatDateTime` en
 * `features/playerProfile/format.ts`) puedan usarlo sin recibir el idioma
 * como parámetro — los componentes que las llaman ya usan `useTranslation()`
 * en algún otro lado, así que ya se re-renderizan solos al cambiar de
 * idioma.
 */
export function getDateLocale(): string {
  return LOCALE_BY_LANGUAGE[i18next.resolvedLanguage ?? 'es'] ?? 'es-ES';
}
