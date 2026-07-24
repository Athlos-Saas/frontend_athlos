import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  /** Agrega una primera columna "#" con el número de fila (1, 2, 3...), respetando orden/filtro/paginación. */
  showRowNumber?: boolean;
  /** Si se pasa, persiste búsqueda/filtros/orden/página en sessionStorage y los restaura al volver a montar (ej. al navegar a un detalle y regresar). */
  persistKey?: string;
}

type SortDirection = 'asc' | 'desc' | false;

interface PersistedTableState {
  search: string;
  activeFilters: Record<string, string>;
  sort: { columnId: string; direction: SortDirection };
  page: number;
}

function loadPersistedState(persistKey: string | undefined): Partial<PersistedTableState> {
  if (!persistKey) return {};
  try {
    const raw = sessionStorage.getItem(`datatable:${persistKey}`);
    return raw ? (JSON.parse(raw) as Partial<PersistedTableState>) : {};
  } catch {
    return {};
  }
}

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

function downloadXlsx(filename: string, rows: string[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Datos');
  XLSX.writeFile(workbook, filename);
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
  showRowNumber,
  persistKey,
}: DataTableProps<T>) {
  const [initial] = useState(() => loadPersistedState(persistKey));
  const [search, setSearch] = useState(initial.search ?? '');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>(initial.activeFilters ?? {});
  const [sort, setSort] = useState<{ columnId: string; direction: SortDirection }>(
    initial.sort ?? { columnId: '', direction: false },
  );
  const [page, setPage] = useState(initial.page ?? 1);

  useEffect(() => {
    if (!persistKey) return;
    try {
      sessionStorage.setItem(`datatable:${persistKey}`, JSON.stringify({ search, activeFilters, sort, page }));
    } catch {
      // sessionStorage puede fallar en modo privado; no es crítico, solo se pierde la persistencia.
    }
  }, [persistKey, search, activeFilters, sort, page]);

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

  function exportRows(): string[][] {
    const header = columns.map((column) => column.header);
    const rows = sorted.map((row) => columns.map((column) => String(column.accessor(row) ?? '')));
    return [header, ...rows];
  }

  function handleExportCsv() {
    if (!exportFileName) return;
    downloadCsv(exportFileName, exportRows());
  }

  function handleExportXlsx() {
    if (!exportFileName) return;
    downloadXlsx(exportFileName.replace(/\.csv$/i, '.xlsx'), exportRows());
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
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleExportCsv}>
                <Download className="size-4" aria-hidden="true" /> Exportar CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={handleExportXlsx}>
                <FileSpreadsheet className="size-4" aria-hidden="true" /> Exportar Excel
              </Button>
            </div>
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
                {showRowNumber && <TableHead className="w-10">#</TableHead>}
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
                <TableSkeletonRows columns={columns.length + (rowActions ? 1 : 0) + (showRowNumber ? 1 : 0)} />
              ) : (
                pageRows.map((row, index) => (
                  <TableRow key={getRowId(row)}>
                    {showRowNumber && (
                      <TableCell className="text-muted-foreground">{(currentPage - 1) * pageSize + index + 1}</TableCell>
                    )}
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
