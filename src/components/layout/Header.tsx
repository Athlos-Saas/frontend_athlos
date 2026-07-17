import { Bell, ChevronDown, Globe, LogOut, Moon, Search, Settings, User } from 'lucide-react';

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
import { useUiStore } from '@/store/uiStore';

export interface HeaderProfile {
  full_name?: string | null;
  role?: string | null;
}

export interface HeaderProps {
  profile: HeaderProfile;
  onSignOut: () => void;
}

const SEASONS = ['2026', '2025', '2024'];
const SPORTS = ['Fútbol', 'Baloncesto', 'Rugby'];

function initials(name?: string | null) {
  if (!name) return 'AT';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'AT';
}

export function Header({ profile, onSignOut }: HeaderProps) {
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);

  return (
    <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border px-6">
      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="focus-ring flex h-9 w-full max-w-sm items-center gap-2 rounded-md border border-border bg-panel px-3 text-left text-sm text-muted-foreground transition-colors hover:border-ai/30 hover:text-foreground"
      >
        <Search className="size-4" aria-hidden="true" />
        <span className="flex-1 truncate">Buscar módulos, atletas, equipos…</span>
        <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Select defaultValue={SEASONS[0]}>
          <SelectTrigger aria-label="Temporada" className="h-9 w-[92px]">
            <SelectValue placeholder="Temporada" />
          </SelectTrigger>
          <SelectContent>
            {SEASONS.map((season) => (
              <SelectItem key={season} value={season}>
                {season}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue={SPORTS[0]}>
          <SelectTrigger aria-label="Deporte" className="h-9 w-[130px]">
            <SelectValue placeholder="Deporte" />
          </SelectTrigger>
          <SelectContent>
            {SPORTS.map((sport) => (
              <SelectItem key={sport} value={sport}>
                {sport}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Notificaciones"
              className="focus-ring relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-panel hover:text-foreground"
            >
              <Bell className="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
              Sin notificaciones nuevas.
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Tema (modo claro próximamente)"
              disabled
              className="focus-ring flex size-9 items-center justify-center rounded-md text-muted-foreground opacity-50"
            >
              <Moon className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Modo claro — próximamente</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Idioma (Español)"
              disabled
              className="focus-ring flex size-9 items-center justify-center rounded-md text-muted-foreground opacity-50"
            >
              <Globe className="size-4" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Español — más idiomas próximamente</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

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
            <DropdownMenuItem>
              <User className="size-4" aria-hidden="true" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem>
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
