import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { logAudit } from "./AuditLogs";
import { archiveStore } from "./Archive";
import { useUser } from "../hooks/useUser";
import {
  FiSearch, FiUsers, FiCheck, FiX, FiSlash, FiRotateCcw, FiArchive, FiMoreVertical,
  FiUserCheck, FiUserX, FiClock, FiFilter,
} from "react-icons/fi";
import "./UsersRoles.css";
import PageLayout from "../components/PageLayout";

/* ── Inline store (pb_users) + notifications ── */
const U_KEY = "pb_users";
const N_KEY = "pb_notifications";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const _write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore */ } };
const _uid = () => "usr_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

/* ── Mock/demo users (only seeded once, on first load, if the store is empty) ── */
const MOCK_USERS = [
  { _id: "usr_seed_1", fullName: "Ramon Cruz",     email: "ramon.cruz@poultrybiz.ph",     role: "Admin",  status: "Active",   dateRegistered: "2025-11-02" },
  { _id: "usr_seed_2", fullName: "Liza Mendoza",    email: "liza.mendoza@poultrybiz.ph",   role: "Farmer", status: "Active",   dateRegistered: "2025-12-14" },
  { _id: "usr_seed_3", fullName: "Paolo Lim",       email: "paolo.lim@poultrybiz.ph",      role: "Farmer", status: "Active",   dateRegistered: "2026-01-08" },
  { _id: "usr_seed_4", fullName: "Carla Reyes",     email: "carla.reyes@poultrybiz.ph",    role: "Farmer", status: "Pending",  dateRegistered: "2026-03-22" },
  { _id: "usr_seed_5", fullName: "Mateo Santos",    email: "mateo.santos@poultrybiz.ph",   role: "Farmer", status: "Pending",  dateRegistered: "2026-04-05" },
  { _id: "usr_seed_6", fullName: "Grace Fabella",   email: "grace.fabella@poultrybiz.ph",  role: "Farmer", status: "Inactive", dateRegistered: "2025-09-19" },
  { _id: "usr_seed_7", fullName: "Noel Aguilar",    email: "noel.aguilar@poultrybiz.ph",   role: "Farmer", status: "Active",   dateRegistered: "2026-02-11" },
  { _id: "usr_seed_8", fullName: "Helen Yu",        email: "helen.yu@poultrybiz.ph",       role: "Admin",  status: "Active",   dateRegistered: "2025-08-30" },
];

function seed() {
  // Seed once with mock/demo data if the store has never been written to.
  // Real registrations/admin actions take over after that — this never
  // re-adds the mock rows once the user has interacted with the page.
  if (localStorage.getItem(U_KEY) == null) {
    _write(U_KEY, MOCK_USERS);
  }
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
  const [openMenu, setOpenMenu] = useState(null);  // 3-dot menu user id
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const filterRef = useRef(null);
  useEffect(() => () => clearTimeout(toastRef.current), []);
  useEffect(() => {
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false);
      setOpenMenu(null);
    };
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

  const changeRole = (u, newRole) => {
    persist(users.map((x) => (x._id === u._id ? { ...x, role: newRole } : x)));
    logAudit({ user: nameOf, role: adminRole, module: "Users and Roles", action: "Edited", description: `Changed role of ${u.fullName} from ${u.role} to ${newRole}` });
    notify({ type: "user", title: "Role Changed", message: `${u.fullName} is now ${newRole}` });
    flash(`${u.fullName} is now ${newRole}`);
  };

  const content = (
    <>
      <div className="ur-toolbar">
        <div className="ur-toolbar-right">
          <div className="ur-search-box">
            <FiSearch />
            <input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="ur-btn-group">
            <div className="ur-filter-wrap" ref={filterRef}>
              <button className="ur-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                <FiFilter /> Filter
                {activeFilterCount > 0 && <span className="ur-filter-count">{activeFilterCount}</span>}
              </button>

              {showFilter && (
                <div className="ur-filter-dropdown">
                  <div className="ur-filter-dropdown-header">
                    <span>Filter Users</span>
                    <button className="ur-filter-clear" onClick={clearFilters}>Clear All</button>
                  </div>
                  <div className="ur-filter-group">
                    <label className="ur-filter-label">Role</label>
                    <select className="ur-filter-select" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                      <option value="All">All Roles</option>
                      {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="ur-filter-group">
                    <label className="ur-filter-label">Date Registered</label>
                    <input className="ur-filter-select" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <div className="ur-active-filters">
          {activeFilters.map((f) => (
            <span key={f.key} className="ur-active-filter-tag">
              {f.key}: {f.value}
              <button onClick={f.clear}>✕</button>
            </span>
          ))}
        </div>
      )}

      <div className="ur-stats-grid">
        <div className="ur-stat-card">
          <div className="ur-stat-icon gold"><FiUsers /></div>
          <div><h3>{counts.total}</h3><p>Total Users</p><span>All Accounts</span></div>
        </div>
        <div className="ur-stat-card">
          <div className="ur-stat-icon orange"><FiClock /></div>
          <div><h3>{counts.Pending}</h3><p>Pending Requests</p><span>Awaiting Approval</span></div>
        </div>
        <div className="ur-stat-card">
          <div className="ur-stat-icon green"><FiUserCheck /></div>
          <div><h3>{counts.Active}</h3><p>Active Users</p><span>Can Log In</span></div>
        </div>
        <div className="ur-stat-card">
          <div className="ur-stat-icon red"><FiUserX /></div>
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

      <div className="ur-table-wrapper">
        <table className="ur-table">
          <thead>
            <tr>
              <th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Date Registered</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="ur-empty-state">
                  <div className="ur-empty-content">
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
                  <td>
                    <select className="ur-role-select" value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}>
                      <option value="Admin">Admin</option>
                      <option value="Farmer">Farmer</option>
                    </select>
                  </td>
                  <td><span className="ur-badge" style={{ background: s.bg, color: s.color }}>{u.status}</span></td>
                  <td>{fmtDate(u.dateRegistered)}</td>
                  <td>
                    <div className="ur-actions">
                      {u.status === "Pending" && (<>
                        <button className="ur-icon-btn approve" onClick={() => approve(u)} title="Approve" aria-label="Approve"><FiCheck /></button>
                        <button className="ur-icon-btn reject" onClick={() => reject(u)} title="Reject" aria-label="Reject"><FiX /></button>
                      </>)}
                      {(u.status === "Active" || u.status === "Inactive") && (
                        <div className="ur-menu-wrap">
                          <button className="ur-menu-trigger" onClick={() => setOpenMenu(openMenu === u._id ? null : u._id)}>
                            <FiMoreVertical />
                          </button>
                          {openMenu === u._id && (
                            <div className="ur-menu-dropdown">
                              {u.status === "Active" && (
                                <button onClick={() => { deactivate(u); setOpenMenu(null); }}>
                                  <FiSlash /> Deactivate
                                </button>
                              )}
                              {u.status === "Inactive" && (
                                <button onClick={() => { activate(u); setOpenMenu(null); }}>
                                  <FiRotateCcw /> Activate
                                </button>
                              )}
                              <button onClick={() => { setConfirmArchive(u); setOpenMenu(null); }}>
                                <FiArchive /> Archive
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="ur-table-footer">
          Showing {filtered.length} entries
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
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      breadcrumbItems={[
        { label: "SETTINGS", path: "/settings" },
        { label: "USERS & ROLES" },
      ]}
    >
      {content}
    </PageLayout>
  );
}