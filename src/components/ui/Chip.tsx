import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/utils/cn';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  onRemove?: () => void;
  removeLabel?: string;
  active?: boolean;
}

export function Chip({ className, children, onRemove, removeLabel = 'Quitar', active, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-ai/40 bg-ai/10 text-ai'
          : 'border-border bg-panel text-muted-foreground hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="focus-ring -mr-1 rounded-full p-0.5 hover:bg-border/60"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
