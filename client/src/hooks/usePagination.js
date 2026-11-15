import { useState, useEffect, useRef, useId } from "react";
import { useSearchParams } from "react-router-dom";

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
// ── Opening a record from a notification ─────────────────────────────────
//
// useRecordFocus — the ONE implementation every list page uses when a
// notification's View links to it with ?record=<database id> (or another
// URL parameter, e.g. ?task=<id> on the To Do pages). Generalized from the
// Quarantine page's original behavior:
//   1. waits until the page's data has loaded (`ready`);
//   2. if the record is hidden by the current tab / search / filters, calls
//      `reveal(record)` once so the page can show it (switch tab, clear the
//      search and filters) -- found in `allRows`, the page's unfiltered data;
//   3. moves the pager to the page that holds the row;
//   4. scrolls the row into view and highlights it (class
//      "pb-row-highlight", see index.css) for a few seconds.
// Rows are matched by their database id, never by display values.
//
// Usage (in the row):  <tr {...focus.rowProps(r._id)}>
//   or, to keep the row's own classes:  <tr {...focus.rowProps(r._id, "is-done")}>
export const RECORD_HIGHLIGHT_MS = 4000;
export const recordRowId = (id) => `pb-record-${id}`;

export function useRecordFocus({
  rows,
  allRows = rows,
  pager = null,
  ready = true,
  reveal = null,
  getId = (r) => r?._id,
  param = "record",
}) {
  const [searchParams] = useSearchParams();
  const [targetId, setTargetId] = useState(() => searchParams.get(param) || null);
  const doneRef = useRef(false);
  const revealedRef = useRef(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Runs after every render until the row has been shown: the data, the
  // filters and the page can all change in between.
  useEffect(() => {
    if (!targetId || !ready || doneRef.current) return;
    const same = (r) => String(getId(r)) === String(targetId);

    const index = rows.findIndex(same);
    if (index === -1) {
      // Not in the data (yet): the list may still be loading, so keep
      // waiting. A record that was deleted / archived simply never shows,
      // and nothing is highlighted.
      const record = allRows.find(same);
      if (!record) return;
      if (reveal && !revealedRef.current) {
        revealedRef.current = true;
        reveal(record);
      }
      return;
    }

    if (pager) {
      const page = Math.floor(index / pager.rowsPerPage) + 1;
      if (pager.page !== page) {
        pager.setPage(page);
        return;
      }
    }

    const row = document.getElementById(recordRowId(targetId));
    if (!row) return;
    doneRef.current = true;
    row.scrollIntoView({ behavior: "smooth", block: "center" });
    timerRef.current = setTimeout(() => setTargetId(null), RECORD_HIGHLIGHT_MS);
  });

  const isTarget = (id) => targetId != null && String(id) === String(targetId);
  return {
    targetId,
    isTarget,
    // For a table row (default) or any other element, e.g. a stock card:
    //   rowProps(feedType, "fi-stat-card", "pb-card-highlight")
    rowProps: (id, className = "", highlightClass = "pb-row-highlight") => ({
      id: recordRowId(id),
      className: [className, isTarget(id) ? highlightClass : ""].filter(Boolean).join(" ") || undefined,
    }),
  };
}

// ── Filter panel (Flock Profile design) ──────────────────────────────────
//
// useFilterPanel — the shared state behind a list page's Filter button and
// its dropdown (markup: <FilterPanel> / <DateFilterFields> in
// components/TablePagination.jsx, styles: fp-filter-* in Flockprofile.css).
// Same interaction as the Flock Profile filter:
//   • the panel edits a DRAFT; the table only changes on Apply;
//   • opening the panel starts the draft from the applied filters;
//   • Clear All resets both the draft and the applied filters (default view);
//   • a click outside the panel closes it without applying.
// `defaults` must hold every filter key with its "no filter" value
// ("All" for selects, "" for inputs) plus the date keys of DATE_FILTER_DEFAULTS
// when the page has a date filter.
export const DATE_FILTER_DEFAULTS = { period: "all", week: "", month: "All", year: "All", dateFrom: "", dateTo: "" };
const DATE_KEYS = Object.keys(DATE_FILTER_DEFAULTS);

export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad2 = (n) => String(n).padStart(2, "0");

// Calendar day (YYYY-MM-DD) of a date or timestamp in the viewer's local
// time. A plain "YYYY-MM-DD" is returned as is (never shifted by time zone).
export function localDayKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (isNaN(d)) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const todayKey = () => localDayKey(new Date());

// ISO week ("2026-W46") of a YYYY-MM-DD day, matching <input type="week">.
export function isoWeekOf(day) {
  const [y, m, d] = String(day).split("-").map(Number);
  if (!y || !m || !d) return "";
  const target = new Date(y, m - 1, d);
  const dayNum = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${target.getFullYear()}-W${pad2(weekNum)}`;
}

// Does a YYYY-MM-DD day fall in the filter's date period?
export function matchesDatePeriod(day, f) {
  if (!f || !f.period || f.period === "all") return true;
  if (!day) return false;
  if (f.period === "today") return day === todayKey();
  if (f.period === "week") return isoWeekOf(day) === f.week;
  if (f.period === "month") return day.slice(0, 4) === f.year && MONTH_NAMES[Number(day.slice(5, 7)) - 1] === f.month;
  if (f.period === "year") return day.slice(0, 4) === f.year;
  if (f.period === "custom") return (!f.dateFrom || day >= f.dateFrom) && (!f.dateTo || day <= f.dateTo);
  return true;
}

// Year and month choices for the date filter, from the records' own days
// (months follow the year picked in the draft).
export function dateFilterOptions(days, draftYear = "All") {
  const valid = days.filter(Boolean);
  const years = [...new Set(valid.map((d) => d.slice(0, 4)))].sort((a, b) => b - a);
  const months = [...new Set(
    valid.filter((d) => draftYear === "All" || d.slice(0, 4) === draftYear)
      .map((d) => MONTH_NAMES[Number(d.slice(5, 7)) - 1])
      .filter(Boolean),
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));
  return { years, months };
}

// Message for an incomplete or impossible date filter, or "" when valid.
export function dateFilterError(f) {
  if (!f || !f.period || f.period === "all" || f.period === "today") return "";
  if (f.period === "week" && !f.week) return "Select a week.";
  if (f.period === "month" && (f.month === "All" || f.year === "All")) return "Select a month and a year.";
  if (f.period === "year" && f.year === "All") return "Select a year.";
  if (f.period === "custom") {
    const today = todayKey();
    if (!f.dateFrom && !f.dateTo) return "Select a start date or an end date.";
    if (f.dateFrom && f.dateFrom > today) return "Start date cannot be a future date.";
    if (f.dateTo && f.dateTo > today) return "End date cannot be a future date.";
    if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) return "Start date cannot be later than end date.";
  }
  return "";
}

// `defaults` should be a constant defined outside the component.
export function useFilterPanel(defaults) {
  const base = defaults;
  const [applied, setApplied] = useState(base);
  const [draft, setDraft] = useState(base);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  // The panel's wrapper (button + dropdown) carries data-filter-panel={id};
  // a mousedown anywhere outside it closes the panel.
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      const inside = e.target instanceof Element
        && e.target.closest(`[data-filter-panel="${CSS.escape(id)}"]`);
      if (!inside) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, id]);

  const hasDate = "period" in base;
  // A date period is one filter however many date fields it uses.
  const activeKeys = [
    ...(hasDate && applied.period !== "all" ? ["date"] : []),
    ...Object.keys(base).filter((k) => !DATE_KEYS.includes(k) && applied[k] !== base[k]),
  ];

  return {
    id,
    open,
    applied,
    draft,
    error,
    activeKeys,
    activeCount: activeKeys.length,
    toggle: () => {
      if (!open) { setDraft(applied); setError(""); }
      setOpen((o) => !o);
    },
    close: () => setOpen(false),
    setDraftField: (key, value) => setDraft((d) => ({ ...d, [key]: value })),
    apply: () => {
      const msg = hasDate ? dateFilterError(draft) : "";
      if (msg) { setError(msg); return; }
      // Only the fields the chosen period uses are kept.
      const next = { ...draft };
      if (hasDate) {
        if (next.period !== "week") next.week = "";
        if (next.period !== "month") next.month = "All";
        if (next.period !== "month" && next.period !== "year") next.year = "All";
        if (next.period !== "custom") { next.dateFrom = ""; next.dateTo = ""; }
      }
      setError("");
      setApplied(next);
      setOpen(false);
    },
    // Clear All: back to the default (unfiltered) view.
    clear: () => { setDraft(base); setApplied(base); setError(""); },
    // Remove one applied filter ("date" clears the whole date period).
    clearOne: (key) => {
      const reset = key === "date"
        ? Object.fromEntries(DATE_KEYS.map((k) => [k, base[k]]))
        : { [key]: base[key] };
      setApplied((a) => ({ ...a, ...reset }));
      setDraft((d) => ({ ...d, ...reset }));
    },
  };
}

// Short label for an applied date period, e.g. for an active-filter chip.
export function datePeriodLabel(f) {
  if (!f || f.period === "all") return "All Records";
  if (f.period === "today") return "Today";
  if (f.period === "week") return f.week;
  if (f.period === "month") return `${f.month} ${f.year}`;
  if (f.period === "year") return f.year;
  if (f.period === "custom") return `${f.dateFrom || "—"} – ${f.dateTo || "—"}`;
  return "";
}