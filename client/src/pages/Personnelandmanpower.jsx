import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiFilter, FiDownload,
  FiEye, FiArchive, FiMenu, FiMaximize, FiX,
} from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";
import { MdPeople, MdPerson, MdPersonOff, MdPersonAdd } from "react-icons/md";
import Sidebar, { openSidebar } from "../components/Sidebar";
import { getFarmerProfile } from "./FarmerProfile";
import { exportCsvTable, exportExcel, exportPdf } from "../exportTable";
import "./PersonnelandManpower.css";
import { archiveRow } from "../archiveRow";

// Overlay the Farmer's own My Profile (pic/name/contact/email) onto their
// Personnel record — these fields are managed by the Farmer, read-only here.
const syncFarmerProfile = (list) => {
  let fp;
  try { fp = getFarmerProfile(); } catch { return list; }
  if (!fp) return list;
  let matched = false;
  const overlay = (r) => ({
    ...r,
    profile: { ...(r.profile || {}), fullName: fp.fullName, contactNumber: fp.phone, email: fp.email, image: fp.avatar },
  });
  let out = list.map((r) => {
    const p = r.profile || {};
    if (!matched && (p.email === fp.email || p.fullName === fp.fullName)) { matched = true; return overlay(r); }
    return r;
  });
  if (!matched) {
    out = out.map((r) => {
      if (!matched && /farmer/i.test(r.accountRole || r.role || "")) { matched = true; return overlay(r); }
      return r;
    });
  }
  return out;
};
// ── Inline mock data (frontend fallback until the API is wired) ──

const API_BASE = `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/personnel`;
const STATUS_OPTIONS = ["Active", "Inactive", "On Leave"];

