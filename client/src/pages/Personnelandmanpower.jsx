import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiFilter, FiDownload,
  FiEye, FiArchive, FiMenu, FiMaximize, FiX,
} from "react-icons/fi";
import { BsQrCode } from "react-icons/bs";
import { MdPeople, MdPerson, MdPersonOff, MdPersonAdd } from "react-icons/md";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./PersonnelandManpower.css";
// ── Inline mock data (frontend fallback until the API is wired) ──
const MOCK_PERSONNEL = [
  {
    _id: "o1", accountRole: "Owner / Admin", status: "Active",
    position: "Owner / Admin", shiftHours: "—", dateHired: "—",
    assignedWork: "", remarks: "",
    profile: { fullName: "Engr. Maria Egginear", contactNumber: "0917 000 1111", image: "" },
  },
  {
    _id: "f1", accountRole: "Farmer", position: "Farm Worker",
    dateHired: "2023-01-10", shiftHours: "6:00 AM - 3:00 PM", status: "Active",
    assignedWork: "Morning feeding · Cage 1-4 cleaning", remarks: "Hardworking and trustworthy.",
    profile: { fullName: "Juan Dela Cruz", contactNumber: "0917 123 4567", image: "" },
  },
  {
    _id: "f2", accountRole: "Farmer", position: "Poultry Technician",
    dateHired: "2023-02-15", shiftHours: "7:00 AM - 4:00 PM", status: "Active",
    assignedWork: "Vaccination round (Flock B-002)", remarks: "Skilled in poultry care.",
    profile: { fullName: "Maria Santos", contactNumber: "0917 234 5678", image: "" },
  },
  {
    _id: "f3", accountRole: "Farmer", position: "Maintenance Worker",
    dateHired: "2023-03-01", shiftHours: "8:00 AM - 5:00 PM", status: "Active",
    assignedWork: "Water line + equipment check", remarks: "Handles equipment maintenance.",
    profile: { fullName: "Pedro Reyes", contactNumber: "0917 345 6789", image: "" },
  },
  {
    _id: "f4", accountRole: "Farmer", position: "Inventory Clerk",
    dateHired: "2023-03-20", shiftHours: "8:00 AM - 5:00 PM", status: "Active",
    assignedWork: "", remarks: "Organized and detail-oriented.",
    profile: { fullName: "Ana Garcia", contactNumber: "0917 456 7890", image: "" },
  },
  {
    _id: "f5", accountRole: "Farmer", position: "Farm Hand",
    dateHired: "2023-04-05", shiftHours: "6:00 AM - 3:00 PM", status: "On Leave",
    assignedWork: "", remarks: "On medical leave until further notice.",
    profile: { fullName: "Mark Villanueva", contactNumber: "0917 567 8901", image: "" },
  },
  {
    _id: "f6", accountRole: "Farmer", position: "Poultry Technician",
    dateHired: "2023-06-12", shiftHours: "7:00 AM - 4:00 PM", status: "Inactive",
    assignedWork: "", remarks: "Resigned last May 30, 2024.",
    profile: { fullName: "Grace Lagon", contactNumber: "0917 678 9012", image: "" },
  },
];

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
        setRecords(list.length ? list : MOCK_PERSONNEL);
      } catch {
        setRecords(MOCK_PERSONNEL);
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

  // ── Export current view to CSV ──
  const exportCSV = () => {
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
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers, ...data].map((row) => row.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personnel-${isOwnerTab ? "owner-admin" : "farmers"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
              <button className="toolbar-btn" onClick={exportCSV}><FiDownload /> Export</button>
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
                          <button className="action-btn archive" title="Archive"><FiArchive /></button>
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
              The Owner/Admin generates <strong>one shared QR code</strong>. <strong>All personnel scan
              this same QR</strong> to check in (one-to-many). Scanning opens the check-in page where
              their name and time-stamp appear, then they Check In — saved to their Attendance tab.
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