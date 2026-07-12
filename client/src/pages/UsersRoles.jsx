import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar, { openSidebar } from "../components/Sidebar";
import { logAudit } from "./AuditLogs";
import { archiveStore } from "./Archive";
import { useUser } from "../hooks/useUser";
import {
  FiSearch, FiUsers, FiMenu, FiCheck, FiX, FiSlash, FiRotateCcw, FiArchive,
  FiUserCheck, FiUserX, FiClock, FiFilter,
} from "react-icons/fi";
import "./Flockprofile.css";
import "./UsersRoles.css";

/* ── Inline store (pb_users) + notifications ── */
const U_KEY = "pb_users";
const N_KEY = "pb_notifications";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const _write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore */ } };
const _uid = () => "usr_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

function seed() {
  // No demo/mock users — Users & Roles starts empty and fills from real
  // registrations / admin-created accounts.
}
export function getUsers() { seed(); return _read(U_KEY); }
function saveUsers(list) { _write(U_KEY, list); }
export function notify({ type = "user", title, message }) {
  const a = _read(N_KEY);
  a.unshift({ id: "ntf_" + Date.now(), at: new Date().toISOString(), type, title, message, read: false });
  _write(N_KEY, a);
}

const STATUS = {
  Active:   { bg: "#eaf7f1", color: "#2e9e6b" },
  Inactive: { bg: "#fdf0f0", color: "#d94f4f" },
  Pending:  { bg: "#fdf3e3", color: "#c8930c" },
};
const AVATAR_COLORS = ["#E4AF1F", "#3a7bd5", "#2e9e6b", "#8257c4", "#e0892f", "#d94f4f"];
const initials = (n) => (n || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const avatarColor = (n) => AVATAR_COLORS[(n || "").length % AVATAR_COLORS.length];
const fmtDate = (s) => { const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

const TABS = [
  { key: "all", label: "All Users" },
  { key: "Pending", label: "Pending Requests" },
  { key: "Active", label: "Active Users" },
  { key: "Inactive", label: "Inactive Users" },
];

export default function UsersRoles({ embedded = false, onBack }) {
  const navigate = useNavigate();
  const uu = useUser() || {};
  const adminRole = uu.role || "Admin";
  const nameOf = typeof uu.user === "string" ? uu.user : (uu.user?.name || uu.user?.fullName || "Admin");

  const [users, setUsers] = useState(() => getUsers());
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [fRole, setFRole] = useState("All");
  const [fDate, setFDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const filterRef = useRef(null);
  useEffect(() => () => clearTimeout(toastRef.current), []);
  useEffect(() => {
    const onClick = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const persist = (next) => { saveUsers(next); setUsers(next); };
  const flash = (m) => { setToast(m); clearTimeout(toastRef.current); toastRef.current = setTimeout(() => setToast(""), 3000); };

  const counts = useMemo(() => ({
    total: users.length,
    Pending: users.filter((u) => u.status === "Pending").length,
    Active: users.filter((u) => u.status === "Active").length,
    Inactive: users.filter((u) => u.status === "Inactive").length,
  }), [users]);

  const roles = useMemo(() => [...new Set(users.map((u) => u.role))], [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const inTab = tab === "all" || u.status === tab;
      const inSearch = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const inRole = fRole === "All" || u.role === fRole;
      const inDate = !fDate || u.dateRegistered === fDate;
      return inTab && inSearch && inRole && inDate;
    });
  }, [users, tab, search, fRole, fDate]);

  const activeFilters = [
    fRole !== "All" && { key: "Role", value: fRole, clear: () => setFRole("All") },
    fDate && { key: "Date", value: fDate, clear: () => setFDate("") },
  ].filter(Boolean);
  const activeFilterCount = activeFilters.length;
  const clearFilters = () => { setFRole("All"); setFDate(""); };

  /* ---- action handlers ---- */
  const setStatus = (u, status, actionLabel, auditAction, desc) => {
    persist(users.map((x) => (x._id === u._id ? { ...x, status } : x)));
    logAudit({ user: nameOf, role: adminRole, module: "Users and Roles", action: auditAction, description: desc });
    notify({ type: "user", title: `Account ${actionLabel}`, message: desc });
    flash(desc);
  };

  const approve    = (u) => setStatus(u, "Active",   "Approved",    "Approved", `Approved account: ${u.fullName}`);
  const reject     = (u) => { persist(users.filter((x) => x._id !== u._id)); logAudit({ user: nameOf, role: adminRole, module: "Users and Roles", action: "Rejected", description: `Rejected registration: ${u.fullName}` }); notify({ type: "user", title: "Account Rejected", message: `Rejected registration: ${u.fullName}` }); flash(`Rejected ${u.fullName}`); };
  const deactivate = (u) => setStatus(u, "Inactive", "Deactivated", "Edited",   `Deactivated user: ${u.fullName}`);
  const activate   = (u) => setStatus(u, "Active",   "Activated",   "Edited",   `Activated user: ${u.fullName}`);

  const doArchive = () => {
    const u = confirmArchive; if (!u) return;
    archiveStore.archive({ module: "Users and Roles", recordName: u.fullName, archivedBy: nameOf, moduleKey: U_KEY, payload: u });
    persist(users.filter((x) => x._id !== u._id));
    notify({ type: "user", title: "Account Archived", message: `Archived account: ${u.fullName}` });
    setConfirmArchive(null);
    flash(`Archived ${u.fullName}`);
  };

  return (
    <div className={embedded ? "flock-embedded" : "flock-page"}>
      {!embedded && <Sidebar />}

      <div className="flock-main">

        <div className="flock-breadcrumb">
          {!embedded && <button className="flock-hamburger" onClick={openSidebar} aria-label="Open menu"><FiMenu /></button>}
          <span className="breadcrumb-link" onClick={embedded ? onBack : () => navigate("/settings")}>SETTINGS</span>
          <span>›</span>
          <span className="breadcrumb-current">USERS &amp; ROLES</span>
        </div>

        <div className="flock-toolbar">
          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      <span>Filter Users</span>
                      <button className="flock-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Role</label>
                      <select className="flock-filter-select" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                        <option value="All">All Roles</option>
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Date Registered</label>
                      <input className="flock-filter-select" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flock-active-filters">
            {activeFilters.map((f) => (
              <span key={f.key} className="flock-active-filter-tag">
                {f.key}: {f.value}
                <button onClick={f.clear}>✕</button>
              </span>
            ))}
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon gold"><FiUsers /></div>
            <div><h3>{counts.total}</h3><p>Total Users</p><span>All Accounts</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon orange"><FiClock /></div>
            <div><h3>{counts.Pending}</h3><p>Pending Requests</p><span>Awaiting Approval</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><FiUserCheck /></div>
            <div><h3>{counts.Active}</h3><p>Active Users</p><span>Can Log In</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><FiUserX /></div>
            <div><h3>{counts.Inactive}</h3><p>Inactive Users</p><span>Disabled</span></div>
          </div>
        </div>

        <div className="ur-tabs">
          {TABS.map((t) => {
            const n = t.key === "all" ? counts.total : counts[t.key];
            return (
              <button key={t.key} className={`ur-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                {t.label} <span className="count">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="table-wrapper">
          <table className="flock-table">
            <thead>
              <tr>
                <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Date Registered</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-content">
                      <FiUsers />
                      <h3>No users found</h3>
                      <p>No accounts match this tab or your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((u) => {
                const s = STATUS[u.status] || STATUS.Pending;
                return (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div className="ur-avatar" style={{ background: avatarColor(u.fullName) }}>
                          {u.avatar ? <img src={u.avatar} alt="" /> : initials(u.fullName)}
                        </div>
                        <span className="ur-name">{u.fullName}</span>
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td><span className="ur-role">{u.role}</span></td>
                    <td><span className="ur-badge" style={{ background: s.bg, color: s.color }}>{u.status}</span></td>
                    <td>{fmtDate(u.dateRegistered)}</td>
                    <td>
                      <div className="ur-actions">
                        {u.status === "Pending" && (<>
                          <button className="ur-btn approve" onClick={() => approve(u)}><FiCheck /> Approve</button>
                          <button className="ur-btn reject" onClick={() => reject(u)}><FiX /> Reject</button>
                        </>)}
                        {u.status === "Active" && (
                          <button className="ur-btn deactivate" onClick={() => deactivate(u)}><FiSlash /> Deactivate</button>
                        )}
                        {u.status === "Inactive" && (<>
                          <button className="ur-btn activate" onClick={() => activate(u)}><FiRotateCcw /> Activate</button>
                          <button className="ur-btn archive" onClick={() => setConfirmArchive(u)}><FiArchive /> Archive</button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="table-footer">
            Showing {filtered.length} entries
          </div>
        </div>
      </div>

      {toast && <div className="ur-toast">{toast}</div>}

      {confirmArchive && (
        <div className="ur-overlay" onClick={() => setConfirmArchive(null)}>
          <div className="ur-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Archive Account?</h3>
            <p>This will move <strong>"{confirmArchive.fullName}"</strong> to the <strong>Archive</strong>.<br />They will no longer be able to log in, but all their info is kept.</p>
            <div className="ur-modal-btns">
              <button className="ur-mb-cancel" onClick={() => setConfirmArchive(null)}>Cancel</button>
              <button className="ur-mb-confirm" onClick={doArchive}>Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
