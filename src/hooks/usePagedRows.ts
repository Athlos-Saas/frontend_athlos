import { useMemo, useState } from 'react';

/** Paginación client-side para tablas simples (las que no usan DataTable). */
export function usePagedRows<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [rows, currentPage, pageSize],
  );
  return { paged, page: currentPage, pageCount, setPage };
}
