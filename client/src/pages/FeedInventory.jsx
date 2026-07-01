import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload, FiEdit2, FiArchive,
  FiGrid, FiArrowDown, FiArrowUp, FiBox, FiMaximize, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./FeedInventory.css";

const FEED_TYPE_OPTIONS = ["Starter Feed", "Grower Feed", "Layer Feed", "Finisher Feed"];

export default function FeedInventory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [records] = useState([]);

  // ── Filter (Expenses-style inline dropdown) ──
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ feedType: "All" });
  const filterRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ feedType: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const filtered = records.filter((r) => {
    const matchSearch =
      r.feedType?.toLowerCase().includes(search.toLowerCase()) ||
      r.notes?.toLowerCase().includes(search.toLowerCase());
    const matchType = filters.feedType === "All" || r.feedType === filters.feedType;
    return matchSearch && matchType;
  });

  // ── Stats ──
  const totalRecords = records.length;
  const totalIn = records.reduce((s, r) => s + (Number(r.quantityIn) || 0), 0);
  const totalOut = records.reduce((s, r) => s + (Number(r.quantityOut) || 0), 0);
  const balance = totalIn - totalOut;

  return (
    <div className="fi-page">
      <Sidebar />

      <div className="fi-main">

        <div className="fi-breadcrumb">
          <button className="fi-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-current">FEED STOCK</span>
        </div>

        <div className="fi-toolbar">
          <button className="add-fi-btn" onClick={() => navigate("/inventory/feed-inventory/add")}>
            <FiPlus />
            Add Feed Stock
          </button>

          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search feed stock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-btn-group">
              {/* Filter — inline dropdown (Expenses-style) */}
              <div className="fi-filter-wrap" ref={filterRef}>
                <button className="toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="fi-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="fi-filter-dropdown">
                    <div className="fi-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="fi-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="fi-filter-group">
                      <label className="fi-filter-label">Feed Type</label>
                      <select
                        className="fi-filter-select"
                        value={filters.feedType}
                        onChange={(e) => handleFilterChange("feedType", e.target.value)}
                      >
                        <option value="All">All Feed Types</option>
                        {FEED_TYPE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button className="toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="fi-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="fi-active-filter-tag">
                  {key === "feedType" ? "Feed Type" : key}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold"><FiGrid /></div>
            <div>
              <h3>{totalRecords}</h3>
              <p>Total Records</p>
              <span>All Time</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green"><FiArrowDown /></div>
            <div>
              <h3>{totalIn} kg</h3>
              <p>Total Quantity In</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon red"><FiArrowUp /></div>
            <div>
              <h3>{totalOut} kg</h3>
              <p>Total Quantity Out</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue"><FiBox /></div>
            <div>
              <h3>{balance} kg</h3>
              <p>Current Balance</p>
              <span>In − Out</span>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="fi-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Feed Type</th>
                <th>Quantity In</th>
                <th>Quantity Out</th>
                <th>Balance</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    <div className="empty-content">
                      <FiMaximize />
                      <h3>No feed stock records found</h3>
                      <p>Click Add Feed Stock to record your first transaction.</p>
                      <button className="empty-add-btn" onClick={() => navigate("/inventory/feed-inventory/add")}>
                        <FiPlus />
                        Add Feed Stock
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.feedType}</td>
                    <td>{r.quantityIn} kg</td>
                    <td>{r.quantityOut} kg</td>
                    <td><strong>{r.balance} kg</strong></td>
                    <td>{r.notes}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn edit"
                          title="Edit"
                          onClick={() => {
                            localStorage.setItem("editFeedRecord", JSON.stringify(r));
                            navigate(`/inventory/feed-inventory/edit/${r.id}`);
                          }}
                        >
                          <FiEdit2 />
                        </button>
                        <button className="action-btn archive" title="Archive">
                          <FiArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>
    </div>
  );
}