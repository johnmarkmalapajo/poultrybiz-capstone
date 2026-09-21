import { useState } from "react";

// useTableSort — generic sortable-column behavior for any table.
// Clicking a column cycles: default -> ascending -> descending -> default.
// No separate "Sort" button; the header itself is the control.
//
// Usage:
//   const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
//   const rows = sortData(filteredRows, (row, col) => row[col]);
//   <th onClick={() => cycleSort("title")}>{sortIndicator("title", sortColumn, sortDirection)} Title</th>
export function useTableSort() {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState(null); // "asc" | "desc" | null

  const cycleSort = (column) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
    } else if (sortDirection === "asc") {
      setSortDirection("desc");
    } else if (sortDirection === "desc") {
      setSortColumn(null);
      setSortDirection(null);
    } else {
      setSortDirection("asc");
    }
  };

  // accessor(row, column) -> the comparable value for that row/column.
  // Never mutates the input array. Never drops rows — only reorders them,
  // so it's always safe to apply after search/filter without losing data.
  const sortData = (data, accessor) => {
    if (!sortColumn || !sortDirection || !data?.length) return data || [];
    const copy = [...data];
    copy.sort((a, b) => {
      const av = accessor(a, sortColumn);
      const bv = accessor(b, sortColumn);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return copy;
  };

  return { sortColumn, sortDirection, cycleSort, sortData };
}

// Small text indicator for a sortable header — "" (not sorted), "▲" (asc),
// "▼" (desc). Kept as plain text (not an icon component) so it's trivial
// to drop into any existing <th> without a new dependency.
export function sortIndicator(column, sortColumn, sortDirection) {
  if (column !== sortColumn) return "";
  return sortDirection === "asc" ? " ▲" : sortDirection === "desc" ? " ▼" : "";
}