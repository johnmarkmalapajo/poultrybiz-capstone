// TablePagination.jsx — the ONE shared table + pagination layout for every
// module. Pairs with hooks/usePagination.js, which owns the page and
// rows-per-page state. Each module keeps its own data source, filtering,
// sorting and page-reset logic; nothing here fetches or filters data.
//
// Required structure (rendered DOM):
//
//   <TableSection className="xx-table-wrapper">   section: the module's card,
//                                                  never scrolls
//     <TableScroll>                               div.tp-table-scroll — the ONLY
//       <table>…</table>                          horizontally scrollable element
//     </TableScroll>
//     <TablePagination … />                       footer.tp-pagination-footer
//                                                   └ nav.tp-pagination
//   </TableSection>
//
// TablePagination is a SIBLING of TableScroll, never a descendant of it, so
// swiping the table sideways moves only the columns. The footer is sized by
// the section (the parent content width), never by the table's scroll width.

import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from "react-icons/fi";
import "./TablePagination.css";

const DEFAULT_PAGE_SIZES = [10, 25, 50];

// Windowed page-number list: first and last page, the current page and one
// neighbour on each side, with any gap collapsed into a single "…".
export function getPageWindow(currentPage, totalPages) {
  const delta = 1;
  const range = [];
  const withDots = [];
  let last;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  for (const i of range) {
    if (last) {
      if (i - last === 2) {
        withDots.push(last + 1);
      } else if (i - last > 2) {
        withDots.push("…");
      }
    }
    withDots.push(i);
    last = i;
  }

  return withDots;
}

// The table card. `className` is the module's own card class
// (e.g. "eq-table-wrapper") so each module keeps its look.
export function TableSection({ className = "", children }) {
  return <section className={`tp-table-section ${className}`.trim()}>{children}</section>;
}

// The only horizontally scrollable element: holds the table header and rows.
export function TableScroll({ className = "", children }) {
  return <div className={`tp-table-scroll ${className}`.trim()}>{children}</div>;
}

/**
 * Props:
 *   currentPage       current page (1-based)
 *   totalPages        number of pages
 *   pageSize          rows per page
 *   totalRecords      number of records after filtering
 *   startIndex        index of the first record on this page (0-based)
 *   endIndex          index after the last record on this page
 *   onPageChange      (page) => void
 *   onPageSizeChange  (size) => void — omit to hide the rows-per-page select
 *   pageSizeOptions   optional page sizes (default 10, 25, 50)
 *   itemLabel         optional noun for the summary (default "records")
 *
 * Renders nothing when there are no records, so each module's own empty
 * state shows instead.
 */
export default function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalRecords,
  startIndex,
  endIndex,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  itemLabel = "records",
}) {
  if (!totalRecords) return null;

  const pages = Math.max(1, totalPages);
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= pages;
  const pageNumbers = getPageWindow(currentPage, pages);
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  const goTo = (p) => {
    const next = Math.min(Math.max(1, p), pages);
    if (next !== currentPage) onPageChange(next);
  };

  return (
    <footer className="tp-pagination-footer">
      <nav className="tp-pagination" aria-label="Table pagination">
        <p className="tp-summary" aria-live="polite">
          Showing <strong>{startIndex + 1}–{endIndex}</strong> of{" "}
          <strong>{totalRecords}</strong> {itemLabel}
        </p>

        {onPageSizeChange && (
          <label className="tp-size">
            <span className="tp-size-text">Rows per page</span>
            <select
              className="tp-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {sizes.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>
        )}

        <div className="tp-nav">
          <button
            type="button"
            className="tp-btn tp-btn-icon tp-btn-edge"
            onClick={() => goTo(1)}
            disabled={isFirst}
            aria-label="First page"
            title="First page"
          >
            <FiChevronsLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tp-btn tp-btn-step"
            onClick={() => goTo(currentPage - 1)}
            disabled={isFirst}
            aria-label="Previous page"
            title="Previous page"
          >
            <FiChevronLeft aria-hidden="true" />
            <span className="tp-btn-text">Previous</span>
          </button>

          <ul className="tp-pages">
            {pageNumbers.map((p, i) =>
              p === "…" ? (
                <li key={`dots-${i}`} className="tp-dots" aria-hidden="true">…</li>
              ) : (
                <li key={p}>
                  <button
                    type="button"
                    className={`tp-btn tp-page${p === currentPage ? " is-active" : ""}`}
                    onClick={() => goTo(p)}
                    aria-label={`Page ${p}`}
                    aria-current={p === currentPage ? "page" : undefined}
                  >
                    {p}
                  </button>
                </li>
              )
            )}
          </ul>

          <button
            type="button"
            className="tp-btn tp-btn-step"
            onClick={() => goTo(currentPage + 1)}
            disabled={isLast}
            aria-label="Next page"
            title="Next page"
          >
            <span className="tp-btn-text">Next</span>
            <FiChevronRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tp-btn tp-btn-icon tp-btn-edge"
            onClick={() => goTo(pages)}
            disabled={isLast}
            aria-label="Last page"
            title="Last page"
          >
            <FiChevronsRight aria-hidden="true" />
          </button>
        </div>
      </nav>
    </footer>
  );
}