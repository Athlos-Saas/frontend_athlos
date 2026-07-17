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
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
