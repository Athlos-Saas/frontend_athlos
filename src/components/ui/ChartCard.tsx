import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './Card';
import { Skeleton } from './Skeleton';

export interface ChartCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  height?: number;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, actions, footer, isLoading, height = 280, children, className }: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent style={{ height }}>
        {isLoading ? <Skeleton className="h-full w-full" /> : children}
      </CardContent>
      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
