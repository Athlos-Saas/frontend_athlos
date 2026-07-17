/**
 * ATHLOS Design System — fuente única de verdad para los tokens de color.
 * Espejo en CSS: src/styles/globals.css (bloque @theme).
 * Se usa desde JS/TS puro (Recharts, canvas, inline styles) donde las
 * clases de Tailwind no aplican directamente.
 */
export const colors = {
  bg: '#080B17',
  panel: '#111827',
  card: '#151B2A',
  border: '#1F2937',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  blue: '#3B82F6',
  purple: '#7C3AED',
  green: '#22C55E',
  orange: '#F59E0B',
  red: '#EF4444',
} as const;

export type ColorToken = keyof typeof colors;

export const chartTooltipStyle = {
  backgroundColor: colors.card,
  border: `1px solid ${colors.border}`,
  borderRadius: 12,
  color: colors.textPrimary,
  fontSize: 13,
} as const;

export const chartGridColor = colors.border;
export const chartAxisColor = colors.textSecondary;

/** Series de color estable para comparaciones multi-categoría en gráficos. */
export const chartSeriesPalette = [
  colors.blue,
  colors.purple,
  colors.green,
  colors.orange,
  colors.red,
] as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

/** Color estable por perfil físico (clustering K-Means de Perfiles ML). */
export const profileColors: Record<string, string> = {
  Velocista: colors.orange,
  Equilibrado: colors.blue,
  Resistente: colors.green,
};
