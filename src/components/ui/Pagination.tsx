import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/utils/cn';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

function pageWindow(page: number, pageCount: number) {
  const span = 1;
  const start = Math.max(1, page - span);
  const end = Math.min(pageCount, page + span);
  const pages: number[] = [];
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;
  const pages = pageWindow(page, pageCount);

  return (
    <nav aria-label="Paginación" className={cn('flex items-center justify-between gap-4', className)}>
      <p className="text-xs text-muted-foreground">
        Página <span className="font-medium text-foreground">{page}</span> de {pageCount}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>

        {pages[0] > 1 && (
          <>
            <PageButton value={1} active={page === 1} onClick={onPageChange} />
            {pages[0] > 2 && <span className="px-1 text-muted-foreground">…</span>}
          </>
        )}

        {pages.map((p) => (
          <PageButton key={p} value={p} active={p === page} onClick={onPageChange} />
        ))}

        {pages[pages.length - 1] < pageCount && (
          <>
            {pages[pages.length - 1] < pageCount - 1 && <span className="px-1 text-muted-foreground">…</span>}
            <PageButton value={pageCount} active={page === pageCount} onClick={onPageChange} />
          </>
        )}

        <Button
          variant="ghost"
          size="icon"
          aria-label="Página siguiente"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

function PageButton({ value, active, onClick }: { value: number; active: boolean; onClick: (page: number) => void }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={() => onClick(value)}
      className={cn(
        'focus-ring flex size-8 items-center justify-center rounded-md text-xs font-medium transition-colors',
        active ? 'bg-ai text-white' : 'text-muted-foreground hover:bg-panel hover:text-foreground',
      )}
    >
      {value}
    </button>
  );
}
