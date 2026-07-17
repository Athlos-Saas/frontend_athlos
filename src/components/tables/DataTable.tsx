import { useMemo, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeletonRows,
} from '@/components/ui/Table';
import { cn } from '@/utils/cn';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export interface DataTableFilter<T> {
  columnId: string;
  label: string;
  options: string[];
  accessor: (row: T) => string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  searchable?: boolean;
  pageSize?: number;
  exportFileName?: string;
  rowActions?: (row: T) => ReactNode;
  filters?: DataTableFilter<T>[];
  emptyState?: ReactNode;
}

type SortDirection = 'asc' | 'desc' | false;

function toCsvValue(value: unknown) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(toCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  searchPlaceholder = 'Buscar…',
  searchable = true,
  pageSize = 10,
  exportFileName,
  rowActions,
  filters,
  emptyState,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ columnId: string; direction: SortDirection }>({ columnId: '', direction: false });
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = data;

    if (filters) {
      for (const filter of filters) {
        const value = activeFilters[filter.columnId];
        if (value) rows = rows.filter((row) => filter.accessor(row) === value);
      }
    }

    if (searchable && search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter((row) =>
        columns.some((column) => String(column.accessor(row) ?? '').toLowerCase().includes(needle)),
      );
    }

    return rows;
  }, [data, filters, activeFilters, search, searchable, columns]);

  const sorted = useMemo(() => {
    if (!sort.direction || !sort.columnId) return filtered;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column) return filtered;

    return [...filtered].sort((a, b) => {
      const av = column.accessor(a);
      const bv = column.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(columnId: string) {
    setSort((previous) => {
      if (previous.columnId !== columnId) return { columnId, direction: 'asc' };
      if (previous.direction === 'asc') return { columnId, direction: 'desc' };
      return { columnId: '', direction: false };
    });
  }

  function handleExport() {
    if (!exportFileName) return;
    const header = columns.map((column) => column.header);
    const rows = sorted.map((row) => columns.map((column) => String(column.accessor(row) ?? '')));
    downloadCsv(exportFileName, [header, ...rows]);
  }

  const hasToolbar = searchable || (filters && filters.length > 0) || exportFileName;

  return (
    <div>
      {hasToolbar && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {searchable && (
            <SearchInput
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="max-w-xs"
            />
          )}
          {filters?.map((filter) => (
            <Select
              key={filter.columnId}
              value={activeFilters[filter.columnId] ?? ''}
              onValueChange={(value) => {
                setActiveFilters((previous) => ({ ...previous, [filter.columnId]: value }));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
          {exportFileName && (
            <Button variant="secondary" size="sm" className="ml-auto" onClick={handleExport}>
              <Download className="size-4" aria-hidden="true" /> Exportar CSV
            </Button>
          )}
        </div>
      )}

      {!isLoading && sorted.length === 0 ? (
        emptyState
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    sortable={column.sortable}
                    sortDirection={sort.columnId === column.id ? sort.direction : false}
                    onClick={column.sortable ? () => toggleSort(column.id) : undefined}
                    className={cn(column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}
                  >
                    {column.header}
                  </TableHead>
                ))}
                {rowActions && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeletonRows columns={columns.length + (rowActions ? 1 : 0)} />
              ) : (
                pageRows.map((row) => (
                  <TableRow key={getRowId(row)}>
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn(column.align === 'right' && 'text-right', column.align === 'center' && 'text-center', column.className)}
                      >
                        {column.cell ? column.cell(row) : String(column.accessor(row) ?? '—')}
                      </TableCell>
                    ))}
                    {rowActions && <TableCell className="text-right">{rowActions(row)}</TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {!isLoading && sorted.length > pageSize && (
            <Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
          )}
        </>
      )}
    </div>
  );
}
