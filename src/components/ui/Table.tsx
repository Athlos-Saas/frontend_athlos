import * as React from 'react';

import { cn } from '@/utils/cn';
import { Skeleton } from './Skeleton';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto rounded-lg border border-border">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('sticky top-0 z-10 bg-panel', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-panel/60', className)} {...props} />;
}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | false;
}

export function TableHead({ className, sortable, sortDirection, children, ...props }: TableHeadProps) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        sortable && 'cursor-pointer select-none hover:text-foreground',
        className,
      )}
      aria-sort={sortDirection ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortable && (
          <span className="text-[10px] leading-none text-muted-foreground/60">
            {sortDirection === 'asc' ? '▲' : sortDirection === 'desc' ? '▼' : '↕'}
          </span>
        )}
      </span>
    </th>
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 text-foreground', className)} {...props} />;
}

export function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={cn('mt-3 text-xs text-muted-foreground', className)} {...props} />;
}

export function TableSkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        // eslint-disable-next-line react/no-array-index-key
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
