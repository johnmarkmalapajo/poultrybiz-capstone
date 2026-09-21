import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiFilter, FiFileText, FiX, FiClock, FiCalendar,
} from "react-icons/fi";
import "./AuditLogs.css";
import PageLayout from "../components/PageLayout";
import { listAuditLogs } from "../api/auditLog";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";

function normalize(e) {
  return {
    id: e.id || e._id,
    at: e.at || e.createdAt || new Date().toISOString(),
    user: e.user || "System",
    role: e.role || "Owner",
    module: e.module || "—",
    action: e.action || "—",
    description: e.description || "",
    prev: e.prev ?? null,
    next: e.next ?? null,
  };
}

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
const ROLE_STYLE = { Owner: { bg: "#fdf3e3", color: "#c8930c" }, Farmer: { bg: "#eef3fc", color: "#3a7bd5" } };

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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    const fetchLogs = () => {
      setLoading(true);
      setError("");
      listAuditLogs()
        .then((data) => {
          const list = Array.isArray(data) ? data : data.records || data.data || [];
          setLogs(list.map(normalize).sort((a, b) => new Date(b.at) - new Date(a.at)));
        })
        .catch((err) => { setLogs([]); setError(err?.message || "Couldn't load audit logs."); })
        .finally(() => setLoading(false));
    };
    fetchLogs();
    window.addEventListener("pb_data_changed", fetchLogs);
    window.addEventListener("focus", fetchLogs);
    return () => {
      window.removeEventListener("pb_data_changed", fetchLogs);
      window.removeEventListener("focus", fetchLogs);
    };
  }, []);

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

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "at") return row.at || "";
    if (col === "user") return row.user || "";
    if (col === "role") return row.role || "";
    if (col === "module") return row.module || "";
    if (col === "action") return row.action || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, fUser, fModule, fAction, fRole, fDate]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);


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

  const content = (
    <>
<div className="al-toolbar">
          <div className="al-toolbar-right">
            <div className="al-search-box">
              <FiSearch />
              <input placeholder="Search description, user, module..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="al-btn-group">
              <div className="al-filter-wrap" ref={filterRef}>
                <button className="al-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="al-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="al-filter-dropdown">
                    <div className="al-filter-dropdown-header">
                      <span>Filter Logs</span>
                      <button className="al-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>
                    <div className="al-filter-group">
                      <label className="al-filter-label">User</label>
                      <select className="al-filter-select" value={fUser} onChange={(e) => setFUser(e.target.value)}>
                        <option value="All">All Users</option>
                        {users.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="al-filter-group">
                      <label className="al-filter-label">Role</label>
                      <select className="al-filter-select" value={fRole} onChange={(e) => setFRole(e.target.value)}>
                        <option value="All">All Roles</option><option>Owner</option><option>Farmer</option>
                      </select>
                    </div>
                    <div className="al-filter-group">
                      <label className="al-filter-label">Module</label>
                      <select className="al-filter-select" value={fModule} onChange={(e) => setFModule(e.target.value)}>
                        <option value="All">All Modules</option>
                        {modules.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="al-filter-group">
                      <label className="al-filter-label">Action</label>
                      <select className="al-filter-select" value={fAction} onChange={(e) => setFAction(e.target.value)}>
                        <option value="All">All Actions</option>
                        {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="al-filter-group">
                      <label className="al-filter-label">Date</label>
                      <input className="al-filter-select" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="al-active-filters">
            {activeFilters.map((f) => (
              <span key={f.key} className="al-active-filter-tag">
                {f.key}: {f.value}
                <button onClick={f.clear}>✕</button>
              </span>
            ))}
          </div>
        )}

        {error && <div className="pb-error-banner">{error}</div>}

        <div className="al-stats-grid">
          <div className="al-stat-card">
            <div className="al-stat-icon gold"><FiFileText /></div>
            <div><h3>{stats.total}</h3><p>Total Logs</p><span>All Time</span></div>
          </div>
          <div className="al-stat-card">
            <div className="al-stat-icon green"><FiClock /></div>
            <div><h3>{stats.today}</h3><p>Logs Today</p><span>Today</span></div>
          </div>
          <div className="al-stat-card">
            <div className="al-stat-icon blue"><FiCalendar /></div>
            <div><h3>{stats.thisWeek}</h3><p>This Week</p><span>Last 7 Days</span></div>
          </div>
        </div>

        <div className="al-table-wrapper">
          <table className="al-table">
            <thead>
              <tr>
                <th className="al-sortable-th" onClick={() => cycleSort("at")}>Date &amp; Time{sortIndicator("at", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("user")}>User{sortIndicator("user", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("role")}>Role{sortIndicator("role", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("module")}>Module{sortIndicator("module", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("action")}>Action{sortIndicator("action", sortColumn, sortDirection)}</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="al-empty-state">Loading audit logs...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="al-empty-state">
                    <div className="al-empty-content">
                      <FiFileText />
                      <h3>No audit logs found</h3>
                      <p>No activity matches your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : pageRows.map((l) => {
                const a = actionStyle(l.action);
                const r = ROLE_STYLE[l.role] || ROLE_STYLE.Owner;
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

          <TablePagination
            page={pager.page}
            setPage={pager.setPage}
            rowsPerPage={pager.rowsPerPage}
            setRowsPerPage={pager.setRowsPerPage}
            totalPages={pager.totalPages}
            startIndex={pager.startIndex}
            endIndex={pager.endIndex}
            totalItems={pager.totalItems}
          />
        </div>

      {}
      {selected && (() => {
        const a = actionStyle(selected.action);
        const r = ROLE_STYLE[selected.role] || ROLE_STYLE.Owner;
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
    
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <PageLayout
      background="#f7f6f3"
      color="#1e1c18"
      embedded={embedded}
      breadcrumbItems={[
        { label: "SETTINGS", path: embedded ? undefined : "/settings" },
        { label: "AUDIT LOGS" },
      ]}
      onBack={onBack}
    >
      {content}
    </PageLayout>
  );
}