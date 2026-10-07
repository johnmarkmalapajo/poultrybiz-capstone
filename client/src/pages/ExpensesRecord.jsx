import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiMaximize, FiEye,
  FiFileText, FiDollarSign, FiTag, FiList,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import "./ExpensesRecord.css";
import { listExpenseRecords } from "../api/expenseRecord";
import { API_BASE } from "../api/client";
import { getFarmInfo } from "../api/profile";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

const CATEGORY_OPTIONS = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];

const formatPeso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const isUploadedReceipt = (receipt) =>
  typeof receipt === "string" && receipt.startsWith("/uploads/");

const isImageReceipt = (receipt) =>
  isUploadedReceipt(receipt) && /\.(jpe?g|png|gif|webp)$/i.test(receipt);

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

export default function ExpensesRecord() {
  const navigate = useNavigate();
  const { canEdit } = useUser();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [farmInfo, setFarmInfo] = useState({ farmName: "", farmLocation: "", farmContact: "", farmEmail: "", farmLogo: "" });
  const [viewRecord, setViewRecord] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listExpenseRecords();
      const list = Array.isArray(data) ? data : (data.records || data.data || []);
      setRecords(list);
    } catch (err) {
      setError(err?.message || "Cannot connect to server. Please try again.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
        setError("Start date cannot be a future date.");
        return;
      }
      if (draft.dateTo && draft.dateTo > today) {
        setError("End date cannot be a future date.");
        return;
      }
      if (draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo) {
        setError("Start date cannot be later than end date.");
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
            <FiPlus /> Add Expense
          </button>

          <div className="er-toolbar-actions">
            <div className="er-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search expense..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="er-btn-group">
              <div className="er-filter-wrap" ref={filterRef}>
                <button className="er-toolbar-btn" onClick={openFilterPanel}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="er-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="er-filter-dropdown">
                    <div className="er-filter-dropdown-header">
                      <span>Filter Records</span>
                    </div>

                    <div className="er-filter-section-label">Date Filter</div>
                    <div className="er-filter-row">
                      <div className="er-filter-group">
                        <label className="er-filter-label">Date Period</label>
                        <select
                          className="er-filter-select"
                          value={draft.period}
                          onChange={(e) => handleFilterChange("period", e.target.value)}
                        >
                          <option value="all">All Records</option>
                          <option value="today">Today</option>
                          <option value="week">Week</option>
                          <option value="month">Month</option>
                          <option value="year">Year</option>
                          <option value="custom">Custom Range</option>
                        </select>
                      </div>

                      {draft.period === "week" && (
                        <div className="er-filter-group">
                          <label className="er-filter-label">Week</label>
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
                          <label className="er-filter-label">Month</label>
                          <select
                            className="er-filter-select"
                            value={draft.month}
                            onChange={(e) => handleFilterChange("month", e.target.value)}
                          >
                            <option value="All">Select Month</option>
                            {monthOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {(draft.period === "month" || draft.period === "year") && (
                        <div className="er-filter-group">
                          <label className="er-filter-label">Year</label>
                          <select
                            className="er-filter-select"
                            value={draft.year}
                            onChange={(e) => handleFilterChange("year", e.target.value)}
                          >
                            <option value="All">Select Year</option>
                            {yearOptions.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {draft.period === "custom" && (
                      <div className="er-filter-group">
                        <label className="er-filter-label">Start Date / End Date</label>
                        <div className="er-filter-date-range">
                          <input type="date" className="er-filter-select" value={draft.dateFrom}
                            max={draft.dateTo || todayStr()}
                            onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                          <span>to</span>
                          <input type="date" className="er-filter-select" value={draft.dateTo}
                            min={draft.dateFrom || undefined} max={todayStr()}
                            onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                        </div>
                      </div>
                    )}

                    <div className="er-filter-section-label">Filters</div>
                    <div className="er-filter-row">
                      <div className="er-filter-group">
                        <label className="er-filter-label">Category</label>
                        <select
                          className="er-filter-select"
                          value={draft.category}
                          onChange={(e) => handleFilterChange("category", e.target.value)}
                        >
                          <option value="All">All Categories</option>
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="er-filter-actions">
                      <button className="er-filter-clear" onClick={clearFilters}>Clear All</button>
                      <button className="er-filter-apply" onClick={applyFilters}>Apply</button>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu
                rows={filtered}
                name="expenses-record"
                title="Farm Expense Report"
                meta={exportMeta}
                pdfExtra={{ period: exportMeta.period, summary: exportSummary }}
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
              <p>Total Records</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon green"><FiDollarSign /></div>
            <div>
              <h3>{formatPeso(totalAmount)}</h3>
              <p>Total Expenses</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon blue"><FiTag /></div>
            <div>
              <h3>{categoriesUsed}</h3>
              <p>Categories</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon orange"><FiList /></div>
            <div>
              <h3>{filtered.length}</h3>
              <p>Showing</p>
              <span>{statSpanLabel}</span>
            </div>
          </div>
        </div>

        {}
        {error && <div className="er-error-banner" style={{ display: "block" }}>{error}</div>}

        {}
        <div className="er-table-wrapper">
          {loading ? (
            <div className="er-loading">Loading expense records...</div>
          ) : (
            <table className="er-table">
              <thead>
                <tr>
                  <th className="er-sortable-th" onClick={() => cycleSort("date")}>Expense Date{sortIndicator("date", sortColumn, sortDirection)}</th>
                  <th className="er-sortable-th" onClick={() => cycleSort("category")}>Category{sortIndicator("category", sortColumn, sortDirection)}</th>
                  <th className="er-sortable-th" onClick={() => cycleSort("amount")}>Amount{sortIndicator("amount", sortColumn, sortDirection)}</th>
                  <th>Receipt</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="er-empty-state">
                      <div className="er-empty-content">
                        <FiMaximize />
                        <h3>No expense records found</h3>
                        <p>Click Add Expense to log your first farm expense.</p>
                        <button
                          className="er-empty-add-btn"
                          onClick={() => navigate("/sales-transactions/expenses/add")}
                        >
                          <FiPlus /> Add Expense
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((r) => (
                    <tr key={r._id || r.id}>
                      <td>{r.date ? new Date(r.date).toISOString().split("T")[0] : ""}</td>
                      <td>{r.category}</td>
                      <td className="er-amount">{formatPeso(r.amount)}</td>
                      <td>{r.receipt ? getReceiptLabel(r.category) : "—"}</td>
                      <td>{r.remarks || "—"}</td>
                      <td>
                        <div className="er-action-buttons">
                          <button
                            className="er-action-btn view"
                            title="View"
                            onClick={() => setViewRecord(r)}
                          >
                            <FiEye />
                          </button>
                          {canEdit && (
                          <button
                            className="er-action-btn edit"
                            title="Edit"
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

          <TablePagination
            page={pager.page}
            setPage={pager.setPage}
            rowsPerPage={pager.rowsPerPage}
            setRowsPerPage={pager.setRowsPerPage}
            totalPages={pager.totalPages}
            startIndex={pager.startIndex}
            endIndex={pager.endIndex}
            totalItems={pager.totalItems}
          />
        </div>

      {viewRecord && (
        <div className="pb-confirm-overlay" onClick={() => setViewRecord(null)}>
          <div className="pb-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: "left" }}>
            <h3 className="pb-confirm-title">Expense Record</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "12px 0" }}>
              <div><small>Expense Date</small><p style={{ margin: 0 }}>{viewRecord.date ? new Date(viewRecord.date).toISOString().split("T")[0] : "—"}</p></div>
              <div><small>Category</small><p style={{ margin: 0 }}>{viewRecord.category || "—"}</p></div>
              <div><small>Amount</small><p style={{ margin: 0 }}>{formatPeso(viewRecord.amount)}</p></div>
              <div style={{ gridColumn: "1 / -1" }}>
                <small>{getReceiptLabel(viewRecord.category)}</small>
                {isImageReceipt(viewRecord.receipt) ? (
                  <div style={{ marginTop: 6 }}>
                    <img
                      src={`${API_BASE}${viewRecord.receipt}`}
                      alt={getReceiptLabel(viewRecord.category)}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 320,
                        borderRadius: 8,
                        border: "1px solid #e2e2e2",
                        display: "block",
                      }}
                    />
                  </div>
                ) : isPdfReceipt(viewRecord.receipt) ? (
                  <p style={{ margin: 0 }}>
                    <a
                      href={`${API_BASE}${viewRecord.receipt}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open {getReceiptLabel(viewRecord.category)} (PDF)
                    </a>
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>{viewRecord.receipt ? getReceiptLabel(viewRecord.category) : "—"}</p>
                )}
              </div>
              <div style={{ gridColumn: "1 / -1" }}><small>Remarks</small><p style={{ margin: 0 }}>{viewRecord.remarks || "—"}</p></div>
            </div>
            <div className="pb-confirm-actions">
              <button className="pb-confirm-cancel" onClick={() => setViewRecord(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}