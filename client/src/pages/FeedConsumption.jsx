import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload, FiEdit2, FiArchive,
  FiGrid, FiPackage, FiUsers, FiLayers, FiMaximize, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./FeedConsumption.css";

const FEED_TYPE_OPTIONS = ["Starter Feed", "Grower Feed", "Layer Feed", "Finisher Feed"];

export default function FeedConsumption() {
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
      r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.feedType?.toLowerCase().includes(search.toLowerCase()) ||
      r.notes?.toLowerCase().includes(search.toLowerCase());
    const matchType = filters.feedType === "All" || r.feedType === filters.feedType;
    return matchSearch && matchType;
  });

  // ── Stats ──
  const totalRecords = records.length;
  const totalConsumed = records.reduce((s, r) => s + (Number(r.quantityConsumed) || 0), 0);
  const batchesFed = new Set(records.map((r) => r.batchId).filter(Boolean)).size;
  const feedTypesUsed = new Set(records.map((r) => r.feedType).filter(Boolean)).size;

  return (
    <div className="fc-page">
      <Sidebar />

      <div className="fc-main">

        <div className="fc-breadcrumb">
          <button className="fc-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/inventory")}>INVENTORY</span>
          <span>›</span>
          <span className="breadcrumb-current">FEED CONSUMPTION</span>
        </div>

        <div className="fc-toolbar">
          <button className="add-fc-btn" onClick={() => navigate("/inventory/feed-consumption/add")}>
            <FiPlus />
            Add Feed Consumption
          </button>

          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search consumption..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-btn-group">
              {/* Filter — inline dropdown (Expenses-style) */}
              <div className="fc-filter-wrap" ref={filterRef}>
                <button className="toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="fc-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="fc-filter-dropdown">
                    <div className="fc-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="fc-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="fc-filter-group">
                      <label className="fc-filter-label">Feed Type</label>
                      <select
                        className="fc-filter-select"
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
          <div className="fc-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="fc-active-filter-tag">
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
            <div className="stat-icon green"><FiPackage /></div>
            <div>
              <h3>{totalConsumed} kg</h3>
              <p>Total Consumed</p>
              <span>All Records</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue"><FiUsers /></div>
            <div>
              <h3>{batchesFed}</h3>
              <p>Batches Fed</p>
              <span>Unique Batches</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon red"><FiLayers /></div>
            <div>
              <h3>{feedTypesUsed}</h3>
              <p>Feed Types Used</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="fc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Batch ID</th>
                <th>Feed Type</th>
                <th>Quantity Consumed</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-content">
                      <FiMaximize />
                      <h3>No feed consumption records found</h3>
                      <p>Click Add Feed Consumption to record your first entry.</p>
                      <button className="empty-add-btn" onClick={() => navigate("/inventory/feed-consumption/add")}>
                        <FiPlus />
                        Add Feed Consumption
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>{r.batchId}</td>
                    <td>{r.feedType}</td>
                    <td><strong>{r.quantityConsumed} kg</strong></td>
                    <td>{r.notes}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="action-btn edit"
                          title="Edit"
                          onClick={() => {
                            localStorage.setItem("editFeedConsumption", JSON.stringify(r));
                            navigate(`/inventory/feed-consumption/edit/${r.id}`);
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