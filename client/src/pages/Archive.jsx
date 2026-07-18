import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiFilter, FiRotateCcw, FiTrash2, FiArchive, FiCalendar, FiLayers } from "react-icons/fi";
import "./Archive.css";
import PageLayout from "../components/PageLayout";

/* ─────────────────────────────────────────────────────────────
   INLINE STORE — centralized soft-delete Archive + Audit Logs.
   Exported so any module can archive a record:
     import { archiveStore } from "../pages/Archive";
     archiveStore.archive({ module, recordName, archivedBy, moduleKey, payload });
────────────────────────────────────────────────────────────── */
const A_KEY = "pb_archive";
const LOG_KEY = "pb_audit_logs";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const _write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore */ } };
const _uid = () => "arc_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

function _seed() {
  // No demo/mock archive data — records appear here ONLY when the user
  // archives them from a module.
}

export const archiveStore = {
  seed: _seed,
  getAll() { _seed(); return _read(A_KEY).slice().sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt)); },
  getLogs() { return _read(LOG_KEY); },
  archive({ module, recordName, archivedBy = "Admin", payload = {}, moduleKey = "" }) {
    const rec = { id: _uid(), module, recordName, archivedBy, archivedAt: new Date().toISOString(), moduleKey, payload };
    const a = _read(A_KEY); a.unshift(rec); _write(A_KEY, a);
    this.log(`${archivedBy} archived ${module} "${recordName}".`, archivedBy);
    return rec;
  },
  restore(id, by = "Admin") {
    const a = _read(A_KEY);
    const rec = a.find((r) => r.id === id);
    if (!rec) return null;
    _write(A_KEY, a.filter((r) => r.id !== id));
    if (rec.moduleKey && rec.payload && Object.keys(rec.payload).length) {
      const modArr = _read(rec.moduleKey);
      modArr.push({ ...rec.payload, status: "Active" });
      _write(rec.moduleKey, modArr);
    }
    this.log(`${by} restored ${rec.module} "${rec.recordName}".`, by);
    return rec;
  },
  remove(id, by = "Admin") {
    const a = _read(A_KEY);
    const rec = a.find((r) => r.id === id);
    if (!rec) return null;
    _write(A_KEY, a.filter((r) => r.id !== id));
    this.log(`${by} permanently deleted ${rec.module} "${rec.recordName}".`, by);
    return rec;
  },
  log(detail, by = "Admin") {
    const logs = _read(LOG_KEY);
    logs.unshift({ id: "log_" + Date.now() + "_" + Math.floor(Math.random() * 999), action: "Archive/Restore", detail, by, at: new Date().toISOString() });
    _write(LOG_KEY, logs);
  },
};

/* ── Constants ── */
const MODULES = [
  "All", "Flock Profile", "Egg Records", "Feed Inventory", "Feed Consumption",
  "Sales Records", "Expense Records", "Diagnosis", "Treatment", "Vaccination",
  "Mortality Records", "Isolation", "Quarantine", "Waste Management",
  "Personnel & Manpower", "Visitors",
];
const MODULE_COLORS = {
  "Flock Profile": "gold", "Egg Records": "orange",
  "Feed Inventory": "green", "Feed Consumption": "green",
  "Sales Records": "blue", "Expense Records": "blue",
  "Diagnosis": "red", "Treatment": "red", "Vaccination": "red", "Mortality Records": "red",
  "Isolation": "orange", "Quarantine": "orange",
  "Waste Management": "green", "Personnel & Manpower": "blue", "Visitors": "purple",
};
const badgeClass = (m) => `arc-badge ${MODULE_COLORS[m] || "gray"}`;
const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
};

