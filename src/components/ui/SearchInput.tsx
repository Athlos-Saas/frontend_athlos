import * as React from 'react';
import { Search } from 'lucide-react';

import { cn } from '@/utils/cn';

export const SearchInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <input
        ref={ref}
        type="search"
        className={cn(
          'focus-ring h-9 w-full rounded-md border border-border bg-panel pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/70',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = 'SearchInput';
