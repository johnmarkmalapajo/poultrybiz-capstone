import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiMaximize, FiEye,
  FiFileText, FiDollarSign, FiTag, FiList,
  FiX, FiImage, FiExternalLink, FiTruck,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./ExpensesRecord.css";
import "../components/ProofOfCompletionModal.css";
import { listExpenseRecords, getExpenseRecord } from "../api/expenseRecord";
import { API_BASE } from "../api/client";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";
import { useLanguage } from "../i18n/LanguageContext";

const CATEGORY_OPTIONS = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];

const formatPeso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isUploadedReceipt = (receipt) =>
  typeof receipt === "string" && receipt.startsWith("/uploads/");

const isPdfReceipt = (receipt) =>
  isUploadedReceipt(receipt) && /\.pdf$/i.test(receipt);

const RECEIPT_LABELS = {
  "Feed Purchase": "Feed Receipt",
  "Equipment": "Equipment Receipt",
  "Medicine": "Medicine Receipt",
  "Utilities": "Utilities Receipt",
  "Labor": "Labor Receipt",
  "Transportation": "Transportation Receipt",
  "Miscellaneous": "Miscellaneous Receipt",
};

const getReceiptLabel = (category) =>
  RECEIPT_LABELS[category] || "Receipt";

const formatExpenseDate = (value) =>
  value ? new Date(value).toISOString().split("T")[0] : "—";

// View modal helpers ---------------------------------------------------
const formatPHDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : "";

const formatNumber = (n) =>
  Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });

