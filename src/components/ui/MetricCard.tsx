import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';
import { Card, CardHeader, CardTitle } from './Card';
import { Badge } from './Badge';
import { Skeleton } from './Skeleton';

export interface MetricCardProps {
  title: string;
  value: ReactNode;
  percentage: number;
  status?: 'success' | 'warning' | 'danger';
  statusLabel?: string;
  description?: string;
  isLoading?: boolean;
  className?: string;
}

const STATUS_BAR: Record<NonNullable<MetricCardProps['status']>, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const STATUS_BADGE: Record<NonNullable<MetricCardProps['status']>, 'success' | 'warning' | 'danger'> = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function MetricCard({
  title,
  value,
  percentage,
  status = 'success',
  statusLabel,
  description,
  isLoading,
  className,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-7 w-14" />
        <Skeleton className="mt-4 h-1.5 w-full" />
      </Card>
    );
  }

  const clamped = Math.min(100, Math.max(0, percentage));

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <CardHeader className="mb-0 items-center">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</CardTitle>
        {statusLabel && <Badge variant={STATUS_BADGE[status]}>{statusLabel}</Badge>}
      </CardHeader>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
        <div
          className={cn('h-full rounded-full transition-all duration-500', STATUS_BAR[status])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </Card>
  );
}
