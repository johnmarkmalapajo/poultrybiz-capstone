import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiMenu, FiMaximize,
  FiFileText, FiDollarSign, FiTag, FiList,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./ExpensesRecord.css";

const CATEGORY_OPTIONS = [
  "Feed Purchase", "Medicine", "Utilities", "Labor",
  "Equipment", "Transportation", "Miscellaneous",
];
const AMOUNT_OPTIONS = ["Below ₱1,000", "₱1,000 - ₱3,000", "Above ₱3,000"];

const formatPeso = (n) =>
  "₱" + Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ExpensesRecord() {
  const navigate = useNavigate();

  // Records come from the backend — empty until fetched.
  const [records] = useState([]);
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ category: "All", date: "All", amount: "All" });
  const filterRef = useRef(null);

  // Close filter dropdown on outside click
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
  const clearFilters = () => setFilters({ category: "All", date: "All", amount: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  // Date options are derived from the records (no hardcoding)
  const dateOptions = [...new Set(records.map((r) => r.date).filter(Boolean))];

  const matchAmount = (r) => {
    if (filters.amount === "All") return true;
    if (filters.amount === "Below ₱1,000")     return r.amount < 1000;
    if (filters.amount === "₱1,000 - ₱3,000")  return r.amount >= 1000 && r.amount <= 3000;
    if (filters.amount === "Above ₱3,000")     return r.amount > 3000;
    return true;
  };

  const filtered = records.filter((r) => {
    const matchSearch =
      r.category?.toLowerCase().includes(search.toLowerCase()) ||
      r.remarks?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = filters.category === "All" || r.category === filters.category;
    const matchDate     = filters.date === "All" || r.date === filters.date;
    return matchSearch && matchCategory && matchDate && matchAmount(r);
  });

  // Stats
  const totalAmount = records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const categoriesUsed = new Set(records.map((r) => r.category).filter(Boolean)).size;

  return (
    <div className="er-page">
      <Sidebar />

      <div className="er-main">

        {/* Breadcrumb */}
        <div className="er-breadcrumb">
          <button className="er-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/sales-transactions")}>
            SALES &amp; TRANSACTIONS
          </span>
          <span>›</span>
          <span className="breadcrumb-current">EXPENSES RECORD</span>
        </div>

        {/* Toolbar */}
        <div className="er-toolbar">
          <button className="er-add-btn" onClick={() => navigate("/sales-transactions/expenses/add")}>
            <FiPlus /> Add Expense
          </button>

          <div className="er-toolbar-actions">
            <div className="er-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search expenses..."
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

                    {/* Category — dropdown */}
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

                    {/* Expense Date — chips (from records) */}
                    {dateOptions.length > 0 && (
                      <div className="er-filter-group">
                        <label className="er-filter-label">Expense Date</label>
                        <div className="er-filter-options">
                          <button
                            className={`er-filter-option ${filters.date === "All" ? "selected" : ""}`}
                            onClick={() => handleFilterChange("date", "All")}
                          >All</button>
                          {dateOptions.map((opt) => (
                            <button
                              key={opt}
                              className={`er-filter-option ${filters.date === opt ? "selected" : ""}`}
                              onClick={() => handleFilterChange("date", opt)}
                            >{opt}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Amount — chips */}
                    <div className="er-filter-group">
                      <label className="er-filter-label">Amount</label>
                      <div className="er-filter-options">
                        <button
                          className={`er-filter-option ${filters.amount === "All" ? "selected" : ""}`}
                          onClick={() => handleFilterChange("amount", "All")}
                        >All</button>
                        {AMOUNT_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            className={`er-filter-option ${filters.amount === opt ? "selected" : ""}`}
                            onClick={() => handleFilterChange("amount", opt)}
                          >{opt}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button className="er-toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="er-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="er-active-filter-tag">
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stats */}
        <div className="er-stats-grid">
          <div className="er-stat-card">
            <div className="er-stat-icon gold"><FiFileText /></div>
            <div>
              <h3>{records.length}</h3>
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

        {/* Table */}
        <div className="er-table-wrapper">
          <table className="er-table">
            <thead>
              <tr>
                <th>Expense Date</th>
                <th>Category</th>
                <th>Amount</th>
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
                filtered.map((r) => (
                  <tr key={r._id || r.id}>
                    <td>{r.date}</td>
                    <td>{r.category}</td>
                    <td className="er-amount">{formatPeso(r.amount)}</td>
                    <td>
                      {r.receipt
                        ? <a href={r.receipt} className="er-view-link" target="_blank" rel="noreferrer">View</a>
                        : "—"}
                    </td>
                    <td>{r.remarks || "—"}</td>
                    <td>
                      <div className="er-action-buttons">
                        <button
                          className="er-action-btn edit"
                          title="Edit"
                          onClick={() => navigate(`/sales-transactions/expenses/edit/${r._id || r.id}`)}
                        >
                          <FiEdit2 />
                        </button>
                        <button className="er-action-btn archive" title="Archive">
                          <FiArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="er-table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}