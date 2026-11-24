import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/utils/cn';

const buttonVariants = cva(
  'focus-ring inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-ai text-white shadow-subtle hover:bg-ai/90 active:bg-ai/80',
        secondary:
          'border border-border bg-panel text-foreground hover:bg-card active:bg-card/80',
        ghost: 'text-muted-foreground hover:bg-panel hover:text-foreground',
        danger: 'bg-danger text-white shadow-subtle hover:bg-danger/90 active:bg-danger/80',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9 shrink-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      // Slot de Radix exige EXACTAMENTE un hijo elemento. El `{isLoading && …}`
      // de abajo deja un `false` como hermano y React.Children.count lo cuenta:
      // Slot lanzaba "Slot failed to slot onto its children" y el
      // ModuleErrorBoundary tumbaba la página entera. Pasó en /reportes justo
      // después de generar un PDF (2026-11-24): el reporte se generaba bien y
      // el botón "Descargar" rompía el módulo. Con asChild el hijo pinta su
      // propio contenido, así que aquí no hay spinner.
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          aria-busy={isLoading || undefined}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
