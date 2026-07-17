import * as React from 'react';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface CommandPaletteGroup {
  heading: string;
  items: {
    id: string;
    label: string;
    hint?: string;
    icon?: React.ComponentType<{ className?: string }>;
    onSelect: () => void;
  }[];
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandPaletteGroup[];
  placeholder?: string;
}

export function CommandPalette({ open, onOpenChange, groups, placeholder = 'Buscar módulos, atletas, equipos…' }: CommandPaletteProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="animate-fade-in fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="animate-slide-up glass fixed left-1/2 top-24 z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border shadow-elevated focus:outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Buscador inteligente</DialogPrimitive.Title>
          <Command
            className="flex flex-col"
            filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" aria-hidden="true" />
              <Command.Input
                autoFocus
                placeholder={placeholder}
                className="focus-ring h-12 w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                Sin resultados.
              </Command.Empty>
              {groups.map((group) => (
                <Command.Group
                  key={group.heading}
                  heading={group.heading}
                  className={cn(
                    '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
                    '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold',
                    '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide',
                    '[&_[cmdk-group-heading]]:text-muted-foreground',
                  )}
                >
                  {group.items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      onSelect={() => {
                        item.onSelect();
                        onOpenChange(false);
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground',
                        'data-[selected=true]:bg-ai/10 data-[selected=true]:text-ai',
                      )}
                    >
                      {item.icon && <item.icon className="size-4" />}
                      <span className="flex-1">{item.label}</span>
                      {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
