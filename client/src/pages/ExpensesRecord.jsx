import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMaximize, FiEye,
  FiFileText, FiDollarSign, FiTag, FiList,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import ExportMenu from "../components/ExportMenu";
import { useArchiveConfirm } from "../hooks/useArchiveConfirm";
import ArchiveConfirmModal from "../components/ArchiveConfirmModal";
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
  const { canEdit, canArchive } = useUser();
  const { pending: archivePending, requestArchive, cancelArchive, confirmArchive } = useArchiveConfirm();

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
  const [filters, setFilters] = useState({ category: "All", dateFrom: "", dateTo: "" });
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

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ category: "All", dateFrom: "", dateTo: "" });
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v && v !== "All").length;

  const filtered = records.filter((r) => {
    const matchSearch = !search || r.category?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filters.category === "All" || r.category === filters.category;
    const matchDate =
      (!filters.dateFrom || (r.date || "") >= filters.dateFrom) &&
      (!filters.dateTo || (r.date || "") <= filters.dateTo);
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
  useEffect(() => { pager.setPage(1); }, [search, filters]);
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

  const handleArchive = (r) =>
    requestArchive({ module: "Expenses", moduleKey: "pb_expenses", record: r, name: r.category || r.description, onArchived: fetchRecords });

  const periodLabel = filters.dateFrom && filters.dateTo
    ? `${filters.dateFrom} – ${filters.dateTo}`
    : filters.dateFrom
      ? `From ${filters.dateFrom}`
      : filters.dateTo
        ? `Until ${filters.dateTo}`
        : "All Time";

  const exportMeta = {
    farmName: farmInfo.farmName,
    location: farmInfo.farmLocation,
    contact: farmInfo.farmContact,
    email: farmInfo.farmEmail,
    logoUrl: farmInfo.farmLogo
      ? (farmInfo.farmLogo.startsWith("http") ? farmInfo.farmLogo : `${import.meta.env.VITE_API_URL || "http://localhost:5000"}${farmInfo.farmLogo}`)
      : "",
    period: periodLabel,
    fields: filters.category !== "All" ? [{ label: "Category", value: filters.category }] : [],
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
        { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
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
                <button
                  className="er-toolbar-btn"
                  onClick={() => setShowFilter((s) => !s)}
                >
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="er-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="er-filter-dropdown">
                    <div className="er-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="er-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    {}
                    <div className="er-filter-group">
                      <label className="er-filter-label">Category</label>
                      <select
                        className="er-filter-select"
                        value={filters.category}
                        onChange={(e) => handleFilterChange("category", e.target.value)}
                      >
                        <option value="All">All Categories</option>
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    <div className="er-filter-group">
                      <label className="er-filter-label">Report Period</label>
                      <div className="er-filter-date-range">
                        <input type="date" className="er-filter-select" value={filters.dateFrom}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                        <span>to</span>
                        <input type="date" className="er-filter-select" value={filters.dateTo}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                      </div>
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
                  ...(filters.category !== "All" ? { "Category": filters.category } : {}),
                  ...(periodLabel !== "All Time" ? { "Report Period": periodLabel } : {}),
                }}
                className="er-toolbar-btn"
              />
            </div>
          </div>
        </div>

        {}
        {activeFilterCount > 0 && (
          <div className="er-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="er-active-filter-tag">
                  {key === "category" ? "Category" : key === "dateFrom" ? "From" : "To"}: {value}
                  <button onClick={() => handleFilterChange(key, key === "dateFrom" || key === "dateTo" ? "" : "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {}
        <div className="er-stats-grid">
          <div className="er-stat-card">
            <div className="er-stat-icon gold"><FiFileText /></div>
            <div>
              <h3>{filtered.length}</h3>
              <p>Total Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon green"><FiDollarSign /></div>
            <div>
              <h3>{formatPeso(totalAmount)}</h3>
              <p>Total Expenses</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon blue"><FiTag /></div>
            <div>
              <h3>{categoriesUsed}</h3>
              <p>Categories</p>
              <span>Used</span>
            </div>
          </div>
          <div className="er-stat-card">
            <div className="er-stat-icon orange"><FiList /></div>
            <div>
              <h3>{filtered.length}</h3>
              <p>Showing</p>
              <span>Filtered</span>
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
                          {canArchive && (
                          <button className="er-action-btn archive" onClick={() => handleArchive(r)} title="Archive">
                            <FiArchive />
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

      <ArchiveConfirmModal pending={archivePending} onCancel={cancelArchive} onConfirm={confirmArchive} />

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