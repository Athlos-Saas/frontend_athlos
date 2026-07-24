import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronDown, Globe, HeartPulse, LogOut, Menu, Moon, Search, Settings, Sun, User } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip';
import { supabase } from '@/lib/supabase';
import { useUiStore } from '@/store/uiStore';

export interface HeaderProfile {
  full_name?: string | null;
  role?: string | null;
  org_id?: string | null;
}

export interface HeaderProps {
  profile: HeaderProfile;
  onSignOut: () => void;
  onOpenMobileNav: () => void;
}

const SPORT_LABEL: Record<string, string> = {
  soccer: 'Fútbol',
  basketball: 'Baloncesto',
  rugby: 'Rugby',
};

const ALERT_WINDOW_DAYS = 14;

interface HeaderNotification {
  id: string;
  kind: 'injury' | 'ml';
  title: string;
  detail: string;
  playerId: string | null;
}

function initials(name?: string | null) {
  if (!name) return 'AT';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AT';
}

export function Header({ profile, onSignOut, onOpenMobileNav }: HeaderProps) {
  const navigate = useNavigate();
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const season = useUiStore((state) => state.season);
  const setSeason = useUiStore((state) => state.setSeason);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const [seasons, setSeasons] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);

  const orgId = profile.org_id;

  // Temporadas y deportes REALES de la organización (teams + datos de liga).
  useEffect(() => {
    if (!orgId) return;
    Promise.all([
      supabase.from('teams').select('season, sport').eq('org_id', orgId),
      supabase.from('league_attacker_stats').select('season').eq('org_id', orgId),
    ]).then(([teamsRes, leagueRes]) => {
      const teamRows = teamsRes.data ?? [];
      const seasonSet = new Set<string>();
      for (const row of teamRows) if (row.season) seasonSet.add(row.season);
      for (const row of leagueRes.data ?? []) if (row.season) seasonSet.add(row.season);
      const sorted = [...seasonSet].sort().reverse();
      setSeasons(sorted);
      setSports([...new Set(teamRows.map((row) => row.sport).filter(Boolean))] as string[]);
    });
  }, [orgId]);

  // Si no hay temporada elegida (o la guardada ya no existe), usar la más reciente.
  useEffect(() => {
    if (seasons.length === 0) return;
    if (!season || !seasons.includes(season)) setSeason(seasons[0]);
  }, [seasons, season, setSeason]);

  // Notificaciones reales: lesiones activas + alertas ML recientes.
  useEffect(() => {
    if (!orgId) return;
    const since = new Date(Date.now() - ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      supabase.from('injuries').select('id, player_id, severity').eq('org_id', orgId).is('return_date', null),
      supabase
        .from('ml_predictions')
        .select('id, player_id, prediction_type, label, created_at')
        .eq('org_id', orgId)
        .in('prediction_type', ['fatigue_risk', 'player_load_expected'])
        .in('label', ['alto', 'sobre_esfuerzo'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(async ([injuriesRes, alertsRes]) => {
      const injuries = injuriesRes.data ?? [];
      const alerts = alertsRes.data ?? [];
      const playerIds = [...new Set([...injuries.map((i) => i.player_id), ...alerts.map((a) => a.player_id)].filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (playerIds.length > 0) {
        const { data: players } = await supabase.from('players').select('id, full_name').in('id', playerIds);
        for (const player of players ?? []) names.set(player.id, player.full_name);
      }
      setNotifications([
        ...injuries.map((injury) => ({
          id: `injury-${injury.id}`,
          kind: 'injury' as const,
          title: names.get(injury.player_id) ?? 'Jugador',
          detail: `Lesión activa (${injury.severity})`,
          playerId: injury.player_id,
        })),
        ...alerts.map((alert) => ({
          id: `ml-${alert.id}`,
          kind: 'ml' as const,
          title: alert.player_id ? names.get(alert.player_id) ?? 'Jugador' : 'Plantel',
          detail: alert.prediction_type === 'fatigue_risk' ? 'Riesgo de fatiga alto' : 'Sobre-esfuerzo detectado',
          playerId: alert.player_id,
        })),
      ]);
    });
  }, [orgId]);

  const notificationCount = notifications.length;
  const visibleNotifications = useMemo(() => notifications.slice(0, 6), [notifications]);

  return (
    <header className="glass sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border px-4 sm:gap-3 sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Abrir menú de navegación"
        className="focus-ring flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-panel hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        aria-label="Buscar módulos, atletas, equipos"
        className="focus-ring flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-panel px-3 text-left text-sm text-muted-foreground transition-colors hover:border-ai/30 hover:text-foreground"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 truncate sm:block">Buscar módulos, atletas, equipos…</span>
        <kbd className="hidden rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {seasons.length > 0 && (
          <Select value={season ?? seasons[0]} onValueChange={setSeason}>
            <SelectTrigger aria-label="Temporada" className="hidden h-9 w-[92px] md:flex">
              <SelectValue placeholder="Temporada" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((seasonOption) => (
                <SelectItem key={seasonOption} value={seasonOption}>
                  {seasonOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {sports.length > 0 && (
          <Select defaultValue={sports[0]}>
            <SelectTrigger aria-label="Deporte" className="hidden h-9 w-[130px] md:flex">
              <SelectValue placeholder="Deporte" />
            </SelectTrigger>
            <SelectContent>
              {sports.map((sport) => (
                <SelectItem key={sport} value={sport}>
                  {SPORT_LABEL[sport] ?? sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="mx-1 hidden h-6 w-px bg-border md:block" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={notificationCount > 0 ? `${notificationCount} notificaciones` : 'Notificaciones'}
              className="focus-ring relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel hover:text-foreground"
            >
              <Bell className="size-4" aria-hidden="true" />
              {notificationCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold leading-4 text-white animate-pulse-glow">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleNotifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                Sin lesiones activas ni alertas recientes de los modelos.
              </div>
            ) : (
              <>
                {visibleNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onSelect={() => (notification.playerId ? navigate(`/atletas/${notification.playerId}`) : navigate('/alertas'))}
                  >
                    {notification.kind === 'injury' ? (
                      <HeartPulse className="size-4 shrink-0 text-danger" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{notification.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{notification.detail}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/alertas')} className="justify-center text-ai">
                  Ver todas las alertas
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="focus-ring hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel hover:text-foreground sm:flex"
            >
              {theme === 'dark' ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Idioma (Español)"
              disabled
              className="focus-ring hidden size-9 items-center justify-center rounded-md text-muted-foreground opacity-50 sm:flex"
            >
              <Globe className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Español — más idiomas próximamente</TooltipContent>
        </Tooltip>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="focus-ring flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-panel"
            >
              <Avatar>
                <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold text-foreground">{profile.full_name || 'Usuario'}</span>
                <span className="block text-[10px] text-muted-foreground">{profile.role || 'Miembro'}</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2 normal-case tracking-normal text-foreground">
              <Badge variant="ai">{profile.role || 'Miembro'}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/configuracion')}>
              <User className="size-4" aria-hidden="true" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/configuracion')}>
              <Settings className="size-4" aria-hidden="true" /> Configuración
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onSignOut}>
              <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
