import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

import { cn } from '@/utils/cn';
import { NAV_SECTIONS } from '@/constants/navigation';
import { useUiStore } from '@/store/uiStore';

export function Sidebar() {
  const isCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <aside
      aria-label="Barra lateral"
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-panel transition-[width] duration-200',
        isCollapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      <div className={cn('flex h-16 shrink-0 items-center gap-2 border-b border-border px-5', isCollapsed && 'justify-center px-0')}>
        <span className="relative flex size-8 shrink-0 items-center justify-center rounded-md bg-ai/15">
          <span className="size-2 rounded-full bg-ai shadow-[0_0_12px_2px_rgba(59,130,246,0.6)]" />
        </span>
        {!isCollapsed && (
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-wide text-foreground">ATLOS</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sport Intelligence</p>
          </div>
        )}
      </div>

      <nav id="main-navigation" aria-label="Navegación principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((group) => (
          <div key={group.section}>
            {!isCollapsed && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    title={isCollapsed ? item.label : undefined}
                    aria-label={isCollapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'focus-ring group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                        isCollapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-ai/10 text-ai'
                          : 'text-muted-foreground hover:bg-card hover:text-foreground',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden="true" />
                    {!isCollapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                    {!isCollapsed && item.comingSoon && (
                      <span className="rounded-full bg-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Pronto
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-medium text-muted-foreground hover:bg-card hover:text-foreground"
        >
          {isCollapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
          {!isCollapsed && 'Colapsar'}
        </button>
      </div>
    </aside>
  );
}
