import * as React from 'react';

import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'focus-ring flex h-9 w-full rounded-md border bg-panel px-3 text-sm text-foreground placeholder:text-muted-foreground/70',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-border hover:border-border/80',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'focus-ring flex min-h-20 w-full rounded-md border bg-panel px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-danger' : 'border-border hover:border-border/80',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
