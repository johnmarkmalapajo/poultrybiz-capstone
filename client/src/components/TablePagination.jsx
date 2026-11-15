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
//
// The shared list-page Filter (FilterPanel, DateFilterFields,
// ActiveFilterChips) also lives here. It is markup only: the state comes from
// useFilterPanel in hooks/usePagination.js, each page still filters its own
// rows, and the look is the Flock Profile filter (fp-filter-* classes).

import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiFilter,
} from "react-icons/fi";
import "./TablePagination.css";
import "../pages/Flockprofile.css";
import { todayKey } from "../hooks/usePagination";
import { useLanguage } from "../i18n/LanguageContext";

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

// ── Filter ───────────────────────────────────────────────────────────────
// <FilterPanel panel={useFilterPanel(...)} title="Filter Users">
//   <DateFilterFields panel={panel} years={…} months={…} label="Date Registered" />
//   <FilterSection label="Filters"> …fp-filter-group selects… </FilterSection>
// </FilterPanel>
// Renders the Filter button (with the applied-filter count) and, while open,
// the dropdown: title, the page's fields, any validation message, and the
// Clear All / Apply footer.
export function FilterPanel({ panel, title, children }) {
  const { t: tr } = useLanguage();
  return (
    <div className="fp-filter-wrap" data-filter-panel={panel.id}>
      <button type="button" className="fp-toolbar-btn" onClick={panel.toggle} aria-expanded={panel.open}>
        <FiFilter />{" "}{tr("Filter")}
        {panel.activeCount > 0 && <span className="fp-filter-count">{panel.activeCount}</span>}
      </button>

      {panel.open && (
        <div className="fp-filter-dropdown" role="dialog" aria-label={tr(title)}>
          <div className="fp-filter-dropdown-header">
            <span>{tr(title)}</span>
          </div>
          {children}
          {panel.error && <span className="pb-field-error" role="alert">{tr(panel.error)}</span>}
          <div className="fp-filter-actions">
            <button type="button" className="fp-filter-clear" onClick={panel.clear}>{tr("Clear All")}</button>
            <button type="button" className="fp-filter-apply" onClick={panel.apply}>{tr("Apply")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// A labelled block of filter fields, laid out two per row (one per row on
// narrow screens).
export function FilterSection({ label, children }) {
  const { t: tr } = useLanguage();
  return (
    <>
      <div className="fp-filter-section-label">{tr(label)}</div>
      <div className="fp-filter-row">{children}</div>
    </>
  );
}

// One labelled select inside a FilterSection. `options` are values or
// { value, label } pairs; `allLabel` is the "no filter" choice ("All").
export function FilterSelect({ panel, field, label, allLabel, options }) {
  const { t: tr } = useLanguage();
  const id = `pb-filter-${field}`;
  return (
    <div className="fp-filter-group">
      <label className="fp-filter-label" htmlFor={id}>{tr(label)}</label>
      <select
        id={id}
        className="fp-filter-select"
        value={panel.draft[field]}
        onChange={(e) => panel.setDraftField(field, e.target.value)}
      >
        <option value="All">{tr(allLabel)}</option>
        {options.map((o) => {
          const value = typeof o === "object" ? o.value : o;
          const text = typeof o === "object" ? o.label : o;
          return <option key={value} value={value}>{tr(text)}</option>;
        })}
      </select>
    </div>
  );
}

// The "Date Filter" section: Date Period (All Records / Today / Week / Month /
// Year / Custom Range) and the pickers the chosen period needs.
export function DateFilterFields({ panel, years = [], months = [], label = "Date Period" }) {
  const { t: tr } = useLanguage();
  const { draft, setDraftField } = panel;
  const today = todayKey();
  return (
    <>
      <div className="fp-filter-section-label">{tr("Date Filter")}</div>
      <div className="fp-filter-row">
        <div className="fp-filter-group">
          <label className="fp-filter-label" htmlFor="pb-filter-period">{tr(label)}</label>
          <select id="pb-filter-period" className="fp-filter-select" value={draft.period}
            onChange={(e) => setDraftField("period", e.target.value)}>
            <option value="all">{tr("All Records")}</option>
            <option value="today">{tr("Today")}</option>
            <option value="week">{tr("Week")}</option>
            <option value="month">{tr("Month")}</option>
            <option value="year">{tr("Year")}</option>
            <option value="custom">{tr("Custom Range")}</option>
          </select>
        </div>

        {draft.period === "week" && (
          <div className="fp-filter-group">
            <label className="fp-filter-label" htmlFor="pb-filter-week">{tr("Week")}</label>
            <input id="pb-filter-week" type="week" className="fp-filter-select fp-filter-input" value={draft.week}
              onChange={(e) => setDraftField("week", e.target.value)} />
          </div>
        )}

        {draft.period === "month" && (
          <div className="fp-filter-group">
            <label className="fp-filter-label" htmlFor="pb-filter-month">{tr("Month")}</label>
            <select id="pb-filter-month" className="fp-filter-select" value={draft.month}
              onChange={(e) => setDraftField("month", e.target.value)}>
              <option value="All">{tr("Select Month")}</option>
              {months.map((m) => <option key={m} value={m}>{tr(m)}</option>)}
            </select>
          </div>
        )}

        {(draft.period === "month" || draft.period === "year") && (
          <div className="fp-filter-group">
            <label className="fp-filter-label" htmlFor="pb-filter-year">{tr("Year")}</label>
            <select id="pb-filter-year" className="fp-filter-select" value={draft.year}
              onChange={(e) => setDraftField("year", e.target.value)}>
              <option value="All">{tr("Select Year")}</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {draft.period === "custom" && (
        <div className="fp-filter-group">
          <label className="fp-filter-label">{tr("Start Date / End Date")}</label>
          <div className="fp-filter-date-range">
            <input type="date" className="fp-filter-select fp-filter-input" value={draft.dateFrom}
              max={draft.dateTo || today} aria-label={tr("From date")}
              onChange={(e) => setDraftField("dateFrom", e.target.value)} />
            <span>{tr("to")}</span>
            <input type="date" className="fp-filter-select fp-filter-input" value={draft.dateTo}
              min={draft.dateFrom || undefined} max={today} aria-label={tr("To date")}
              onChange={(e) => setDraftField("dateTo", e.target.value)} />
          </div>
        </div>
      )}
    </>
  );
}

// Chips for the applied filters, each with ✕ to remove just that filter.
// `chips` = [{ key, label, value }]; key "date" clears the date period.
export function ActiveFilterChips({ panel, chips }) {
  const { t: tr } = useLanguage();
  if (!chips.length) return null;
  return (
    <div className="fp-active-filters">
      {chips.map((c) => (
        <span key={c.key} className="fp-active-filter-tag">
          {tr(c.label)}: {tr(c.value)}
          <button type="button" onClick={() => panel.clearOne(c.key)} aria-label={`${tr("Remove")} ${tr(c.label)}`}>✕</button>
        </span>
      ))}
    </div>
  );
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
  const { t: tr } = useLanguage();
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
      <nav className="tp-pagination" aria-label={tr("Table pagination")}>
        <p className="tp-summary" aria-live="polite">{tr("Showing")}{" "}<strong>{startIndex + 1}–{endIndex}</strong>{" "}{tr("of")}{" "}
          <strong>{totalRecords}</strong> {itemLabel}
        </p>

        {onPageSizeChange && (
          <label className="tp-size">
            <span className="tp-size-text">{tr("Rows per page")}</span>
            <select
              className="tp-size-select"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {sizes.map((size) => (
                <option key={size} value={size}>{tr(size)}</option>
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
            aria-label={tr("First page")}
            title={tr("First page")}
          >
            <FiChevronsLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tp-btn tp-btn-step"
            onClick={() => goTo(currentPage - 1)}
            disabled={isFirst}
            aria-label={tr("Previous page")}
            title={tr("Previous page")}
          >
            <FiChevronLeft aria-hidden="true" />
            <span className="tp-btn-text">{tr("Previous")}</span>
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
            aria-label={tr("Next page")}
            title={tr("Next page")}
          >
            <span className="tp-btn-text">{tr("Next")}</span>
            <FiChevronRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className="tp-btn tp-btn-icon tp-btn-edge"
            onClick={() => goTo(pages)}
            disabled={isLast}
            aria-label={tr("Last page")}
            title={tr("Last page")}
          >
            <FiChevronsRight aria-hidden="true" />
          </button>
        </div>
      </nav>
    </footer>
  );
}