export default function Archive({ embedded = false, onBack }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState(() => archiveStore.getAll());
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [showFilter, setShowFilter] = useState(false);
  const [confirmRec, setConfirmRec] = useState(null);
  const [confirmMode, setConfirmMode] = useState("restore");
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const filterRef = useRef(null);

  const refresh = () => setRecords(archiveStore.getAll());
  useEffect(() => () => clearTimeout(toastRef.current), []);
  useEffect(() => {
    const onClick = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setShowFilter(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchesModule = moduleFilter === "All" || r.module === moduleFilter;
      const matchesSearch =
        !q ||
        r.recordName?.toLowerCase().includes(q) ||
        r.module?.toLowerCase().includes(q) ||
        r.archivedBy?.toLowerCase().includes(q);
      return matchesModule && matchesSearch;
    });
  }, [records, search, moduleFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = records.filter((r) => {
      const d = new Date(r.archivedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const modules = new Set(records.map((r) => r.module)).size;
    return { total: records.length, thisMonth, modules };
  }, [records]);

  const activeFilterCount = moduleFilter !== "All" ? 1 : 0;
  const clearFilters = () => setModuleFilter("All");

  const askRestore = (r) => { setConfirmMode("restore"); setConfirmRec(r); };
  const askDelete = (r) => { setConfirmMode("delete"); setConfirmRec(r); };

  const doRestore = () => {
    if (!confirmRec) return;
    archiveStore.restore(confirmRec.id, "Admin");
    setToast(`Restored ${confirmRec.module} "${confirmRec.recordName}".`);
    setConfirmRec(null);
    refresh();
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 3200);
  };

  const doDelete = () => {
    if (!confirmRec) return;
    archiveStore.remove(confirmRec.id, "Admin");
    setToast(`Permanently deleted ${confirmRec.module} "${confirmRec.recordName}".`);
    setConfirmRec(null);
    refresh();
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 3200);
  };

  const content = (
    <>

        <div className="arc-toolbar">
          <div className="arc-toolbar-right">
            <div className="arc-search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search record, module, or archived by..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="arc-btn-group">
              <div className="arc-filter-wrap" ref={filterRef}>
                <button className="arc-toolbar-btn" onClick={() => setShowFilter((s) => !s)}>
                  <FiFilter /> Filter
                  {activeFilterCount > 0 && <span className="arc-filter-count">{activeFilterCount}</span>}
                </button>

                {showFilter && (
                  <div className="arc-filter-dropdown">
                    <div className="arc-filter-dropdown-header">
                      <span>Filter Archive</span>
                      <button className="arc-filter-clear" onClick={clearFilters}>Clear All</button>
                    </div>
                    <div className="arc-filter-group">
                      <label className="arc-filter-label">Module</label>
                      <select className="arc-filter-select" value={moduleFilter}
                        onChange={(e) => setModuleFilter(e.target.value)}>
                        {MODULES.map((m) => <option key={m} value={m}>{m === "All" ? "All Modules" : m}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="arc-active-filters">
            <span className="arc-active-filter-tag">
              Module: {moduleFilter}
              <button onClick={() => setModuleFilter("All")}>✕</button>
            </span>
          </div>
        )}

        <div className="arc-stats-grid">
          <div className="arc-stat-card">
            <div className="arc-stat-icon gold"><FiArchive /></div>
            <div><h3>{stats.total}</h3><p>Total Archived</p><span>All Time</span></div>
          </div>
          <div className="arc-stat-card">
            <div className="arc-stat-icon blue"><FiCalendar /></div>
            <div><h3>{stats.thisMonth}</h3><p>Archived This Month</p><span>This Month</span></div>
          </div>
          <div className="arc-stat-card">
            <div className="arc-stat-icon green"><FiLayers /></div>
            <div><h3>{stats.modules}</h3><p>Modules</p><span>Distinct</span></div>
          </div>
        </div>

        <div className="arc-table-wrapper">
          <table className="arc-table">
            <thead>
              <tr>
                <th>Archive Date</th>
                <th>Module</th>
                <th>Record Name</th>
                <th>Archived By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="arc-empty-state">
                    <div className="arc-empty-content">
                      <FiArchive />
                      <h3>No archived records found</h3>
                      <p>{search || moduleFilter !== "All"
                        ? "No records match your search or filter."
                        : "Archived records from any module will appear here."}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.archivedAt)}</td>
                    <td><span className={badgeClass(r.module)}>{r.module}</span></td>
                    <td>{r.recordName}</td>
                    <td>{r.archivedBy}</td>
                    <td>
                      <div className="arc-actions">
                        <button
                          className="arc-action-btn restore"
                          onClick={() => askRestore(r)}
                          title="Restore"
                          aria-label="Restore"
                        >
                          <FiRotateCcw />
                        </button>

                        <button
                          className="arc-action-btn delete"
                          onClick={() => askDelete(r)}
                          title="Delete"
                          aria-label="Delete"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="arc-table-footer">
            Showing {filtered.length} entries
          </div>
        </div>

      {toast && <div className="arc-toast">{toast}</div>}

      {confirmRec && (
        <div className="arc-overlay" onClick={() => setConfirmRec(null)}>
          <div className="arc-modal" onClick={(e) => e.stopPropagation()}>
            {confirmMode === "delete" ? (
              <>
                <h3>Delete Permanently?</h3>
                <p>
                  This will permanently delete the <strong>{confirmRec.module}</strong> record<br />
                  "<strong>{confirmRec.recordName}</strong>". This <strong>cannot be undone</strong>.
                </p>
                <div className="arc-modal-btns">
                  <button className="arc-btn-cancel" onClick={() => setConfirmRec(null)}>Cancel</button>
                  <button className="arc-btn-delete" onClick={doDelete}>Delete</button>
                </div>
              </>
            ) : (
              <>
                <h3>Restore Record?</h3>
                <p>
                  This will restore the <strong>{confirmRec.module}</strong> record<br />
                  "<strong>{confirmRec.recordName}</strong>" back to its original module and set it <strong>Active</strong> again.
                </p>
                <div className="arc-modal-btns">
                  <button className="arc-btn-cancel" onClick={() => setConfirmRec(null)}>Cancel</button>
                  <button className="arc-btn-confirm" onClick={doRestore}>Restore</button>
                </div>
              </>
            )}
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
        { label: "ARCHIVE" },
      ]}
    >
      {content}
    </PageLayout>
  );
}