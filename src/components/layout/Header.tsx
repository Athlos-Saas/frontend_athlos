import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, Bell, ChevronDown, Globe, HeartPulse, LogOut, Menu, Moon, Search, Settings, Sun, User } from 'lucide-react';

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
import { useNavAccessStore } from '@/store/navAccessStore';
import { useNotificationsStore } from '@/store/notificationsStore';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { type SupportedLanguage } from '@/i18n/config';

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = { es: 'Español', en: 'English' };

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
  /** Ruta a la que navega "Ir" — también la clave usada para filtrar por permiso de navegación (mismo mecanismo real que ya oculta ítems del menú lateral, ver NavGate/useNavAccessStore). */
  navKey: '/atletas' | '/alertas';
}

function initials(name?: string | null) {
  if (!name) return 'AT';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AT';
}

export function Header({ profile, onSignOut, onOpenMobileNav }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const season = useUiStore((state) => state.season);
  const setSeason = useUiStore((state) => state.setSeason);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

  const deniedKeys = useNavAccessStore((state) => state.deniedKeys);
  const readIds = useNotificationsStore((state) => state.readIds);
  const markRead = useNotificationsStore((state) => state.markRead);

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
          title: names.get(injury.player_id) ?? t('header.player'),
          detail: t('header.activeInjury', { severity: injury.severity }),
          playerId: injury.player_id,
          navKey: '/atletas' as const,
        })),
        ...alerts.map((alert) => ({
          id: `ml-${alert.id}`,
          kind: 'ml' as const,
          title: alert.player_id ? names.get(alert.player_id) ?? t('header.player') : t('header.squad'),
          detail: alert.prediction_type === 'fatigue_risk' ? t('header.fatigueRisk') : t('header.overload'),
          playerId: alert.player_id,
          navKey: '/alertas' as const,
        })),
      ]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  // Solo se muestran (y cuentan) notificaciones cuyo destino ("Ir") el rol
  // actual puede visitar — mismo mecanismo real que ya oculta ítems del
  // menú lateral (useNavAccessStore/deniedKeys), no un permiso inventado
  // aparte para notificaciones.
  const permittedNotifications = useMemo(
    () => notifications.filter((notification) => !deniedKeys.has(notification.navKey)),
    [notifications, deniedKeys],
  );
  const visibleNotifications = useMemo(() => permittedNotifications.slice(0, 6), [permittedNotifications]);
  const notificationCount = useMemo(
    () => permittedNotifications.filter((notification) => !readIds.includes(notification.id)).length,
    [permittedNotifications, readIds],
  );

  const handleNotificationSelect = (notification: HeaderNotification) => {
    markRead(notification.id);
    navigate(notification.playerId ? `/atletas/${notification.playerId}` : '/alertas');
  };

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
        aria-label={t('header.searchLabel')}
        className="focus-ring flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-panel px-3 text-left text-sm text-muted-foreground transition-colors hover:border-ai/30 hover:text-foreground"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="hidden flex-1 truncate sm:block">{t('header.searchPlaceholder')}</span>
        <kbd className="hidden rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {seasons.length > 0 && (
          <Select value={season ?? seasons[0]} onValueChange={setSeason}>
            <SelectTrigger aria-label={t('header.season')} className="hidden h-9 w-[92px] md:flex">
              <SelectValue placeholder={t('header.season')} />
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
            <SelectTrigger aria-label={t('header.sport')} className="hidden h-9 w-[130px] md:flex">
              <SelectValue placeholder={t('header.sport')} />
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
              aria-label={notificationCount > 0 ? t('header.notificationsCount', { count: notificationCount }) : t('header.notifications')}
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
            <DropdownMenuLabel>{t('header.notifications')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {visibleNotifications.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">{t('header.noNotifications')}</div>
            ) : (
              <>
                {visibleNotifications.map((notification) => {
                  const isRead = readIds.includes(notification.id);
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      onSelect={() => handleNotificationSelect(notification)}
                      className={cn(isRead && 'opacity-60')}
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', isRead ? 'bg-transparent' : 'bg-ai')} aria-hidden="true" />
                      {notification.kind === 'injury' ? (
                        <HeartPulse className={cn('size-4 shrink-0', isRead ? 'text-muted-foreground' : 'text-danger')} aria-hidden="true" />
                      ) : (
                        <AlertTriangle className={cn('size-4 shrink-0', isRead ? 'text-muted-foreground' : 'text-warning')} aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-sm', isRead ? 'text-muted-foreground' : 'font-medium')}>
                          {notification.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">{notification.detail}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-0.5 text-xs font-medium text-ai">
                        {t('header.notificationGoTo', 'Ir')}
                        <ArrowRight className="size-3" aria-hidden="true" />
                      </span>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/alertas')} className="justify-center text-ai">
                  {t('header.viewAllAlerts')}
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
              aria-label={theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
              className="focus-ring hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel hover:text-foreground sm:flex"
            >
              {theme === 'dark' ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>{theme === 'dark' ? t('header.lightMode') : t('header.darkMode')}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('header.language')}
                  className="focus-ring hidden size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel hover:text-foreground sm:flex"
                >
                  <Globe className="size-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{LANGUAGE_LABEL[(i18n.resolvedLanguage as SupportedLanguage) ?? 'es']}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>{t('header.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(Object.keys(LANGUAGE_LABEL) as SupportedLanguage[]).map((lng) => (
              <DropdownMenuItem key={lng} onSelect={() => i18n.changeLanguage(lng)}>
                <span className={cn(i18n.resolvedLanguage === lng && 'font-semibold text-ai')}>{LANGUAGE_LABEL[lng]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

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
                <span className="block text-[10px] text-muted-foreground">{profile.role || t('header.member')}</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex items-center gap-2 normal-case tracking-normal text-foreground">
              <Badge variant="ai">{profile.role || t('header.member')}</Badge>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/configuracion')}>
              <User className="size-4" aria-hidden="true" /> {t('header.myProfile')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate('/configuracion')}>
              <Settings className="size-4" aria-hidden="true" /> {t('header.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onSignOut}>
              <LogOut className="size-4" aria-hidden="true" /> {t('header.signOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
