import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload, FiEdit2, FiArchive,
  FiGrid, FiArrowDown, FiArrowUp, FiBox, FiMaximize, FiMenu,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import ExportMenu from "../components/ExportMenu";
import "./FeedInventory.css";
import { archiveRow } from "../archiveRow";

const FEED_TYPE_OPTIONS = ["Grower Feed", "Layer Feed"];
const BASE_URL = "https://poultrybiz.onrender.com/api/v1";
// Configurable stock thresholds (kg) — adjust to your farm's needs
const LOW_STOCK_THRESHOLD = 100;
const CRITICAL_STOCK_THRESHOLD = 50;

export default function FeedInventory() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState([]);
  const [consumed, setConsumed] = useState({}); // { feedType: totalConsumedKg }

  // Pull feed inventory records + sum Feed Consumption per feed type (drives Quantity Out)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    const norm = (j) => j.data || j.records || j.flocks || (Array.isArray(j) ? j : []);

    fetch(`${BASE_URL}/feed-inventory`, { headers })
      .then((r) => r.json())
      .then((j) => setRecords(norm(j)))
      .catch(() => setRecords([]));

    fetch(`${BASE_URL}/feed-consumption`, { headers })
      .then((r) => r.json())
      .then((j) => {
        const map = {};
        norm(j).forEach((c) => {
          const t = c.feedType;
          if (!t) return;
          map[t] = (map[t] || 0) + (Number(c.quantityConsumed) || 0);
        });
        setConsumed(map);
      })
      .catch(() => setConsumed({}));
  }, []);

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

  // Quantity Out auto-updates from Feed Consumption; Balance = Quantity In − Quantity Out
  const displayRecords = records.map((r) => {
    const inn = Number(r.quantityIn) || 0;
    const out = consumed[r.feedType] != null ? consumed[r.feedType] : (Number(r.quantityOut) || 0);
    return { ...r, quantityOut: out, balance: inn - out };
  });

  const filtered = displayRecords.filter((r) => {
    const matchSearch =
      r.feedType?.toLowerCase().includes(search.toLowerCase()) ||
      r.notes?.toLowerCase().includes(search.toLowerCase());
    const matchType = filters.feedType === "All" || r.feedType === filters.feedType;
    return matchSearch && matchType;
  });

  // ── Stats ──
  const totalRecords = displayRecords.length;
  const totalIn = displayRecords.reduce((s, r) => s + (Number(r.quantityIn) || 0), 0);
  const totalOut = displayRecords.reduce((s, r) => s + (Number(r.quantityOut) || 0), 0);
  const balance = totalIn - totalOut;

  // ── Low / Critical stock alerts (per feed type, vs thresholds) ──
  const balanceByType = {};
  displayRecords.forEach((r) => {
    if (!r.feedType) return;
    balanceByType[r.feedType] = (balanceByType[r.feedType] || 0) + (Number(r.balance) || 0);
  });
  const criticalTypes = Object.entries(balanceByType)
    .filter(([, b]) => b <= CRITICAL_STOCK_THRESHOLD)
    .map(([t]) => t);
  const lowTypes = Object.entries(balanceByType)
    .filter(([, b]) => b > CRITICAL_STOCK_THRESHOLD && b <= LOW_STOCK_THRESHOLD)
    .map(([t]) => t);

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
          <span className="breadcrumb-current">FEED INVENTORY</span>
        </div>

        <div className="fi-toolbar">
          <button className="add-fi-btn" onClick={() => navigate("/inventory/feed-inventory/add")}>
            <FiPlus />
            Add New Feeds
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

              <ExportMenu rows={filtered} name="feed-inventory" title="Feed Inventory" className="toolbar-btn" />
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

        {/* Low / Critical Stock Alerts */}
        {criticalTypes.length > 0 && (
          <div style={{ background: "#fdf0f0", color: "#c0392b", border: "1.5px solid #f5c6c6",
            borderRadius: "12px", padding: "12px 16px", fontFamily: "var(--font-body)", fontSize: "13px",
            fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            ⛔ Critical Stock: {criticalTypes.join(", ")} at or below {CRITICAL_STOCK_THRESHOLD} kg. Restock immediately.
          </div>
        )}
        {lowTypes.length > 0 && (
          <div style={{ background: "#fff8e1", color: "#856404", border: "1.5px solid #ffe08a",
            borderRadius: "12px", padding: "12px 16px", fontFamily: "var(--font-body)", fontSize: "13px",
            fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
            ⚠️ Low Stock: {lowTypes.join(", ")} at or below {LOW_STOCK_THRESHOLD} kg. Consider restocking soon.
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
                <th>Date Purchased</th>
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
                      <p>Click Add New Feeds to record your first transaction.</p>
                      <button className="empty-add-btn" onClick={() => navigate("/inventory/feed-inventory/add")}>
                        <FiPlus />
                        Add New Feeds
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
                        <button className="action-btn archive" onClick={() => archiveRow({ module: "Feed Inventory", moduleKey: "pb_feed_inventory", record: r, name: r.feedType || r.name })} title="Archive">
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