// One label/value row of the View modal; empty values are not shown.
function DetailItem({ label, children, wide = false }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className={`er-view-item${wide ? " wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const feedUnitLabel = (unit) =>
  /^(kg|kilogram)/i.test(String(unit || "")) ? "kg" : "sacks";

const getExpenseDetails = (r) => {
  if (r.category === "Feed Purchase" && Array.isArray(r.feedSets) && r.feedSets.length) {
    return r.feedSets
      .map((fs) => `${fs.feedType || "Feed"} – ${Number(fs.quantity) || 0} ${feedUnitLabel(fs.unit)}`)
      .join("; ");
  }
  if (r.category === "Equipment" && r.equipmentName) {
    const qty = Number(r.quantity) ? `${Number(r.quantity)} ${r.unit || ""}`.trim() : "";
    return [r.equipmentName, qty].filter(Boolean).join(" – ");
  }
  return r.description || "—";
};

export default function ExpensesRecord() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const { canEdit } = useUser();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });
  const [viewRecord, setViewRecord] = useState(null);
  // The file being previewed inside the View modal:
  // { key: "receipt" | "pod" | "set-<i>", label, path }.
  const [viewPreview, setViewPreview] = useState(null);

  // View: open the modal at once with the table row, then load the full
  // saved record by its id so every saved field is shown.
  const openView = async (row) => {
    setViewPreview(null);
    setViewRecord({ ...row, _loading: true });
    try {
      const json = await getExpenseRecord(row._id || row.id);
      const full = json?.record || json?.data || null;
      setViewRecord((current) =>
        current && String(current._id || current.id) === String(row._id || row.id)
          ? { ...(full || row), _loading: false }
          : current
      );
    } catch {
      setViewRecord((current) => (current ? { ...current, _loading: false } : current));
    }
  };
  const closeView = () => { setViewRecord(null); setViewPreview(null); };
  useEffect(() => {
    if (!viewRecord) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setViewRecord(null); setViewPreview(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewRecord]);

  // A file button inside the View modal. Images preview inside the modal;
  // PDFs open in a new tab. A value that is not an uploaded file (older
  // records saved only a file name) shows "Not provided".
  const renderFile = (key, label, buttonText, path) => {
    if (!isUploadedReceipt(path)) {
      return (
        <span className="er-view-none">
          {tr("Not provided")}
          {path ? <small> ({tr("only the file name was saved")})</small> : null}
        </span>
      );
    }
    if (isPdfReceipt(path)) {
      return (
        <a className="er-view-file-btn" href={`${API_BASE}${path}`} target="_blank" rel="noopener noreferrer" data-file={key}>
          <FiExternalLink /> {buttonText} {tr("(PDF)")}
        </a>
      );
    }
    const open = viewPreview?.key === key;
    return (
      <button
        type="button"
        className={`er-view-file-btn${open ? " active" : ""}`}
        aria-expanded={open}
        data-file={key}
        onClick={() => setViewPreview(open ? null : { key, label, path })}
      >
        <FiImage /> {open ? tr("Hide") : buttonText}
      </button>
    );
  };

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listExpenseRecords();
      const list = Array.isArray(data) ? data : (data.records || data.data || []);
      setRecords(list);
    } catch (err) {
      setError(tr(err?.message || "Cannot connect to server. Please try again."));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRecords();
    window.addEventListener("pb_data_changed", fetchRecords);
    window.addEventListener("focus", fetchRecords);
    return () => {
      window.removeEventListener("pb_data_changed", fetchRecords);
      window.removeEventListener("focus", fetchRecords);
    };
  }, [fetchRecords]);

  useEffect(() => {
    getFarmInfo().then((d) => setFarmInfo(d)).catch(() => {});
  }, []);

  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const defaultFilters = { category: "All", period: "all", year: "All", month: "All", week: "", dateFrom: "", dateTo: "" };
  const [filters, setFilters] = useState(defaultFilters);
  const [draft, setDraft] = useState(defaultFilters);
  const [filterApplied, setFilterApplied] = useState(false);
  const filterRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilter(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleFilterChange = (key, value) => setDraft((f) => ({ ...f, [key]: value }));
  const clearFilters = () => { setDraft(defaultFilters); setFilters(defaultFilters); setFilterApplied(false); };
  const applyFilters = () => {
    if (draft.period === "custom") {
      const today = todayStr();
      if (draft.dateFrom && draft.dateFrom > today) {
        setError(tr("Start date cannot be a future date."));
        return;
      }
      if (draft.dateTo && draft.dateTo > today) {
        setError(tr("End date cannot be a future date."));
        return;
      }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
        setError(tr("Start date cannot be later than end date."));
        return;
      }
    }
    setError("");
    setFilters(draft);
    setFilterApplied(true);
    setShowFilter(false);
  };
  const openFilterPanel = () => { setDraft(filters); setShowFilter((s) => !s); };
  const activeFilterCount =
    (filterApplied && filters.period !== "all" ? 1 : 0) +
    (filterApplied && filters.category !== "All" ? 1 : 0);

  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  };

  const expenseDate = (r) => (r.date ? String(r.date).slice(0, 10) : "");

  const isoWeekOf = (dateStr) => {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNum + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((target - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
    return `${target.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
  };

  const yearOptions = [...new Set(
    records.map((r) => { const d = new Date(expenseDate(r)); return isNaN(d) ? null : String(d.getFullYear()); }).filter(Boolean)
  )].sort((a, b) => b - a);

  const monthOptions = [...new Set(
    records
      .filter((r) => draft.year === "All" || String(new Date(expenseDate(r)).getFullYear()) === draft.year)
      .map((r) => { const d = new Date(expenseDate(r)); return isNaN(d) ? null : MONTH_NAMES[d.getMonth()]; })
      .filter(Boolean)
  )].sort((a, b) => MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b));

  const matchesDatePeriod = (r, f) => {
    if (f.period === "all") return true;
    const date = expenseDate(r);
    const d = new Date(date);
    const recYear = isNaN(d) ? null : String(d.getFullYear());
    const recMonth = isNaN(d) ? null : MONTH_NAMES[d.getMonth()];
    if (f.period === "today") return date === todayStr();
    if (f.period === "week") return !!f.week && isoWeekOf(date) === f.week;
    if (f.period === "month") return f.year !== "All" && f.month !== "All" && recYear === f.year && recMonth === f.month;
    if (f.period === "year") return f.year !== "All" && recYear === f.year;
    if (f.period === "custom") return (!f.dateFrom || date >= f.dateFrom) && (!f.dateTo || date <= f.dateTo);
    return true;
  };

  const filtered = records.filter((r) => {
    const matchSearch = !search || r.category?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !filterApplied || filters.category === "All" || r.category === filters.category;
    const matchDate = !filterApplied || matchesDatePeriod(r, filters);
    return matchSearch && matchCategory && matchDate;
  });

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "date") return row.date || "";
    if (col === "category") return row.category || "";
    if (col === "amount") return Number(row.amount) || 0;
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, filterApplied, filters]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const totalAmount = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const categoriesUsed = new Set(filtered.map((r) => r.category).filter(Boolean)).size;

  const categoryBreakdown = (() => {
    const byCategory = {};
    filtered.forEach((r) => {
      if (!r.category) return;
      byCategory[r.category] = (byCategory[r.category] || 0) + (Number(r.amount) || 0);
    });
    return Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  })();

  const STAT_SPAN_LABELS = { all: "All Records", today: "Today", week: "Weekly", month: "Monthly", year: "Yearly", custom: "Custom Range" };
  const statSpanLabel = STAT_SPAN_LABELS[filterApplied ? filters.period : "all"] || "All Records";

  const periodLabel = (() => {
    if (!filterApplied || filters.period === "all") return "All Records";
    if (filters.period === "today") return "Today";
    if (filters.period === "week" && filters.week) return filters.week;
    if (filters.period === "month" && filters.month !== "All" && filters.year !== "All") return `${filters.month} ${filters.year}`;
    if (filters.period === "year" && filters.year !== "All") {
      return filters.year === String(new Date().getFullYear()) ? "This Year" : `Year ${filters.year}`;
    }
    if (filters.period === "custom" && (filters.dateFrom || filters.dateTo)) {
      return `${filters.dateFrom || "—"} – ${filters.dateTo || "—"}`;
    }
    return "All Records";
  })();

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filterApplied && filters.category !== "All" ? [{ label: "Category", value: filters.category }] : [],
  };

  const exportSummary = filtered.length
    ? [
        { label: "Total Records", value: String(filtered.length) },
        { label: "Total Expenses", value: formatPeso(totalAmount) },
        { label: "Categories Used", value: String(categoriesUsed) },
        ...categoryBreakdown.map(([cat, amt]) => ({ label: cat, value: formatPeso(amt) })),
      ]
    : [];

  const exportColumns = [
    { key: "date", label: "Expense Date" },
    { key: "category", label: "Category" },
    { key: "details", label: "Details" },
    { key: "supplier", label: "Supplier" },
    { key: "amount", label: "Amount" },
    { key: "receipt", label: "Receipt" },
    { key: "remarks", label: "Remarks" },
  ];

  const exportRows = sorted.map((r) => ({
    date: formatExpenseDate(r.date),
    category: r.category || "—",
    details: getExpenseDetails(r),
    supplier: r.supplier || "—",
    amount: formatPeso(r.amount),
    receipt: r.receipt ? getReceiptLabel(r.category) : "—",
    remarks: r.remarks || "—",
  }));

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "SALES AND TRANSACTIONS", path: "/sales-transactions" },
        { label: "EXPENSES RECORD" },
      ]}
    >
        {}
        <div className="er-toolbar">
          <button className="er-add-btn" onClick={() => navigate("/sales-transactions/expenses/add")}>
            <FiPlus />{" "}{tr("Add Expense")}</button>

          <div className="er-toolbar-actions">
            <div className="er-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder={tr("Search expense...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="er-btn-group">
              <div className="er-filter-wrap" ref={filterRef}>
                <button className="er-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter />{" "}{tr("Filter")}{activeFilterCount > 0 && <span className="er-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="er-filter-dropdown">
                    <div className="er-filter-dropdown-header">
                      <span>{tr("Filter Records")}</span>
                    </div>

                    <div className="er-filter-section-label">{tr("Date Filter")}</div>
                    <div className="er-filter-row">
                      <div className="er-filter-group">
                        <label className="er-filter-label">{tr("Date Period")}</label>
                        <select
                          className="er-filter-select"
                          value={draft.period}
                          onChange={(e) => handleFilterChange("period", e.target.value)}
                        >
                          <option value="all">{tr("All Records")}</option>
                          <option value="today">{tr("Today")}</option>
                          <option value="week">{tr("Week")}</option>
                          <option value="month">{tr("Month")}</option>
                          <option value="year">{tr("Year")}</option>
                          <option value="custom">{tr("Custom Range")}</option>
                        </select>
                      </div>

                      {draft.period === "week" && (
                        <div className="er-filter-group">
                          <label className="er-filter-label">{tr("Week")}</label>
                          <input
                            type="week"
                            className="er-filter-select"
                            value={draft.week}
                            onChange={(e) => handleFilterChange("week", e.target.value)}
                          />
                        </div>
                      )}

                      {draft.period === "month" && (
                        <div className="er-filter-group">
                          <label className="er-filter-label">{tr("Month")}</label>
                          <select
                            className="er-filter-select"
                            value={draft.month}
                            onChange={(e) => handleFilterChange("month", e.target.value)}
                          >
                            <option value="All">{tr("Select Month")}</option>
                            {monthOptions.map((opt) => (
                              <option key={opt} value={opt}>{tr(opt)}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(draft.period === "month" || draft.period === "year") && (
                        <div className="er-filter-group">
                          <label className="er-filter-label">{tr("Year")}</label>
                          <select
                            className="er-filter-select"
                            value={draft.year}
                            onChange={(e) => handleFilterChange("year", e.target.value)}
                          >
                            <option value="All">{tr("Select Year")}</option>
                            {yearOptions.map((opt) => (
                              <option key={opt} value={opt}>{tr(opt)}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {draft.period === "custom" && (
                      <div className="er-filter-group">
                        <label className="er-filter-label">{tr("Start Date / End Date")}</label>
                        <div className="er-filter-date-range">
                          <input type="date" className="er-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label={tr("From date")} />
                          <span>{tr("to")}</span>
                          <input type="date" className="er-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label={tr("To date")} />
                        </div>
                      </div>
                    )}

                    <div className="er-filter-section-label">{tr("Filters")}</div>
                    <div className="er-filter-row">
                      <div className="er-filter-group">
                        <label className="er-filter-label">{tr("Category")}</label>
                        <select
                          className="er-filter-select"
                          value={draft.category}
                          onChange={(e) => handleFilterChange("category", e.target.value)}
                        >
                          <option value="All">{tr("All Categories")}</option>
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{tr(opt)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="er-filter-actions">
                      <button className="er-filter-clear" onClick={clearFilters}>{tr("Clear All")}</button>
                      <button className="er-filter-apply" onClick={applyFilters}>{tr("Apply")}</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={exportRows}
                columns={exportColumns}
                name="expenses-record"
                title={tr("Farm Expense Report")}
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary, hideApprovalAndTagline: true }}
                moduleLabel="Expense Record"
                enablePreview
                filters={{
                  ...(filterApplied && filters.category !== "All" ? { "Category": filters.category } : {}),
                  ...(filterApplied && filters.period !== "all" ? { "Report Period": periodLabel } : {}),
                }}
                className="er-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {}

        {}
        <div className="er-stats-grid">
          <div className="er-stat-card">
            <div className="er-stat-icon gold"><FiFileText /></div>
            <div>
              <h3>{filtered.length}</h3>
              <p>{tr("Total Records")}</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon green"><FiDollarSign /></div>
            <div>
              <h3>{formatPeso(totalAmount)}</h3>
              <p>{tr("Total Expenses")}</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon blue"><FiTag /></div>
            <div>
              <h3>{categoriesUsed}</h3>
              <p>{tr("Categories")}</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon orange"><FiList /></div>
            <div>
              <h3>{filtered.length}</h3>
              <p>{tr("Showing")}</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
        {error && <div className="er-error-banner" style={{ display: "block" }}>{error}</div>}

        {}
        <TableSection className="er-table-wrapper">
          <TableScroll>
          {loading ? (
            <div className="er-loading">{tr("Loading expense records...")}</div>
          ) : (
            <table className="er-table">
              <thead>
                <tr>
                  <th className="er-sortable-th" onClick={() => cycleSort("date")}>{tr("Expense Date")}{sortIndicator("date", sortColumn, sortDirection)}</th>
                  <th className="er-sortable-th" onClick={() => cycleSort("category")}>{tr("Category")}{sortIndicator("category", sortColumn, sortDirection)}</th>
                  <th className="er-sortable-th" onClick={() => cycleSort("amount")}>{tr("Amount")}{sortIndicator("amount", sortColumn, sortDirection)}</th>
                  <th>{tr("Receipt")}</th>
                  <th>{tr("Remarks")}</th>
                  <th>{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="er-empty-state">
                      <div className="er-empty-content">
                        <FiMaximize />
                        <h3>{tr("No expense records found")}</h3>
                        <p>{tr("Click Add Expense to log your first farm expense.")}</p>
                        <button
                          className="er-empty-add-btn"
                          onClick={() => navigate("/sales-transactions/expenses/add")}
                        >
                          <FiPlus />{" "}{tr("Add Expense")}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r._id || r.id}>
                      <td>{r.date ? new Date(r.date).toISOString().split("T")[0] : ""}</td>
                      <td>{tr(r.category)}</td>
                      <td className="er-amount">{formatPeso(r.amount)}</td>
                      <td>{r.receipt ? getReceiptLabel(r.category) : "—"}</td>
                      <td>{r.remarks || "—"}</td>
                      <td>
                        <div className="er-action-buttons">
                          <button
                            className="er-action-btn view"
                            title={tr("View")}
                            onClick={() => openView(r)}
                          >
                            <FiEye />
                          </button>
                          {canEdit && (
                          <button
                            className="er-action-btn edit"
                            title={tr("Edit")}
                            onClick={() => navigate(`/sales-transactions/expenses/edit/${r._id || r.id}`)}
                          >
                            <FiEdit2 />
                          </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          </TableScroll>
          <TablePagination
            currentPage={pager.page}
            totalPages={pager.totalPages}
            pageSize={pager.rowsPerPage}
            totalRecords={pager.totalItems}
            startIndex={pager.startIndex}
            endIndex={pager.endIndex}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setRowsPerPage}
          />
        </TableSection>

      {viewRecord && (() => {
        const v = viewRecord;
        const isFeed = v.category === "Feed Purchase";
        const isEquip = v.category === "Equipment";
        const feedSets = isFeed && Array.isArray(v.feedSets) ? v.feedSets : [];
        const feedTotal = feedSets.reduce((sum, fs) => sum + Number(fs.amount || 0), 0);
        const feedKg = Number(v.totalQuantityKg) || feedSets.reduce((sum, fs) => sum + Number(fs.equivalentKg || 0), 0);
        const updated = v.updatedAt && v.createdAt && new Date(v.updatedAt) - new Date(v.createdAt) > 60000;
        return (
          <div className="poc-overlay" onClick={closeView}>
            <div
              className="poc-modal er-view-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="er-view-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="poc-head">
                <h3 id="er-view-title">{tr("Expense Details")}</h3>
                <button className="poc-close" onClick={closeView} aria-label={tr("Close")}><FiX /></button>
              </div>

              <div className="poc-body">
                <div className="er-view-summary">
                  <span className="er-view-category">{tr(v.category || "—")}</span>
                  <strong className="er-view-amount">{formatPeso(isFeed && feedSets.length ? feedTotal || v.amount : v.amount)}</strong>
                  <span className="er-view-date">{formatExpenseDate(v.date)}</span>
                  {v._loading && <span className="er-view-loading">{tr("Loading…")}</span>}
                </div>

                <section className="er-view-section">
                  <h4>{tr("Expense Information")}</h4>
                  <dl className="er-view-grid">
                    <DetailItem label={tr(isFeed ? "Date Purchased" : "Expense Date")}>{formatExpenseDate(v.date)}</DetailItem>
                    <DetailItem label={tr("Category")}>{tr(v.category || "—")}</DetailItem>
                    <DetailItem label={tr(isFeed ? "Grand Total" : "Amount")}>{formatPeso(isFeed && feedSets.length ? feedTotal || v.amount : v.amount)}</DetailItem>
                    {isFeed && <DetailItem label={tr("Supplier")}>{v.supplier || ""}</DetailItem>}
                    {isFeed && feedSets.length > 0 && (
                      <DetailItem label={tr("Total Quantity")}>{`${formatNumber(feedKg)} ${tr("kg")}`}</DetailItem>
                    )}
                    {isEquip && <DetailItem label={tr("Equipment Name")}>{v.equipmentName || ""}</DetailItem>}
                    {isEquip && <DetailItem label={tr("Serial ID")}>{v.serialNo || ""}</DetailItem>}
                    {isEquip && Number(v.quantity) > 0 && (
                      <DetailItem label={tr("Quantity")}>{`${formatNumber(v.quantity)} ${v.unit ? tr(v.unit) : ""}`.trim()}</DetailItem>
                    )}
                    {!isFeed && <DetailItem label={tr("Description")} wide>{v.description || ""}</DetailItem>}
                    <DetailItem label={tr("Recorded")}>{formatPHDateTime(v.createdAt)}</DetailItem>
                    {updated && <DetailItem label={tr("Last Updated")}>{formatPHDateTime(v.updatedAt)}</DetailItem>}
                  </dl>
                </section>

                {isFeed && feedSets.length > 0 && (
                  <section className="er-view-section">
                    <h4>{tr("Feed Sets")}</h4>
                    <div className="er-view-table-scroll">
                      <table className="er-view-table">
                        <thead>
                          <tr>
                            <th>{tr("Feed Type")}</th>
                            <th>{tr("Quantity")}</th>
                            <th>{tr("Equivalent")}</th>
                            <th>{tr("Unit Price")}</th>
                            <th>{tr("Subtotal")}</th>
                            {feedSets.length > 1 && <th>{tr("Receipt")}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {feedSets.map((fs, i) => (
                            <tr key={fs._id || i}>
                              <td>{tr(fs.feedType || "—")}</td>
                              <td>{`${formatNumber(fs.quantity)} ${tr(fs.unit || "Sacks")}`}</td>
                              <td>{`${formatNumber(fs.equivalentKg)} ${tr("kg")}`}</td>
                              <td>{Number(fs.quantity) > 0 ? formatPeso(Number(fs.amount || 0) / Number(fs.quantity)) : "—"}</td>
                              <td>{formatPeso(fs.amount)}</td>
                              {feedSets.length > 1 && (
                                <td>
                                  {i === 0 && !fs.receipt
                                    ? <span className="er-view-none">{tr("See Receipt below")}</span>
                                    : renderFile(`set-${i}`, `${tr("Receipt")} — ${tr(fs.feedType || "Feed")}`, tr("View Receipt"), fs.receipt)}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <section className="er-view-section">
                  <h4>{tr("Attachments")}</h4>
                  <div className="er-view-files">
                    <div className="er-view-file">
                      <span className="er-view-file-label"><FiFileText /> {tr(getReceiptLabel(v.category))}</span>
                      {renderFile("receipt", tr(getReceiptLabel(v.category)), tr("View Receipt"), v.receipt)}
                    </div>
                    {/* Feed Purchase only -- kept apart from the Receipt. */}
                    {isFeed && (
                      <div className="er-view-file">
                        <span className="er-view-file-label"><FiTruck /> {tr("Proof of Delivery")}</span>
                        {renderFile("pod", tr("Proof of Delivery"), tr("View Proof of Delivery"), v.proofOfDelivery)}
                      </div>
                    )}
                  </div>
                  {viewPreview && (
                    <figure className="er-view-preview" data-preview={viewPreview.key}>
                      <figcaption>{viewPreview.label}</figcaption>
                      <a href={`${API_BASE}${viewPreview.path}`} target="_blank" rel="noopener noreferrer" title={tr("Open full size")}>
                        <img src={`${API_BASE}${viewPreview.path}`} alt={viewPreview.label} />
                      </a>
                      <a className="er-view-fullsize" href={`${API_BASE}${viewPreview.path}`} target="_blank" rel="noopener noreferrer">
                        {tr("Open full size")}
                      </a>
                    </figure>
                  )}
                </section>

                {(v.remarks || "").trim() && (
                  <section className="er-view-section">
                    <h4>{tr("Remarks")}</h4>
                    <p className="er-view-remarks">{v.remarks}</p>
                  </section>
                )}
              </div>

              <div className="poc-foot">
                <button type="button" className="poc-btn-cancel" onClick={closeView}>{tr("Close")}</button>
              </div>
            </div>
          </div>
        );
      })()}

    </PageLayout>
  );
}