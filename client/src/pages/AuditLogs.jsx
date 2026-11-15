import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiSearch, FiFileText, FiX, FiClock, FiCalendar,
} from "react-icons/fi";
import "./AuditLogs.css";
import PageLayout from "../components/PageLayout";
import { listAuditLogs } from "../api/auditLog";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import {
  usePagination, useFilterPanel, DATE_FILTER_DEFAULTS,
  localDayKey, matchesDatePeriod, dateFilterOptions, datePeriodLabel,
} from "../hooks/usePagination";
import TablePagination, {
  TableSection, TableScroll, FilterPanel, FilterSection, FilterSelect, DateFilterFields, ActiveFilterChips,
} from "../components/TablePagination";
import { useLanguage } from "../i18n/LanguageContext";

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
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

// Filter defaults: Date (date period), User, Role, Module, Action.
const FILTER_DEFAULTS = { ...DATE_FILTER_DEFAULTS, user: "All", role: "All", module: "All", action: "All" };
const ROLE_OPTIONS = ["Owner", "Farmer"];

export default function AuditLogs({ embedded = false, onBack }) {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const filter = useFilterPanel(FILTER_DEFAULTS);
  const fApplied = filter.applied;
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchLogs = () => {
      setLoading(true);
      setError("");
      listAuditLogs()
        .then((data) => {
          const list = Array.isArray(data) ? data : data.records || data.data || [];
          setLogs(list.map(normalize).sort((a, b) => new Date(b.at) - new Date(a.at)));
        })
        .catch((err) => { setLogs([]); setError(tr(err?.message || "Couldn't load audit logs.")); })
        .finally(() => setLoading(false));
    };
    fetchLogs();
    window.addEventListener("pb_data_changed", fetchLogs);
    window.addEventListener("focus", fetchLogs);
    return () => {
      window.removeEventListener("pb_data_changed", fetchLogs);
      window.removeEventListener("focus", fetchLogs);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const users = useMemo(() => uniq(logs.map((l) => l.user)), [logs]);
  const modules = useMemo(() => uniq(logs.map((l) => l.module)), [logs]);
  const actions = useMemo(() => uniq(logs.map((l) => l.action)), [logs]);
  const dateOptions = dateFilterOptions(logs.map((l) => localDayKey(l.at)), filter.draft.year);

  // Dates are compared by the local calendar day of each log's timestamp.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = fApplied;
    return logs.filter((l) => {
      const mS = !q || l.description.toLowerCase().includes(q) || l.user.toLowerCase().includes(q) || l.module.toLowerCase().includes(q) || l.action.toLowerCase().includes(q);
      return mS
        && (f.user === "All" || l.user === f.user)
        && (f.module === "All" || l.module === f.module)
        && (f.action === "All" || l.action === f.action)
        && (f.role === "All" || l.role === f.role)
        && matchesDatePeriod(localDayKey(l.at), f);
    });
  }, [logs, search, fApplied]);

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
  useEffect(() => { pager.setPage(1); }, [search, fApplied]); // eslint-disable-line react-hooks/exhaustive-deps
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);


  const stats = useMemo(() => {
    const now = new Date();
    const today = logs.filter((l) => new Date(l.at).toDateString() === now.toDateString()).length;
    const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
    const thisWeek = logs.filter((l) => new Date(l.at) >= weekAgo).length;
    return { total: logs.length, today, thisWeek };
  }, [logs]);

  const activeChips = [
    fApplied.period !== "all" && { key: "date", label: "Date", value: datePeriodLabel(fApplied) },
    fApplied.user !== "All" && { key: "user", label: "User", value: fApplied.user },
    fApplied.role !== "All" && { key: "role", label: "Role", value: fApplied.role },
    fApplied.module !== "All" && { key: "module", label: "Module", value: fApplied.module },
    fApplied.action !== "All" && { key: "action", label: "Action", value: fApplied.action },
  ].filter(Boolean);

  const content = (
    <>
<div className="al-toolbar">
          <div className="al-toolbar-right">
            <div className="al-search-box">
              <FiSearch />
              <input placeholder={tr("Search description, user, module...")} value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <div className="al-btn-group">
              <FilterPanel panel={filter} title="Filter Logs">
                <DateFilterFields panel={filter} years={dateOptions.years} months={dateOptions.months} />
                <FilterSection label="Filters">
                  <FilterSelect panel={filter} field="user" label="User" allLabel="All Users" options={users} />
                  <FilterSelect panel={filter} field="role" label="Role" allLabel="All Roles" options={ROLE_OPTIONS} />
                  <FilterSelect panel={filter} field="module" label="Module" allLabel="All Modules" options={modules} />
                  <FilterSelect panel={filter} field="action" label="Action" allLabel="All Actions" options={actions} />
                </FilterSection>
              </FilterPanel>
            </div>
          </div>
        </div>

        <ActiveFilterChips panel={filter} chips={activeChips} />

        {error && <div className="pb-error-banner">{error}</div>}

        <div className="al-stats-grid">
          <div className="al-stat-card">
            <div className="al-stat-icon gold"><FiFileText /></div>
            <div><h3>{stats.total}</h3><p>{tr("Total Logs")}</p><span>{tr("All Time")}</span></div>
          </div>
          <div className="al-stat-card">
            <div className="al-stat-icon green"><FiClock /></div>
            <div><h3>{stats.today}</h3><p>{tr("Logs Today")}</p><span>{tr("Today")}</span></div>
          </div>
          <div className="al-stat-card">
            <div className="al-stat-icon blue"><FiCalendar /></div>
            <div><h3>{stats.thisWeek}</h3><p>{tr("This Week")}</p><span>{tr("Last 7 Days")}</span></div>
          </div>
        </div>

        <TableSection className="al-table-wrapper">
          <TableScroll>
          <table className="al-table">
            <thead>
              <tr>
                <th className="al-sortable-th" onClick={() => cycleSort("at")}>{tr("Date & Time")}{sortIndicator("at", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("user")}>{tr("User")}{sortIndicator("user", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("role")}>{tr("Role")}{sortIndicator("role", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("module")}>{tr("Module")}{sortIndicator("module", sortColumn, sortDirection)}</th>
                <th className="al-sortable-th" onClick={() => cycleSort("action")}>{tr("Action")}{sortIndicator("action", sortColumn, sortDirection)}</th>
                <th>{tr("Description")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="al-empty-state">{tr("Loading audit logs...")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="al-empty-state">
                    <div className="al-empty-content">
                      <FiFileText />
                      <h3>{tr("No audit logs found")}</h3>
                      <p>{tr("No activity matches your search or filters.")}</p>
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
                    <td><span className="al-role" style={{ background: r.bg, color: r.color }}>{tr(l.role)}</span></td>
                    <td>{tr(l.module)}</td>
                    <td><span className="al-badge" style={{ background: a.bg, color: a.color }}>{tr(l.action)}</span></td>
                    <td className="al-desc">{l.description}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          </TableScroll>
          <TablePagination
            currentPage={pager.page}
            totalPages={pager.totalPages}
            pageSize={pager.rowsPerPage}
            totalRecords={pager.totalItems}
            startIndex={pager.startIndex}
            endIndex={pager.endIndex}
            onPageChange={pager.setPage}
            onPageSizeChange={pager.setRowsPerPage}
          />
        </TableSection>

      {}
      {selected && (() => {
        const a = actionStyle(selected.action);
        const r = ROLE_STYLE[selected.role] || ROLE_STYLE.Owner;
        return (
          <div className="al-overlay" onClick={() => setSelected(null)}>
            <div className="al-modal" onClick={(e) => e.stopPropagation()}>
              <div className="al-modal-head">
                <h3><FiFileText />{" "}{tr("Log Details")}</h3>
                <button onClick={() => setSelected(null)} aria-label={tr("Close")}><FiX /></button>
              </div>
              <div className="al-modal-body">
                <div className="al-row"><span className="k">{tr("Date & Time")}</span><span className="v" style={{ display: "flex", alignItems: "center", gap: 6 }}><FiClock size={14} /> {fmtDT(selected.at)}</span></div>
                <div className="al-row"><span className="k">{tr("User")}</span><span className="v">{selected.user}</span></div>
                <div className="al-row"><span className="k">{tr("Role")}</span><span className="v"><span className="al-role" style={{ background: r.bg, color: r.color }}>{tr(selected.role)}</span></span></div>
                <div className="al-row"><span className="k">{tr("Module")}</span><span className="v">{tr(selected.module)}</span></div>
                <div className="al-row"><span className="k">{tr("Action")}</span><span className="v"><span className="al-badge" style={{ background: a.bg, color: a.color }}>{selected.action}</span></span></div>
                <div className="al-row"><span className="k">{tr("Description")}</span><span className="v" style={{ maxWidth: 260 }}>{selected.description}</span></div>

                {selected.action === "Edited" && (selected.prev != null || selected.next != null) && (
                  <div className="al-diff">
                    <div className="box prev"><h5>{tr("Previous Value")}</h5><p>{selected.prev ?? "—"}</p></div>
                    <div className="box next"><h5>{tr("Updated Value")}</h5><p>{selected.next ?? "—"}</p></div>
                  </div>
                )}

                <p className="al-readonly">{tr("Audit logs are read-only and cannot be edited or deleted.")}</p>
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