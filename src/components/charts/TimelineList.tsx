import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export interface TimelineItem {
  id: string;
  title: ReactNode;
  timestamp: string;
  description?: ReactNode;
  accent?: 'ai' | 'purple' | 'success' | 'warning' | 'danger';
}

const DOT_CLASS: Record<NonNullable<TimelineItem['accent']>, string> = {
  ai: 'bg-ai',
  purple: 'bg-purple',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function TimelineList({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative space-y-5 border-l border-border pl-5">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn('absolute -left-[26px] top-1 size-2.5 rounded-full ring-4 ring-card', DOT_CLASS[item.accent ?? 'ai'])}
            aria-hidden="true"
          />
          <p className="text-sm font-medium text-foreground">{item.title}</p>
          {item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}
          <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground/70">{item.timestamp}</p>
        </li>
      ))}
    </ol>
  );
}
