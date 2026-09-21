import { useState, useEffect } from "react";

// usePagination — generic page/rows-per-page state for any table.
// Auto-navigates to the nearest valid page when filtering/searching
// shrinks the result set below the current page (never shows a blank page).
//
// Usage:
//   const pager = usePagination(filteredRows.length);
//   const pageRows = filteredRows.slice(pager.startIndex, pager.endIndex);
export function usePagination(totalItems, initialRowsPerPage = 10) {
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPageState] = useState(initialRowsPerPage);

  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  // If search/filter/sort shrinks the result set so the current page no
  // longer exists, snap back to the last valid page automatically.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const startIndex = (page - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalItems);

  // Changing rows-per-page always resets to page 1 — otherwise the
  // visible window could jump to an unrelated set of records.
  const setRowsPerPage = (n) => {
    setRowsPerPageState(n);
    setPage(1);
  };

  return { page, setPage, rowsPerPage, setRowsPerPage, totalPages, startIndex, endIndex, totalItems };
}