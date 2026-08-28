import {
  Activity,
  Bell,
  BrainCircuit,
  Building2,
  CalendarRange,
  ClipboardCheck,
  Cpu,
  Database,
  FileBarChart2,
  Gamepad2,
  LayoutDashboard,
  Plug,
  Radar,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  /** Español, usado como fallback/valor por defecto donde todavía no se llama a t(labelKey). */
  label: string;
  /** Clave de traducción (`nav.*` en es.json/en.json). */
  labelKey: string;
  to: string;
  icon: LucideIcon;
  /** Módulos sin backend propio todavía — Fase 1 de la auditoría los marcó como pendientes de datos reales. */
  comingSoon?: boolean;
}

export interface NavSection {
  section: string;
  sectionKey: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'General',
    sectionKey: 'nav.section.general',
    items: [
      { label: 'Dashboard', labelKey: 'nav.dashboard', to: '/', icon: LayoutDashboard },
      { label: 'Módulo Entrenador', labelKey: 'nav.coachModule', to: '/entrenador', icon: ClipboardCheck },
    ],
  },
  {
    section: 'Rendimiento',
    sectionKey: 'nav.section.rendimiento',
    items: [
      { label: 'Análisis', labelKey: 'nav.analisis', to: '/analisis', icon: Activity },
      { label: 'Atletas', labelKey: 'nav.atletas', to: '/atletas', icon: UserRound },
      { label: 'Equipos', labelKey: 'nav.equipos', to: '/equipos', icon: Shield },
      { label: 'Competiciones', labelKey: 'nav.competiciones', to: '/competiciones', icon: Trophy },
      { label: 'Temporadas', labelKey: 'nav.temporadas', to: '/temporadas', icon: CalendarRange },
    ],
  },
  {
    section: 'Inteligencia artificial',
    sectionKey: 'nav.section.ia',
    items: [
      { label: 'Centro de Inteligencia IA', labelKey: 'nav.aiCenter', to: '/ai', icon: Sparkles },
      { label: 'Pronósticos IA', labelKey: 'nav.pronosticos', to: '/pronosticos', icon: BrainCircuit },
      { label: 'Modelos IA', labelKey: 'nav.modelosIa', to: '/modelos', icon: BrainCircuit },
      { label: 'Búsqueda de talento', labelKey: 'nav.scouting', to: '/scouting', icon: Radar },
      { label: 'StatsBomb', labelKey: 'nav.statsbomb', to: '/statsbomb', icon: Database },
      { label: 'Simulación IA', labelKey: 'nav.simulacion', to: '/simulacion', icon: Gamepad2 },
    ],
  },
  {
    section: 'Operaciones',
    sectionKey: 'nav.section.operaciones',
    items: [
      { label: 'Reportes', labelKey: 'nav.reportes', to: '/reportes', icon: FileBarChart2, comingSoon: true },
      { label: 'Dispositivos', labelKey: 'nav.dispositivos', to: '/dispositivos', icon: Cpu, comingSoon: true },
      { label: 'Integraciones', labelKey: 'nav.integraciones', to: '/integraciones', icon: Plug, comingSoon: true },
      { label: 'Alertas', labelKey: 'nav.alertas', to: '/alertas', icon: Bell },
    ],
  },
  {
    section: 'Cuenta',
    sectionKey: 'nav.section.cuenta',
    items: [
      { label: 'Clientes', labelKey: 'nav.clientes', to: '/clientes', icon: Building2, comingSoon: true },
      { label: 'Administración', labelKey: 'nav.administracion', to: '/administracion', icon: ShieldCheck },
      { label: 'Configuración', labelKey: 'nav.configuracion', to: '/configuracion', icon: Settings },
    ],
  },
];

export const NAV_ITEMS_FLAT: NavItem[] = NAV_SECTIONS.flatMap((group) => group.items);