// ── Field accessors ──
// From the Farmer's My Profile: Full Name, Contact Number, and Image only.
// Everything else (position, date hired, shift, status, remarks) is the
// Admin-managed Personnel record.
const prof = (r) => r.profile || r.myProfile || r.user || r; // profile source (flat fallback)
const getId = (r) => r._id || r.id;
const getName = (r) => {
  const p = prof(r);
  return p.fullName || p.name || [p.firstName, p.lastName].filter(Boolean).join(" ") || r.employeeName || "—";
};
const getContact = (r) => {
  const p = prof(r);
  return p.contactNumber || p.contact || p.phone || p.mobile || p.phoneNumber || "—";
};
const getImage = (r) => {
  const p = prof(r);
  return p.image || p.photo || p.avatar || p.profilePicture || p.profileImage || "";
};
const getInitials = (name) =>
  (name && name !== "—" ? name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
// ── Personnel-record fields (Admin-managed, NOT from My Profile) ──
const getAccountRole = (r) => r.accountRole || r.userRole || r.userType || r.role || "";
const isOwnerAdmin = (r) => /owner|admin/i.test(getAccountRole(r));
const getPosition = (r) =>
  r.position || r.jobTitle || r.designation || r.jobRole || (isOwnerAdmin(r) ? getAccountRole(r) : "") || "—";
const getHired = (r) =>
  r.dateHired || r.hired || r.dateJoined || (r.createdAt ? String(r.createdAt).slice(0, 10) : "—");
const getShift = (r) => r.shiftHours || r.shift || r.dutyHours || "—";
const getStatus = (r) => r.status || "Active";
const getRemarks = (r) => r.remarks || r.notes || "—";
const getAssignedWork = (r) => r.assignedWork || r.assignedTask || "";

// Avatar (profile image) cell — image comes from the Farmer's My Profile
const NameCell = ({ r }) => (
  <div className="pm-name-cell">
    {getImage(r) ? (
      <img className="pm-avatar" src={getImage(r)} alt="" />
    ) : (
      <span className="pm-avatar pm-avatar-fallback">{getInitials(getName(r))}</span>
    )}
    <span>{getName(r)}</span>
  </div>
);

export default function PersonnelManpower() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("farmers");

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── QR Attendance ──
  const [qrOpen, setQrOpen] = useState(false);

  // ── Filter (inline dropdown, matches other pages) ──
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({ status: "All" });
  const filterRef = useRef(null);

  // Personnel are created automatically once an account is registered and
  // approved by the Admin/Owner — so this page only reads existing records.
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(API_BASE, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.records || data.data || [];
        setRecords(syncFarmerProfile(list));
      } catch {
        setRecords(syncFarmerProfile([]));
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  useEffect(() => {
    const handle = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleFilterChange = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters({ status: "All" });
  const activeFilterCount = Object.values(filters).filter((v) => v !== "All").length;

  const matches = (r) => {
    const q = search.toLowerCase();
    const matchSearch =
      getName(r).toLowerCase().includes(q) ||
      getPosition(r).toLowerCase().includes(q) ||
      getRemarks(r).toLowerCase().includes(q);
    const matchStatus = filters.status === "All" || getStatus(r) === filters.status;
    return matchSearch && matchStatus;
  };

  // Owners/Admins sit in their own table; farmers in the main roster
  const owners = records.filter(isOwnerAdmin).filter(matches);
  const farmers = records.filter((r) => !isOwnerAdmin(r)).filter(matches);

  // ── Stats (from the personnel workforce / farmers) ──
  const farmerAll = records.filter((r) => !isOwnerAdmin(r));
  const total = farmerAll.length;
  const activeCount = farmerAll.filter((r) => getStatus(r) === "Active").length;
  const inactiveCount = farmerAll.filter((r) => getStatus(r) === "Inactive").length;
  const onLeaveCount = farmerAll.filter((r) => getStatus(r) === "On Leave").length;

  const [exportOpen, setExportOpen] = useState(false);
  // ── Export current view (CSV / Excel / PDF) ──
  const getExportData = () => {
    const isOwnerTab = activeTab === "owner";
    const rows = isOwnerTab ? owners : farmers;
    const headers = isOwnerTab
      ? ["Full Name", "Contact Number", "Role", "Status"]
      : ["Full Name", "Contact Number", "Position", "Date Hired", "Shift", "Status", "Assigned Work", "Remarks"];
    const data = rows.map((r) =>
      isOwnerTab
        ? [getName(r), getContact(r), getAccountRole(r) || "Owner", getStatus(r)]
        : [getName(r), getContact(r), getPosition(r), getHired(r), getShift(r), getStatus(r), getAssignedWork(r) || "—", getRemarks(r)]
    );
    const name = `personnel-${isOwnerTab ? "owner-admin" : "farmers"}`;
    return { headers, data, name };
  };
  const doExport = (kind) => {
    const { headers, data, name } = getExportData();
    if (kind === "excel") exportExcel(name, headers, data);
    else if (kind === "pdf") exportPdf(name, headers, data, "Personnel & Manpower");
    else exportCsvTable(name, headers, data);
    setExportOpen(false);
  };

  // ── QR Attendance: ONE shared station QR. Scanning it opens the public
  // check-in page (/attendance/check-in), where the personnel checks in.
  // The single station QR opens the public check-in page when scanned.
  const CHECKIN_URL =
    (typeof window !== "undefined" ? window.location.origin : "") + "/attendance/check-in";
  const STATION_QR =
    "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
    encodeURIComponent(CHECKIN_URL);

  const statusBadge = (status) => (
    <span className={`status ${String(status).toLowerCase().replace(" ", "-")}`}>{status}</span>
  );

  return (
    <div className="pm-page">
      <Sidebar />

      <div className="pm-main">

        {/* Breadcrumb */}
        <div className="pm-breadcrumb">
          <button className="pm-hamburger" onClick={openSidebar} aria-label="Open menu">
            <FiMenu />
          </button>
          <span className="breadcrumb-link" onClick={() => navigate("/personnel-visitors")}>PERSONNEL AND VISITORS</span>
          <span>›</span>
          <span className="breadcrumb-current">PERSONNEL RECORDS</span>
        </div>

        {/* Toolbar (no Add — personnel are added automatically on account approval) */}
        <div className="pm-toolbar">
          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search personnel..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="toolbar-btn-group">
              <div className="pm-filter-wrap" ref={filterRef}>
                <button className="toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="pm-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="pm-filter-dropdown">
                    <div className="pm-filter-dropdown-header">
                      <span>Filter Records</span>
                      <button className="pm-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>

                    <div className="pm-filter-group">
                      <label className="pm-filter-label">Status</label>
                      <select
                        className="pm-filter-select"
                        value={filters.status}
                        onChange={(e) => handleFilterChange("status", e.target.value)}
                      >
                        <option value="All">All Statuses</option>
                        {STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button className="toolbar-btn" onClick={() => setQrOpen(true)}><BsQrCode /> QR Generation</button>
              <div style={{ position: "relative", display: "inline-block" }}>
                <button className="toolbar-btn" onClick={() => setExportOpen((o) => !o)}>
                  <FiDownload /> Export ▾
                </button>
                {exportOpen && (
                  <>
                    <div onClick={() => setExportOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                    <div style={{
                      position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41,
                      background: "#fff", border: "1px solid #e4e0d8", borderRadius: 12,
                      boxShadow: "0 8px 26px rgba(0,0,0,0.12)", overflow: "hidden", minWidth: 180,
                      fontFamily: "Poppins, sans-serif",
                    }}>
                      {[
                        { k: "excel", label: "Excel (.xls)", ico: "📊" },
                        { k: "pdf", label: "PDF", ico: "📄" },
                        { k: "csv", label: "CSV", ico: "🗒️" },
                      ].map((opt) => (
                        <button key={opt.k} onClick={() => doExport(opt.k)} style={{
                          display: "flex", alignItems: "center", gap: 10, width: "100%",
                          padding: "11px 16px", border: "none", background: "none", cursor: "pointer",
                          fontFamily: "Poppins, sans-serif", fontSize: 13, fontWeight: 600, color: "#47321C", textAlign: "left",
                        }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#fdf3e3")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                          <span>{opt.ico}</span> {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilterCount > 0 && (
          <div className="pm-active-filters">
            {Object.entries(filters).map(([key, value]) =>
              value !== "All" ? (
                <span key={key} className="pm-active-filter-tag">
                  {{ status: "Status", position: "Position", shift: "Shift", task: "Task" }[key] || key}: {value}
                  <button onClick={() => handleFilterChange(key, "All")}>✕</button>
                </span>
              ) : null
            )}
          </div>
        )}

        {/* Stat Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold"><MdPeople /></div>
            <div>
              <h3>{total}</h3>
              <p>Total Personnel</p>
              <span>All Registered</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green"><MdPerson /></div>
            <div>
              <h3>{activeCount}</h3>
              <p>Active</p>
              <span>Currently Employed</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue"><MdPersonOff /></div>
            <div>
              <h3>{inactiveCount}</h3>
              <p>Inactive</p>
              <span>Not Currently Active</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple"><MdPersonAdd /></div>
            <div>
              <h3>{onLeaveCount}</h3>
              <p>On Leave</p>
              <span>Currently On Leave</span>
            </div>
          </div>
        </div>

        {/* Tabs (Quarantine/Isolation style) */}
        <div className="pm-tabs">
          <button
            className={`pm-tab ${activeTab === "farmers" ? "active" : ""}`}
            onClick={() => setActiveTab("farmers")}
          >
            <MdPeople /> Personnel (Farmers)
          </button>
          <button
            className={`pm-tab ${activeTab === "owner" ? "active" : ""}`}
            onClick={() => setActiveTab("owner")}
          >
            <MdPerson /> Owner / Admin
          </button>
        </div>

        <div className="table-wrapper">

          {/* OWNER / ADMIN TABLE */}
          {activeTab === "owner" && (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Contact Number</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="empty-state">Loading...</td></tr>
                ) : owners.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      <div className="empty-content">
                        <FiMaximize />
                        <h3>No owner/admin found</h3>
                        <p>Owner/Admin appears here automatically after registration.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  owners.map((r) => (
                    <tr key={getId(r)}>
                      <td><NameCell r={r} /></td>
                      <td>{getContact(r)}</td>
                      <td>{getAccountRole(r) || "Owner"}</td>
                      <td>{statusBadge(getStatus(r))}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn view" title="View" onClick={() => navigate(`/personnel-visitors/personnel/view/${getId(r)}`)}><FiEye /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* FARMERS TABLE */}
          {activeTab === "farmers" && (
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Contact Number</th>
                  <th>Role / Position</th>
                  <th>Date Hired</th>
                  <th>Shift / Duty Hours</th>
                  <th>Status</th>
                  <th>Remarks / Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="empty-state">Loading personnel records...</td></tr>
                ) : farmers.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      <div className="empty-content">
                        <FiMaximize />
                        <h3>No personnel records found</h3>
                        <p>Farmers appear here automatically once their account is approved by the Admin.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  farmers.map((r) => (
                    <tr key={getId(r)}>
                      <td><NameCell r={r} /></td>
                      <td>{getContact(r)}</td>
                      <td>{getPosition(r)}</td>
                      <td>{getHired(r)}</td>
                      <td>{getShift(r)}</td>
                      <td>{statusBadge(getStatus(r))}</td>
                      <td>{getRemarks(r)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn view" title="View" onClick={() => navigate(`/personnel-visitors/personnel/view/${getId(r)}`)}><FiEye /></button>
                          <button className="action-btn archive" onClick={() => archiveRow({ module: "Personnel & Manpower", moduleKey: "pb_personnel", record: r, name: r.fullName || r.name })} title="Archive"><FiArchive /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          <div className="table-footer">
            Showing {activeTab === "owner" ? owners.length : farmers.length} entries
          </div>
        </div>

      </div>

      {/* ── QR ATTENDANCE MODAL ── */}
      {qrOpen && (
        <div className="qr-overlay" onClick={() => setQrOpen(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <div className="qr-modal-title">
                <BsQrCode />
                <h3>QR Attendance</h3>
              </div>
              <button className="qr-close" onClick={() => setQrOpen(false)} aria-label="Close"><FiX /></button>
            </div>

            <p className="qr-modal-sub">
              The Owner/Admin generates <strong>one shared QR code</strong> for the entire farm. <strong>All
              personnel scan this same QR</strong> to check in (one-to-many). Scanning opens the check-in
              page — if they're logged in, their attendance is <strong>recorded automatically</strong>;
              if not, they log in first and check-in continues automatically.
            </p>

            <div className="qr-station">
              {/* QR Code on top (inside a framed card) */}
              <div className="qr-frame">
                <img className="qr-station-img" src={STATION_QR} alt="Attendance QR code" loading="lazy" />
                <span className="qr-frame-caption">Attendance QR</span>
              </div>

              {/* Download button below */}
              <button
                className="qr-download-btn"
                onClick={() => window.open(STATION_QR, "_blank", "noopener,noreferrer")}
              >
                <FiDownload /> Download QR
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
