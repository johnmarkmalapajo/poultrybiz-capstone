import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar, { openSidebar } from "../components/Sidebar";
import {
  FiSearch, FiFilter, FiFileText, FiMenu, FiX, FiClock, FiCalendar,
} from "react-icons/fi";
import "./Flockprofile.css";
import "./AuditLogs.css";

/* ─────────────────────────────────────────────────────────────
   INLINE AUDIT STORE (read-only history). Shared key with Archive.
     import { logAudit } from "../pages/AuditLogs";
────────────────────────────────────────────────────────────── */
const L_KEY = "pb_audit_logs";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const _write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore */ } };
const _uid = () => "log_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

function normalize(e) {
  if (e.user || e.module) {
    return {
      id: e.id || _uid(),
      at: e.at || new Date().toISOString(),
      user: e.user || "System",
      role: e.role || "Admin",
      module: e.module || "—",
      action: e.action || "—",
      description: e.description || "",
      prev: e.prev ?? null,
      next: e.next ?? null,
    };
  }
  const detail = e.detail || "";
  let action = "—";
  if (/archived/i.test(detail)) action = "Archived";
  else if (/restored/i.test(detail)) action = "Restored";
  const m = detail.match(/(?:archived|restored)\s+(.+?)\s+"/i);
  return {
    id: e.id || _uid(),
    at: e.at || new Date().toISOString(),
    user: e.by || "Admin",
    role: "Admin",
    module: m ? m[1] : "Archive",
    action,
    description: detail,
    prev: null, next: null,
  };
}

function seed() {
  // No demo/mock audit logs — entries appear ONLY from real user actions.
}

export function logAudit({ user = "System", role = "Admin", module = "—", action = "—", description = "", prev = null, next = null }) {
  const rec = { id: _uid(), at: new Date().toISOString(), user, role, module, action, description, prev, next };
  const a = _read(L_KEY);
  a.unshift(rec);
  _write(L_KEY, a);
  return rec;
}
export function getAuditLogs() {
  seed();
  return _read(L_KEY).map(normalize).sort((a, b) => new Date(b.at) - new Date(a.at));
}

/* action → badge style */
const ACTION_STYLE = {
  Added:    { bg: "#eaf7f1", color: "#2e9e6b" },
  Edited:   { bg: "#eef3fc", color: "#3a7bd5" },
  Archived: { bg: "#fdf2e6", color: "#e0892f" },
  Restored: { bg: "#f2edfb", color: "#8257c4" },
  Approved: { bg: "#eaf7f1", color: "#2e9e6b" },
  Rejected: { bg: "#fdf0f0", color: "#d94f4f" },
  Login:    { bg: "#e6f7f5", color: "#159b8a" },
  Logout:   { bg: "#f0efec", color: "#7a7469" },
};
const actionStyle = (a) => ACTION_STYLE[a] || { bg: "#f0efec", color: "#7a7469" };
const ROLE_STYLE = { Admin: { bg: "#fdf3e3", color: "#c8930c" }, Farmer: { bg: "#eef3fc", color: "#3a7bd5" } };

const fmtDT = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} • ${time}`;
};
const dayKey = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toISOString().slice(0, 10); };
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

export default function AuditLogs({ embedded = false, onBack }) {
  const navigate = useNavigate();
  const [logs] = useState(() => getAuditLogs());
  const [search, setSearch] = useState("");
  const [fUser, setFUser] = useState("All");
  const [fModule, setFModule] = useState("All");
  const [fAction, setFAction] = useState("All");
  const [fRole, setFRole] = useState("All");
  const [fDate, setFDate] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [selected, setSelected] = useState(null);
  const filterRef = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const users = useMemo(() => uniq(logs.map((l) => l.user)), [logs]);
  const modules = useMemo(() => uniq(logs.map((l) => l.module)), [logs]);
  const actions = useMemo(() => uniq(logs.map((l) => l.action)), [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      const mS = !q || l.description.toLowerCase().includes(q) || l.user.toLowerCase().includes(q) || l.module.toLowerCase().includes(q) || l.action.toLowerCase().includes(q);
      return mS
        && (fUser === "All" || l.user === fUser)
        && (fModule === "All" || l.module === fModule)
        && (fAction === "All" || l.action === fAction)
        && (fRole === "All" || l.role === fRole)
        && (!fDate || dayKey(l.at) === fDate);
    });
  }, [logs, search, fUser, fModule, fAction, fRole, fDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = logs.filter((l) => new Date(l.at).toDateString() === now.toDateString()).length;
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const thisWeek = logs.filter((l) => new Date(l.at) >= weekAgo).length;
    return { total: logs.length, today, thisWeek };
  }, [logs]);

  const activeFilters = [
    fUser !== "All" && { key: "User", value: fUser, clear: () => setFUser("All") },
    fRole !== "All" && { key: "Role", value: fRole, clear: () => setFRole("All") },
    fModule !== "All" && { key: "Module", value: fModule, clear: () => setFModule("All") },
    fAction !== "All" && { key: "Action", value: fAction, clear: () => setFAction("All") },
    fDate && { key: "Date", value: fDate, clear: () => setFDate("") },
  ].filter(Boolean);
  const activeFilterCount = activeFilters.length;
  const clearFilters = () => { setFUser("All"); setFRole("All"); setFModule("All"); setFAction("All"); setFDate(""); };

  return (
    <div className={embedded ? "flock-embedded" : "flock-page"}>
      {!embedded && <Sidebar />}

      <div className="flock-main">

        <div className="flock-breadcrumb">
          {!embedded && <button className="flock-hamburger" onClick={openSidebar} aria-label="Open menu"><FiMenu /></button>}
          <span className="breadcrumb-link" onClick={embedded ? onBack : () => navigate("/settings")}>SETTINGS</span>
          <span>›</span>
          <span className="breadcrumb-current">AUDIT LOGS</span>
        </div>

        <div className="flock-toolbar">
          <div className="toolbar-actions">
            <div className="search-box">
              <FiSearch />
              <input placeholder="Search description, user, module..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
                      <span>Filter Logs</span>
                      <button className="flock-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">User</label>
                      <select className="flock-filter-select" value={fUser} onChange={(e) => setFUser(e.target.value)}>
                        <option value="All">All Users</option>
                        {users.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Role</label>
                      <select className="flock-filter-select" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                        <option value="All">All Roles</option><option>Admin</option><option>Farmer</option>
                      </select>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Module</label>
                      <select className="flock-filter-select" value={fModule} onChange={(e) => setFModule(e.target.value)}>
                        <option value="All">All Modules</option>
                        {modules.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Action</label>
                      <select className="flock-filter-select" value={fAction} onChange={(e) => setFAction(e.target.value)}>
                        <option value="All">All Actions</option>
                        {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="flock-filter-group">
                      <label className="flock-filter-label">Date</label>
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
            <div className="stat-icon gold"><FiFileText /></div>
            <div><h3>{stats.total}</h3><p>Total Logs</p><span>All Time</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><FiClock /></div>
            <div><h3>{stats.today}</h3><p>Logs Today</p><span>Today</span></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><FiCalendar /></div>
            <div><h3>{stats.thisWeek}</h3><p>This Week</p><span>Last 7 Days</span></div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="flock-table">
            <thead>
              <tr>
                <th>Date &amp; Time</th><th>User</th><th>Role</th><th>Module</th><th>Action</th><th>Description</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    <div className="empty-content">
                      <FiFileText />
                      <h3>No audit logs found</h3>
                      <p>No activity matches your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((l) => {
                const a = actionStyle(l.action);
                const r = ROLE_STYLE[l.role] || ROLE_STYLE.Admin;
                return (
                  <tr key={l.id} onClick={() => setSelected(l)} style={{ cursor: "pointer" }}>
                    <td className="al-dt">{fmtDT(l.at)}</td>
                    <td className="al-user">{l.user}</td>
                    <td><span className="al-role" style={{ background: r.bg, color: r.color }}>{l.role}</span></td>
                    <td>{l.module}</td>
                    <td><span className="al-badge" style={{ background: a.bg, color: a.color }}>{l.action}</span></td>
                    <td className="al-desc">{l.description}</td>
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

      {/* Details modal */}
      {selected && (() => {
        const a = actionStyle(selected.action);
        const r = ROLE_STYLE[selected.role] || ROLE_STYLE.Admin;
        return (
          <div className="al-overlay" onClick={() => setSelected(null)}>
            <div className="al-modal" onClick={(e) => e.stopPropagation()}>
              <div className="al-modal-head">
                <h3><FiFileText /> Log Details</h3>
                <button onClick={() => setSelected(null)} aria-label="Close"><FiX /></button>
              </div>
              <div className="al-modal-body">
                <div className="al-row"><span className="k">Date &amp; Time</span><span className="v" style={{ display: "flex", alignItems: "center", gap: 6 }}><FiClock size={14} /> {fmtDT(selected.at)}</span></div>
                <div className="al-row"><span className="k">User</span><span className="v">{selected.user}</span></div>
                <div className="al-row"><span className="k">Role</span><span className="v"><span className="al-role" style={{ background: r.bg, color: r.color }}>{selected.role}</span></span></div>
                <div className="al-row"><span className="k">Module</span><span className="v">{selected.module}</span></div>
                <div className="al-row"><span className="k">Action</span><span className="v"><span className="al-badge" style={{ background: a.bg, color: a.color }}>{selected.action}</span></span></div>
                <div className="al-row"><span className="k">Description</span><span className="v" style={{ maxWidth: 260 }}>{selected.description}</span></div>

                {selected.action === "Edited" && (selected.prev != null || selected.next != null) && (
                  <div className="al-diff">
                    <div className="box prev"><h5>Previous Value</h5><p>{selected.prev ?? "—"}</p></div>
                    <div className="box next"><h5>Updated Value</h5><p>{selected.next ?? "—"}</p></div>
                  </div>
                )}

                <p className="al-readonly">Audit logs are read-only and cannot be edited or deleted.</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
