import type { HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-border/50', className)}
      role="presentation"
      {...props}
    />
  );
}
