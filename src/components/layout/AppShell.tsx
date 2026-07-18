import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { CommandPalette } from '@/components/ui/CommandPalette';
import { Drawer, DrawerContent } from '@/components/ui/Drawer';
import { Toaster } from '@/components/ui/Toast';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { NAV_SECTIONS } from '@/constants/navigation';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

import { Header, type HeaderProfile } from './Header';
import { Sidebar, SidebarNavContent } from './Sidebar';

export interface AppShellProps {
  profile: HeaderProfile;
  onSignOut: () => void;
}

export function AppShell({ profile, onSignOut }: AppShellProps) {
  const isCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isCommandPaletteOpen = useUiStore((state) => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(!useUiStore.getState().isCommandPaletteOpen);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen]);

  const commandGroups = useMemo(
    () =>
      NAV_SECTIONS.map((group) => ({
        heading: group.section,
        items: group.items.map((item) => ({
          id: item.to,
          label: item.label,
          icon: item.icon,
          onSelect: () => navigate(item.to),
        })),
      })),
    [navigate],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <a
        href="#main-content"
        className="focus-ring fixed left-3 top-3 z-50 -translate-y-16 rounded-md bg-ai px-4 py-2 text-sm font-medium text-white transition-transform focus:translate-y-0"
      >
        Saltar al contenido principal
      </a>
      <div className="min-h-screen bg-bg">
        <Sidebar />
        <div
          className={cn(
            'flex min-h-screen flex-col transition-[margin] duration-200',
            isCollapsed ? 'lg:ml-[76px]' : 'lg:ml-64',
          )}
        >
          <Header profile={profile} onSignOut={onSignOut} onOpenMobileNav={() => setIsMobileNavOpen(true)} />
          <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <Drawer open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <DrawerContent side="left" className="w-72 p-0 lg:hidden">
          <div className="flex h-full flex-col">
            <SidebarNavContent isCollapsed={false} onNavigate={() => setIsMobileNavOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>

      <CommandPalette open={isCommandPaletteOpen} onOpenChange={setCommandPaletteOpen} groups={commandGroups} />
      <Toaster />
    </TooltipProvider>
  );
}
