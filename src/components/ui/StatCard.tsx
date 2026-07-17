import type { ComponentType, ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { cn } from '@/utils/cn';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  accent?: 'ai' | 'purple' | 'success' | 'warning' | 'danger';
  trend?: { value: number; label?: string };
  isLoading?: boolean;
  className?: string;
}

const ACCENT_CLASS: Record<NonNullable<StatCardProps['accent']>, string> = {
  ai: 'bg-ai/10 text-ai',
  purple: 'bg-purple/10 text-purple',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function StatCard({ label, value, icon: Icon, accent = 'ai', trend, isLoading, className }: StatCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-16" />
        <Skeleton className="mt-3 h-3 w-20" />
      </Card>
    );
  }

  const TrendIcon = trend ? (trend.value > 0 ? TrendingUp : trend.value < 0 ? TrendingDown : Minus) : null;
  const trendColor = trend
    ? trend.value > 0
      ? 'text-success'
      : trend.value < 0
        ? 'text-danger'
        : 'text-muted-foreground'
    : '';

  return (
    <Card interactive className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex size-8 items-center justify-center rounded-md', ACCENT_CLASS[accent])}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {trend && TrendIcon && (
        <p className={cn('flex items-center gap-1 text-xs font-medium', trendColor)}>
          <TrendIcon className="size-3.5" aria-hidden="true" />
          {trend.value > 0 ? '+' : ''}
          {trend.value}%{trend.label && <span className="font-normal text-muted-foreground">{trend.label}</span>}
        </p>
      )}
    </Card>
  );
}
