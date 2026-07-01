import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiGrid, FiUsers, FiHeart,
  FiCalendar, FiMaximize, FiMenu, FiX,
} from "react-icons/fi";
import { FaQrcode } from "react-icons/fa";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Flockprofile.css";

// Chickens arrive at 16 weeks; current age = 16 + weeks since arrival
function computeAgeWeeks(dateStr) {
  if (!dateStr) return "";
  const start = new Date(dateStr);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
}
function ageWeeksNum(dateStr) {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start)) return null;
  const w = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return 16 + w;
}

// Status → colored badge
function statusStyle(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("active"))      return { dot: "🟢", color: "#2e9e6b", bg: "#eaf7f1" };
  if (s.includes("quarantin"))   return { dot: "🟡", color: "#c8930c", bg: "#fdf3e3" };
  if (s.includes("observation")) return { dot: "🟠", color: "#e07b39", bg: "#fdf0e6" };
  if (s.includes("isolation"))   return { dot: "🔴", color: "#d94f4f", bg: "#fdf0f0" };
  if (s.includes("complet"))     return { dot: "⚫", color: "#444444", bg: "#ececec" };
  if (s.includes("cull"))        return { dot: "⚫", color: "#444444", bg: "#ececec" };
  if (s.includes("archiv"))      return { dot: "⚪", color: "#888888", bg: "#f4f4f4" };
  return { dot: "", color: "#666", bg: "#f0f0f0" };
}

// Derived (mortality-adjusted) values, ready for backend later
const computeFlock = (f) => {
  const pq = Number(f.quantityPurchased) || 0;
  const tm = f.totalMortality ?? (f.currentQuantity != null ? pq - Number(f.currentQuantity) : 0);
  const cb = f.currentQuantity != null ? Number(f.currentQuantity) : Math.max(0, pq - (Number(tm) || 0));
  const mr = f.mortalityRate != null ? Number(f.mortalityRate) : (pq > 0 ? ((Number(tm) || 0) / pq) * 100 : 0);
  return { cb, mr, ageW: ageWeeksNum(f.dateAcquired) };
};

const BREEDS = ["Hy-Line W-36", "Lohmann LSL Lite", "Dekalb White", "Shaver White", "Hendrix White"];
const AGE_RANGES = [
  { label: "All", value: "All" },
  { label: "16–20 weeks", value: "16-20" },
  { label: "21–30 weeks", value: "21-30" },
  { label: "31–40 weeks", value: "31-40" },
  { label: "41+ weeks",   value: "41-999" },
];

// Mock cage performance for the QR Summary preview (future backend data)
const MOCK_CAGES = [
  { cage: "Cage 1", birds: 4, eggs: 4, henDay: "100%",   health: "Healthy" },
  { cage: "Cage 2", birds: 4, eggs: 3, henDay: "75%",    health: "Healthy" },
  { cage: "Cage 3", birds: 3, eggs: 2, henDay: "66.67%", health: "Under Treatment" },
  { cage: "Cage 4", birds: 4, eggs: 4, henDay: "100%",   health: "Healthy" },
];

