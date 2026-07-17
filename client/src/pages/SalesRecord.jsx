import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiDollarSign, FiShoppingCart,
  FiTrendingUp, FiCalendar, FiMaximize,
} from "react-icons/fi";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import { useUser } from "../hooks/useUser";
import { activity } from "../activity";
import "./SalesRecord.css";

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1"}/sales-records`;

function getToken() {
  return localStorage.getItem("token") || "";
}

export default function SalesRecord() {
  const navigate = useNavigate();
  const { canEdit, canArchive, user } = useUser();

  const [records, setRecords] = useState([]);
  const [stats, setStats]     = useState({ totalSalesRecords: 0, totalRevenue: 0, totalTraysSold: 0, latestSaleDate: null });
  const [search, setSearch]   = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ eggSize: "All", date: "All" });
  const filterRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchRecords = useCallback(async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const url  = q ? `${API_BASE}?search=${encodeURIComponent(q)}` : API_BASE;
      const res  = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      if (data.success) {
        const recs = Array.isArray(data.data) ? data.data : [];
        setRecords(recs);
        const base = { totalSalesRecords: 0, totalRevenue: 0, totalTraysSold: 0, latestSaleDate: null };
        setStats(
          data.stats && typeof data.stats === "object"
            ? { ...base, ...data.stats }
            : { ...base, totalSalesRecords: recs.length }
        );
      } else {
        setError(data.message || "Failed to load records.");
      }
    } catch {
      setError("Cannot connect to server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchRecords(search), 400);
    return () => clearTimeout(timer);
  }, [search, fetchRecords]);

  // -- Filter --
  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ eggSize: "All", date: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Archive immediately (no confirm): move to Archive page + remove from this table.
  const handleArchive = async (r) => {
    try {
      activity.archived({
        module: "Sales Records",
        recordName: r.buyerName || r.customerName || r.customer || `${r.eggSize || "Sale"} ${r.dateOfSale || ""}`.trim(),
        moduleKey: "pb_sales",
        payload: r,
        user: (user && (user.fullName || user.name)) || "Admin",
      });
      await fetch(`${API_BASE}/${r._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch { /* ignore */ }
    fetchRecords(search);
  };

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const eggSizeOptions = uniq(records.map((r) => r.eggSize));
  const dateOptions    = uniq(records.map((r) => r.dateOfSale));

  const filtered = records.filter(
    (r) =>
      (filters.eggSize === "All" || r.eggSize === filters.eggSize) &&
      (filters.date === "All" || r.dateOfSale === filters.date)
  );

  // -- Formatters --
  const formatDate  = (d) => d
    ? new Date(d).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })
    : "—";
  const formatPeso  = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatTrays = (n) => Number(n || 0).toLocaleString("en-PH");

  // Auto-generated display ID (SL-000001, SL-000002, ...) — like Batch ID.
  // Computed from the FULL records list (not the filtered view) so the
  // numbering stays stable and sequential regardless of search/filter.
  // Sorted by date of sale, then by _id as a tie-breaker.
  const saleIdMap = (() => {
    const sorted = [...records].sort((a, b) => {
      const da = new Date(a.dateOfSale || 0).getTime();
      const db = new Date(b.dateOfSale || 0).getTime();
      if (da !== db) return da - db;
      return String(a._id).localeCompare(String(b._id));
    });
    const map = new Map();
    sorted.forEach((r, i) => map.set(r._id, `SL-${String(i + 1).padStart(6, "0")}`));
    return map;
  })();


  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "SALES & TRANSACTIONS", path: "/sales-transactions" },
        { label: "SALES RECORD" },
      ]}
    >
        {/* Toolbar */}
        <div className="sr-toolbar">
          <button className="add-sales-btn" onClick={() => navigate("/sales-transactions/sales/add")}>
            <FiPlus /> Add Sales Record
          </button>

          <div className="sr-toolbar-actions">
            <div className="sr-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search Sales..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="sr-btn-group">
              <div className="sr-filter-wrap" ref={filterRef}>
                <button className="sr-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="sr-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="sr-filter-dropdown">
                    <div className="sr-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="sr-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="sr-filter-group">
                      <label className="sr-filter-label">Egg Size</label>
                      <select
                        className="sr-filter-select"
                        value={filters.eggSize}
                        onChange={(e) => handleFilterChange("eggSize", e.target.value)}
                      >
                        <option value="All">All Sizes</option>
                        {eggSizeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>

                    {dateOptions.length > 0 && (
                      <div className="sr-filter-group">
                        <label className="sr-filter-label">Date of Sale</label>
                        <div className="sr-filter-options">
                          <button
                            className={`sr-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`sr-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{formatDate(opt)}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ExportMenu rows={filtered} name="sales-record" title="Sales Record" className="sr-toolbar-btn" />
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="sr-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="sr-active-filter-tag">
                  {(key === "eggSize" ? "Egg Size" : "Date")}: {key === "date" ? formatDate(value) : value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stats */}
        <div className="sr-stats-grid">
          <div className="sr-stat-card">
            <div className="sr-stat-icon gold"><FiShoppingCart /></div>
            <div>
              <h3>{stats.totalSalesRecords}</h3>
              <p>Total Sales Records</p>
              <span>All Time</span>
            </div>
          </div>

          <div className="sr-stat-card">
            <div className="sr-stat-icon green"><FiDollarSign /></div>
            <div>
              <h3>{formatPeso(stats.totalRevenue)}</h3>
              <p>Total Revenue</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="sr-stat-card">
            <div className="sr-stat-icon blue"><FiTrendingUp /></div>
            <div>
              <h3>{formatTrays(stats.totalTraysSold)}</h3>
              <p>Total Trays Sold</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="sr-stat-card">
            <div className="sr-stat-icon orange"><FiCalendar /></div>
            <div>
              <h3>{stats.latestSaleDate ? formatDate(stats.latestSaleDate) : "—"}</h3>
              <p>Latest Sale Date</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && <div className="sr-error-banner">{error}</div>}

        {/* Table */}
        <div className="sr-table-wrapper">
          {loading ? (
            <div className="sr-loading">Loading sales records...</div>
          ) : (
            <table className="sr-table">
              <thead>
                <tr>
                  <th>Sale ID</th>
                  <th>Date of Sale</th>
                  <th>Buyer / Customer</th>
                  <th>Egg Size</th>
                  <th>Qty Sold (Trays)</th>
                  <th>Unit Price</th>
                  <th>Total Amount</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="sr-empty-state">
                      <div className="sr-empty-content">
                        <FiMaximize />
                        <h3>No sales records found</h3>
                        <p>Click Add Sales Record to log your first egg sale transaction.</p>
                        <button
                          className="sr-empty-add-btn"
                          onClick={() => navigate("/sales-transactions/sales/add")}
                        >
                          <FiPlus /> Add Sales Record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r._id}>
                      <td><span className="sr-badge" title={r.saleId}>{saleIdMap.get(r._id) || "—"}</span></td>
                      <td>{formatDate(r.dateOfSale)}</td>
                      <td>{r.buyer}</td>
                      <td>{r.eggSize}</td>
                      <td>{r.quantitySold} trays</td>
                      <td>{formatPeso(r.unitPrice)}</td>
                      <td className="sr-total">{formatPeso(r.totalAmount)}</td>
                      <td className="sr-notes">{r.notes || "—"}</td>
                      <td>
                        <div className="sr-action-buttons">
                          {canEdit && (
                            <button className="sr-action-btn edit" title="Edit" onClick={() => navigate(`/sales-transactions/sales/edit/${r._id}`)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {canArchive && (
                            <button className="sr-action-btn archive" title="Archive" onClick={() => handleArchive(r)}>
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

          <div className="sr-table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

    </PageLayout>
  );
}