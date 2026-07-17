import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import { CalendarDays } from 'lucide-react';
import 'react-day-picker/style.css';

import { cn } from '@/utils/cn';
import { Button } from './Button';

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, placeholder = 'Selecciona una fecha', className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant="secondary"
          className={cn('w-full justify-start gap-2 font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          {value ? value.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : placeholder}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="animate-fade-in z-50 rounded-lg border border-border bg-panel p-3 shadow-elevated [--rdp-accent-color:var(--color-ai)] [--rdp-today-color:var(--color-ai)]"
        >
          <DayPicker
            mode="single"
            locale={es}
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
            className="text-foreground"
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