export default function FlockProfile() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    breed: "All", source: "All", status: "All", dateAcquired: "All", ageRange: "All",
  });
  const filterRef = useRef(null);
  const [qrFlock, setQrFlock] = useState(null); // QR Summary modal target
  const flocks = [];

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () =>
    setFilters({ breed: "All", source: "All", status: "All", dateAcquired: "All", ageRange: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const uniq = (vals) => [...new Set(vals.filter(Boolean))];
  const statusOptions = uniq(flocks.map((r) => r.status));
  const sourceOptions = uniq(flocks.map((r) => r.source));

  const inAgeRange = (ageW, range) => {
    if (range === "All" || ageW == null) return range === "All";
    const [min, max] = range.split("-").map(Number);
    return ageW >= min && ageW <= max;
  };

  let filtered = flocks.filter((r) => {
    const { ageW } = computeFlock(r);
    return (
      (r.batchId?.toLowerCase().includes(search.toLowerCase()) ||
        r.breed?.toLowerCase().includes(search.toLowerCase())) &&
      (filters.breed === "All" || r.breed === filters.breed) &&
      (filters.source === "All" || r.source === filters.source) &&
      (filters.status === "All" || r.status === filters.status) &&
      (filters.ageRange === "All" || inAgeRange(ageW, filters.ageRange))
    );
  });

  const StatusBadge = ({ status }) => {
    const st = statusStyle(status);
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: "5px",
        background: st.bg, color: st.color, padding: "3px 10px",
        borderRadius: "999px", fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap",
      }}>
        {st.dot} {status || "—"}
      </span>
    );
  };

  return (
    <div className="flock-page">
      <Sidebar />

      <div className="flock-main">

        <div className="flock-breadcrumb">
          <button className="flock-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/records")}>RECORDS</span>
          <span>›</span>
          <span className="breadcrumb-current">FLOCK PROFILE</span>
        </div>

        <div className="flock-toolbar">
          <button className="add-flock-btn" onClick={() => navigate("/records/flock/add")}>
            <FiPlus />
            Add New Flock
          </button>

          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search Flock..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-btn-group">
              <div className="flock-filter-wrap" ref={filterRef}>
                <button className="toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="flock-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="flock-filter-dropdown">
                    <div className="flock-filter-dropdown-header">
                      <span>Filter Flocks</span>
                      <button className="flock-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Breed</label>
                      <select className="flock-filter-select" value={filters.breed}
                        onChange={(e) => handleFilterChange("breed", e.target.value)}>
                        <option value="All">All Breeds</option>
                        {BREEDS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Source</label>
                      <select className="flock-filter-select" value={filters.source}
                        onChange={(e) => handleFilterChange("source", e.target.value)}>
                        <option value="All">All Sources</option>
                        {sourceOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Status</label>
                      <select className="flock-filter-select" value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}>
                        <option value="All">All Statuses</option>
                        {statusOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Age Range</label>
                      <select className="flock-filter-select" value={filters.ageRange}
                        onChange={(e) => handleFilterChange("ageRange", e.target.value)}>
                        {AGE_RANGES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button className="toolbar-btn"><FiDownload /> Export</button>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flock-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="flock-active-filter-tag">
                  {key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold"><FiGrid /></div>
            <div><h3>0</h3><p>Total Flock Records</p><span>All Time</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><FiUsers /></div>
            <div><h3>0</h3><p>Total Current Birds</p><span>All Records</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><FiHeart /></div>
            <div><h3>0%</h3><p>Average Mortality Rate</p><span>All Records</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><FiCalendar /></div>
            <div><h3>0</h3><p>Average Age (Days)</p><span>All Records</span></div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="flock-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Breed</th>
                <th>Source</th>
                <th>Date Acquired</th>
                <th>Purchase Qty</th>
                <th>Current Birds</th>
                <th>Mortality Rate</th>
                <th>Age</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="empty-state">
                    <div className="empty-content">
                      <FiMaximize />
                      <h3>No flock records found</h3>
                      <p>Click Add New Flock to create your first flock profile.</p>
                      <button className="empty-add-btn" onClick={() => navigate("/records/flock/add")}>
                        <FiPlus />
                        Add New Flock
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((flock) => {
                  const { cb, mr } = computeFlock(flock);
                  return (
                    <tr key={flock._id}>
                      <td>{flock.batchId}</td>
                      <td>{flock.breed}</td>
                      <td>{flock.source}</td>
                      <td>{flock.dateAcquired}</td>
                      <td>{flock.quantityPurchased}</td>
                      <td>{cb}</td>
                      <td>{typeof mr === "number" ? mr.toFixed(2) : mr}%</td>
                      <td>{computeAgeWeeks(flock.dateAcquired) || "—"}</td>
                      <td><StatusBadge status={flock.status} /></td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn edit" title="Edit"
                            onClick={() => navigate(`/records/flock/edit/${flock._id}`)}>
                            <FiEdit2 />
                          </button>
                          <button className="action-btn edit" title="View / Generate QR Code"
                            onClick={() => setQrFlock(flock)}>
                            <FaQrcode />
                          </button>
                          <button className="action-btn archive" title="Archive">
                            <FiArchive />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      </div>

      {/* ── Batch QR Summary (frontend placeholder modal) ── */}
      {qrFlock && (
        <div
          onClick={() => setQrFlock(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "14px", width: "min(760px, 100%)",
              maxHeight: "88vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            }}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 22px", borderBottom: "1px solid #eee",
              background: "#fdf3e3", borderRadius: "14px 14px 0 0",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FaQrcode style={{ color: "#c8930c", fontSize: "20px" }} />
                <h3 style={{ margin: 0, fontFamily: "Poppins, sans-serif", color: "#47321C", fontSize: "17px" }}>
                  Batch QR Summary
                </h3>
              </div>
              <button onClick={() => setQrFlock(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#47321C", fontSize: "20px" }}>
                <FiX />
              </button>
            </div>

            <div style={{ padding: "22px" }}>
              {/* QR placeholder + Batch Information */}
              <div style={{ display: "flex", gap: "22px", flexWrap: "wrap", marginBottom: "22px" }}>
                <div style={{
                  width: "140px", height: "140px", borderRadius: "12px",
                  border: "2px dashed #e4af1f", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", color: "#c8930c",
                  background: "#fffdf7", flexShrink: 0,
                }}>
                  <FaQrcode style={{ fontSize: "52px" }} />
                  <small style={{ marginTop: "6px", fontSize: "11px" }}>QR Placeholder</small>
                </div>

                <div style={{ flex: 1, minWidth: "260px" }}>
                  {(() => {
                    const { cb, mr } = computeFlock(qrFlock);
                    const st = statusStyle(qrFlock.status);
                    const rows = [
                      ["Batch ID", qrFlock.batchId || "—"],
                      ["Breed", qrFlock.breed || "—"],
                      ["Source", qrFlock.source || "—"],
                      ["Date Acquired", qrFlock.dateAcquired || "—"],
                      ["Purchase Quantity", qrFlock.quantityPurchased ?? "—"],
                      ["Current Birds", cb],
                      ["Age", computeAgeWeeks(qrFlock.dateAcquired) || "—"],
                      ["Overall Production Rate", "—"],
                      ["Overall Mortality Rate", `${typeof mr === "number" ? mr.toFixed(2) : mr}%`],
                    ];
                    return (
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                        <tbody>
                          {rows.map(([k, v]) => (
                            <tr key={k}>
                              <td style={{ padding: "5px 8px", color: "#6b6457", fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td>
                              <td style={{ padding: "5px 8px", color: "#1e1c18" }}>{v}</td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ padding: "5px 8px", color: "#6b6457", fontWeight: 600 }}>Current Status</td>
                            <td style={{ padding: "5px 8px" }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: "5px",
                                background: st.bg, color: st.color, padding: "3px 10px",
                                borderRadius: "999px", fontWeight: 600, fontSize: "12px",
                              }}>
                                {st.dot} {qrFlock.status || "—"}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>

              {/* Cage Performance Summary (mock) */}
              <h4 style={{ margin: "0 0 10px", fontFamily: "Poppins, sans-serif", color: "#47321C", fontSize: "14px" }}>
                Cage Performance Summary
              </h4>
              <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: "10px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "480px" }}>
                  <thead>
                    <tr style={{ background: "#fdf3e3", color: "#47321C" }}>
                      <th style={{ padding: "10px", textAlign: "left" }}>Cage</th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Current Birds</th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Today's Eggs</th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Hen-Day %</th>
                      <th style={{ padding: "10px", textAlign: "left" }}>Health Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_CAGES.map((c) => (
                      <tr key={c.cage} style={{ borderTop: "1px solid #f0f0f0" }}>
                        <td style={{ padding: "10px" }}>{c.cage}</td>
                        <td style={{ padding: "10px" }}>{c.birds}</td>
                        <td style={{ padding: "10px" }}>{c.eggs}</td>
                        <td style={{ padding: "10px" }}>{c.henDay}</td>
                        <td style={{ padding: "10px" }}>
                          <span style={{
                            background: c.health === "Healthy" ? "#eaf7f1" : "#fdf0e6",
                            color: c.health === "Healthy" ? "#2e9e6b" : "#e07b39",
                            padding: "3px 10px", borderRadius: "999px", fontWeight: 600, fontSize: "12px",
                          }}>{c.health}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ marginTop: "14px", fontSize: "12px", color: "#a39e94" }}>
                Preview only — cage performance will be pulled from Egg, Health, Mortality, and Isolation records after backend integration.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}