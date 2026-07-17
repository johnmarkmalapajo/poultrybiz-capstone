import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus, FiSearch, FiFilter, FiDownload,
  FiEdit2, FiArchive, FiGrid, FiUsers, FiHeart,
  FiCalendar, FiMaximize, FiX,
} from "react-icons/fi";
import { FaQrcode } from "react-icons/fa";
import PageLayout from "../components/PageLayout";
import ExportMenu from "../components/ExportMenu";
import batchStore from "../batchStore";
import { activity } from "../activity";
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
const STATUSES = ["Active", "Quarantined", "Completed", "Culled"];
const AGE_RANGES = [
  { label: "All", value: "All" },
  { label: "16–20 weeks", value: "16-20" },
  { label: "21–30 weeks", value: "21-30" },
  { label: "31–40 weeks", value: "31-40" },
  { label: "41+ weeks",   value: "41-999" },
];

export default function FlockProfile() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({
    breed: "All", status: "All", dateFrom: "", dateTo: "", ageRange: "All",
  });
  const filterRef = useRef(null);
  const [qrFlock, setQrFlock] = useState(null); // QR Summary modal target
  const [, forceRefresh] = useState(0);          // bump to re-read after delete
  const flocks = batchStore.getBatches();

  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () =>
    setFilters({ breed: "All", status: "All", dateFrom: "", dateTo: "", ageRange: "All" });
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => v && v !== "All").length;

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
      (filters.status === "All" || r.status === filters.status) &&
      (!filters.dateFrom || r.dateAcquired >= filters.dateFrom) &&
      (!filters.dateTo || r.dateAcquired <= filters.dateTo) &&
      (filters.ageRange === "All" || inAgeRange(ageW, filters.ageRange))
    );
  });

  const StatusBadge = ({ status }) => {
    const st = statusStyle(status);
    return (
      <span style={{
        display: "inline-flex", alignItems: "center",
        background: st.bg, color: st.color, padding: "3px 12px",
        borderRadius: "999px", fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap",
      }}>
        {status || "—"}
      </span>
    );
  };

  // ── Live stats computed from the actual flock records ──
  const stats = (() => {
    const n = flocks.length;
    let birds = 0, mrSum = 0, ageDaysSum = 0;
    flocks.forEach((f) => {
      const { cb, mr, ageW } = computeFlock(f);
      birds += cb;
      mrSum += mr;
      ageDaysSum += (ageW || 0) * 7;
    });
    return {
      total: n,
      birds,
      avgMortality: n ? mrSum / n : 0,
      avgAge: n ? Math.round(ageDaysSum / n) : 0,
    };
  })();

  // Archive a flock immediately (no confirmation) — it moves to the Archive
  // page; permanent delete exists only inside Archive.
  const handleArchive = (flock) => {
    activity.archived({
      module: "Flock Profile",
      recordName: flock.batchId || "Flock",
      moduleKey: "pb_batches",
      payload: flock,
      user: "Admin",
    });
    batchStore.deleteBatch(flock.batchId || flock._id);
    forceRefresh((n) => n + 1);
  };

  // Download a print-ready QR image: Batch ID on top + QR code below,
  // centered on a clean white card (for labeling poultry cages).
  const downloadQR = async (batchId) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(`${window.location.origin}/batch-summary/${batchId}`)}`;
    try {
      // Fetch as blob so the canvas stays untainted (same-origin object URL)
      const res = await fetch(qrUrl);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = objUrl; });

      // ── Layout (golden-ratio-inspired spacing, PoultryBiz identity) ──
      const W = 620, QR = 520;
      const TOP_BAR = 10;      // gold accent bar
      const HEAD_H = 150;      // Batch ID area
      const GAP_BOTTOM = 42;   // space below QR
      const BRAND_H = 48;      // small brand footer
      const H = HEAD_H + QR + GAP_BOTTOM + BRAND_H;

      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");

      // White card
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      // Gold top bar
      ctx.fillStyle = "#E4AF1F";
      ctx.fillRect(0, 0, W, TOP_BAR);

      // Batch ID — Poppins bold, brown, centered
      ctx.fillStyle = "#47321C";
      ctx.font = "700 56px Poppins, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(batchId, W / 2, TOP_BAR + (HEAD_H - TOP_BAR) / 2 + 4);

      // QR code — centered directly below the Batch ID
      ctx.drawImage(img, (W - QR) / 2, HEAD_H, QR, QR);
      URL.revokeObjectURL(objUrl);

      // Small brand footer
      ctx.fillStyle = "#a39e94";
      ctx.font = "600 22px Poppins, Arial, sans-serif";
      ctx.fillText("PoultryBiz", W / 2, HEAD_H + QR + GAP_BOTTOM + BRAND_H / 2 - 10);

      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `QR-${batchId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(qrUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "RECORDS", path: "/records" },
        { label: "FLOCK PROFILE" },
      ]}
    >
        {/* Toolbar */}
        <div className="fp-toolbar">
          <button className="fp-add-btn" onClick={() => navigate("/records/flock/add")}>
            <FiPlus /> Add New Flock
          </button>
          <div className="fp-toolbar-right">
            <div className="fp-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="fp-btn-group">
              <div className="fp-filter-wrap" ref={filterRef}>
                <button className="fp-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="fp-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="fp-filter-dropdown">
                    <div className="fp-filter-dropdown-header">
                      <span>Filter Flocks</span>
                      <button className="fp-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="fp-filter-group">
                      <label className="fp-filter-label">Breed</label>
                      <select
                        className="fp-filter-select"
                        value={filters.breed}
                        onChange={(e) => handleFilterChange("breed", e.target.value)}
                      >
                        <option value="All">All Breeds</option>
                        {BREEDS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className="fp-filter-group">
                      <label className="fp-filter-label">Status</label>
                      <select
                        className="fp-filter-select"
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        {STATUSES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>

                    <div className="fp-filter-group">
                      <label className="fp-filter-label">Date Acquired Range</label>
                      <div className="fp-filter-date-range">
                        <input type="date" className="fp-filter-select" value={filters.dateFrom}
                          onChange={(e) => handleFilterChange("dateFrom", e.target.value)} aria-label="From date" />
                        <span>to</span>
                        <input type="date" className="fp-filter-select" value={filters.dateTo}
                          onChange={(e) => handleFilterChange("dateTo", e.target.value)} aria-label="To date" />
                      </div>
                    </div>

                    <div className="fp-filter-group">
                      <label className="fp-filter-label">Age Range</label>
                      <select
                        className="fp-filter-select"
                        value={filters.ageRange}
                        onChange={(e) => handleFilterChange("ageRange", e.target.value)}
                      >
                        {AGE_RANGES.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <ExportMenu rows={filtered} name="flock-profiles" title="Flock Profiles" className="fp-toolbar-btn" />
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="fp-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value && value !== "All" ? (
                <span key={key} className="fp-active-filter-tag">
                  {key === "dateFrom" ? "From" : key === "dateTo" ? "To" : key.charAt(0).toUpperCase() + key.slice(1)}: {value}
                  <button onClick={() => handleFilterChange(key, key === "dateFrom" || key === "dateTo" ? "" : "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="fp-stats-grid">
          <div className="fp-stat-card">
            <div className="fp-stat-icon gold"><FiGrid /></div>
            <div>
              <h3>{stats.total}</h3>
              <p>Total Flock Records</p>
              <span>All Time</span>
            </div>
          </div>
          <div className="fp-stat-card">
            <div className="fp-stat-icon green"><FiUsers /></div>
            <div>
              <h3>{stats.birds.toLocaleString()}</h3>
              <p>Total Current Birds</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="fp-stat-card">
            <div className="fp-stat-icon red"><FiHeart /></div>
            <div>
              <h3>{stats.avgMortality.toFixed(1)}%</h3>
              <p>Average Mortality Rate</p>
              <span>All Records</span>
            </div>
          </div>
          <div className="fp-stat-card">
            <div className="fp-stat-icon blue"><FiCalendar /></div>
            <div>
              <h3>{stats.avgAge}</h3>
              <p>Average Age (Days)</p>
              <span>All Records</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="fp-table-wrapper">
          <table className="fp-table">
            <thead>
              <tr>
                <th>BATCH ID</th>
                <th>BREED</th>
                <th>SOURCE</th>
                <th>DATE ACQUIRED</th>
                <th>PURCHASE QTY</th>
                <th>CURRENT BIRDS</th>
                <th>MORTALITY RATE</th>
                <th>AGE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="fp-empty-state">
                    <div className="fp-empty-content">
                      <FiMaximize />
                      <h3>No flock records found</h3>
                      <p>Click Add New Flock to create your first flock profile.</p>
                      <button className="fp-empty-add-btn" onClick={() => navigate("/records/flock/add")}>
                        <FiPlus /> Add New Flock
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((flock) => {
                  const { cb, mr } = computeFlock(flock);
                  return (
                    <tr key={flock._id || flock.batchId}>
                      <td><span className="fp-batch-badge">{flock.batchId}</span></td>
                      <td>{flock.breed}</td>
                      <td>{flock.source}</td>
                      <td>{flock.dateAcquired}</td>
                      <td>{flock.quantityPurchased}</td>
                      <td>{cb}</td>
                      <td>{typeof mr === "number" ? mr.toFixed(2) : mr}%</td>
                      <td>{computeAgeWeeks(flock.dateAcquired) || "—"}</td>
                      <td><StatusBadge status={flock.status} /></td>
                      <td>
                        <div className="fp-actions">
                          <button className="fp-btn-edit" title="Edit"
                            onClick={() => navigate(`/records/flock/edit/${flock._id || flock.batchId}`)}>
                            <FiEdit2 />
                          </button>
                          <button className="fp-btn-edit" title="View / Generate QR Code"
                            onClick={() => setQrFlock(flock)}>
                            <FaQrcode />
                          </button>
                          <button className="fp-btn-archive" title="Archive" onClick={() => handleArchive(flock)}>
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
          <div className="fp-table-footer">
            Showing {filtered.length} entries
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
              background: "#fff", borderRadius: "14px", width: "min(360px, 92vw)",
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
                  Batch QR Code
                </h3>
              </div>
              <button onClick={() => setQrFlock(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#47321C", fontSize: "20px" }}>
                <FiX />
              </button>
            </div>

            <div style={{ padding: "26px 22px", textAlign: "center" }}>
              <div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`${window.location.origin}/batch-summary/${qrFlock.batchId}`)}`}
                  alt={`QR code for ${qrFlock.batchId}`}
                  style={{ width: "220px", height: "220px", borderRadius: "12px", border: "1px solid #e4e0d8", padding: "10px", background: "#fff" }}
                />
              </div>

              <div style={{ marginTop: "14px", fontFamily: "Poppins, sans-serif", fontWeight: 700, color: "#47321C", fontSize: "16px" }}>
                {qrFlock.batchId}
              </div>
              <p style={{ margin: "6px 0 20px", fontSize: "12px", color: "#a39e94" }}>
                Scan this QR code with a mobile device to open this batch's summary.
              </p>

              <button
                onClick={() => downloadQR(qrFlock.batchId)}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#E4AF1F", color: "#fff", border: "none", borderRadius: "10px", padding: "11px 26px", fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}
              >
                <FiDownload /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}