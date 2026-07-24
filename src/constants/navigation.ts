import {
  Activity,
  Bell,
  BrainCircuit,
  Building2,
  CalendarRange,
  Cpu,
  FileBarChart2,
  LayoutDashboard,
  Plug,
  Radar,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Módulos sin backend propio todavía — Fase 1 de la auditoría los marcó como pendientes de datos reales. */
  comingSoon?: boolean;
}

export interface NavSection {
  section: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    section: 'General',
    items: [{ label: 'Dashboard', to: '/', icon: LayoutDashboard }],
  },
  {
    section: 'Rendimiento',
    items: [
      { label: 'Análisis', to: '/analisis', icon: Activity },
      { label: 'Atletas', to: '/atletas', icon: UserRound },
      { label: 'Equipos', to: '/equipos', icon: Shield },
      { label: 'Competiciones', to: '/competiciones', icon: Trophy },
      { label: 'Temporadas', to: '/temporadas', icon: CalendarRange },
    ],
  },
  {
    section: 'Inteligencia artificial',
    items: [
      { label: 'AI Intelligence Center', to: '/ai', icon: Sparkles },
      { label: 'Pronósticos IA', to: '/pronosticos', icon: BrainCircuit },
      { label: 'Modelos IA', to: '/modelos', icon: BrainCircuit },
      { label: 'Scouting', to: '/scouting', icon: Radar },
    ],
  },
  {
    section: 'Operaciones',
    items: [
      { label: 'Reportes', to: '/reportes', icon: FileBarChart2, comingSoon: true },
      { label: 'Dispositivos', to: '/dispositivos', icon: Cpu, comingSoon: true },
      { label: 'Integraciones', to: '/integraciones', icon: Plug, comingSoon: true },
      { label: 'Alertas', to: '/alertas', icon: Bell },
    ],
  },
  {
    section: 'Cuenta',
    items: [
      { label: 'Clientes', to: '/clientes', icon: Building2, comingSoon: true },
      { label: 'Usuarios', to: '/usuarios', icon: Users },
      { label: 'Configuración', to: '/configuracion', icon: Settings },
    ],
  },
];

export const NAV_ITEMS_FLAT: NavItem[] = NAV_SECTIONS.flatMap((group) => group.items);
