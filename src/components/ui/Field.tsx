import * as React from 'react';

import { cn } from '@/utils/cn';
import { Label } from './Label';

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export function Field({ label, htmlFor, hint, error, required, className, children, ...props }: FieldProps) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;

  return (
    <div className={cn('mb-4', className)} {...props}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </Label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<any>, {
            'aria-describedby': cn(hint && hintId, error && errorId) || undefined,
            invalid: Boolean(error),
          })
        : children}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
