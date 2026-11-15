import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FiSearch, FiRotateCcw, FiTrash2, FiArchive, FiCalendar, FiLayers } from "react-icons/fi";
import "./Archive.css";
import PageLayout from "../components/PageLayout";
import { listArchivedRecords, deleteArchiveEntry } from "../api/archive";
import { RESTORE_FN_BY_MODULE_KEY, DELETE_FN_BY_MODULE_KEY } from "../archiveRow";
import { deleteUserPermanently } from "../api/users";
import { checkDependencies, DEPENDENCY_TYPE_BY_MODULE_KEY } from "../api/dependencies";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import {
  usePagination, useFilterPanel, DATE_FILTER_DEFAULTS,
  localDayKey, matchesDatePeriod, dateFilterOptions, datePeriodLabel,
} from "../hooks/usePagination";
import TablePagination, {
  TableSection, TableScroll, FilterPanel, FilterSection, FilterSelect, DateFilterFields, ActiveFilterChips,
} from "../components/TablePagination";
import { useLanguage } from "../i18n/LanguageContext";

// Module names exactly as the server records them on archive entries
// (createArchiveEntry in each controller; "Users" from userController).
const MODULES = [
  "Users", "Flock Profile", "Egg Records", "Feed Inventory", "Feed Consumption", "Equipment & Tools",
  "Manure Record", "Waste Record", "Sales Record", "Expense Records", "Health Records",
  "Mortality Record", "Quarantine & Isolation", "Personnel & Manpower", "Visitors",
  "To Do", "Personal Todo",
];
// Filter defaults: Date Archived (date period) and Module.
const FILTER_DEFAULTS = { ...DATE_FILTER_DEFAULTS, module: "All" };

const MODULE_COLORS = {
  "Users": "blue", "Flock Profile": "gold", "Egg Records": "orange",
  "Feed Inventory": "green", "Feed Consumption": "green", "Equipment": "green",
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
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isOwner = currentUser.role === "Owner";
  const canRestore = (record) => {
  if (record.moduleKey === "pb_personal_todos") {
    return isOwner;
  }

  const targetRole =
    record.payload?.role ||
    record.payload?.user?.role ||
    "";

  if (isOwner) {
    return targetRole !== "Owner";
  }

  return false;
};


  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const filter = useFilterPanel(FILTER_DEFAULTS);
  const fApplied = filter.applied;
  const [confirmRec, setConfirmRec] = useState(null);
  const [confirmMode, setConfirmMode] = useState("restore");
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);

  const refresh = () => {
    setLoading(true);
    setError("");
    listArchivedRecords()
      .then((data) => {
        const list = Array.isArray(data) ? data : data.records || data.data || [];
        setRecords(list.slice().sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt)));
      })
      .catch((err) => { setRecords([]); setError(tr(err?.message || "Couldn't load archived records.")); })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    window.addEventListener("pb_data_changed", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("pb_data_changed", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => () => clearTimeout(toastRef.current), []);

  const dateOptions = dateFilterOptions(records.map((r) => localDayKey(r.archivedAt)), filter.draft.year);
  // Every module the server archives, plus any other name found on the
  // archived records (e.g. entries saved under an older module name).
  const moduleOptions = useMemo(
    () => [...new Set([...MODULES, ...records.map((r) => r.module).filter(Boolean)])],
    [records],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      const matchesModule = fApplied.module === "All" || r.module === fApplied.module;
      const matchesDate = matchesDatePeriod(localDayKey(r.archivedAt), fApplied);
      const matchesSearch =
        !q ||
        r.recordName?.toLowerCase().includes(q) ||
        r.module?.toLowerCase().includes(q) ||
        r.archivedBy?.toLowerCase().includes(q);
      return matchesModule && matchesDate && matchesSearch;
    });
  }, [records, search, fApplied]);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "archivedAt") return row.archivedAt || "";
    if (col === "module") return row.module || "";
    if (col === "recordName") return row.recordName || "";
    if (col === "archivedBy") return row.archivedBy || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [search, fApplied]); // eslint-disable-line react-hooks/exhaustive-deps
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);


  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = records.filter((r) => {
      const d = new Date(r.archivedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    const modules = new Set(records.map((r) => r.module)).size;
    return { total: records.length, thisMonth, modules };
  }, [records]);

  const activeChips = [
    fApplied.period !== "all" && { key: "date", label: "Date Archived", value: datePeriodLabel(fApplied) },
    fApplied.module !== "All" && { key: "module", label: "Module", value: fApplied.module },
  ].filter(Boolean);

  const askRestore = (r) => { setConfirmMode("restore"); setConfirmRec(r); };

  const [depPreview, setDepPreview] = useState(null);  const [depChecking, setDepChecking] = useState(false);

  const askDelete = async (r) => {
    const recordId = r.recordId || r.payload?._id || r.payload?.id;
    const depType = DEPENDENCY_TYPE_BY_MODULE_KEY[r.moduleKey];

    if (depType && recordId) {
      setDepChecking(true);
      try {
        const result = await checkDependencies(depType, recordId);
        if (result?.hasDependencies) {
          setDepPreview({ record: r, connections: result.connections });
          setDepChecking(false);
          return;
        }
      } catch {
      }
      setDepChecking(false);
    }

    setConfirmMode("delete");
    setConfirmRec(r);
  };

  const doRestore = async () => {
    if (!confirmRec) return;
    const restoreFn = RESTORE_FN_BY_MODULE_KEY[confirmRec.moduleKey];
    const recordId = confirmRec.recordId || confirmRec.payload?._id || confirmRec.payload?.id;
    try {
      if (restoreFn && recordId) await restoreFn(recordId, confirmRec.payload);
      setToast(tr(`Restored ${confirmRec.module} "${confirmRec.recordName}".`));
      setConfirmRec(null);
      refresh();
      try { window.dispatchEvent(new Event("pb_data_changed")); } catch { }
    } catch (err) {
      setToast(tr(err?.message || "Couldn't restore this record. Please try again."));
    }
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 3200);
  };

  const doDelete = async () => {
    if (!confirmRec) return;
    try {
      if (confirmRec.module === "Users") {
        await deleteUserPermanently(confirmRec.recordId);
      } else {
        const recordId = confirmRec.recordId || confirmRec.payload?._id || confirmRec.payload?.id;
        const deleteFn = DELETE_FN_BY_MODULE_KEY[confirmRec.moduleKey];
        if (deleteFn && recordId) {
          await deleteFn(recordId, confirmRec.payload);
        } else {
          await deleteArchiveEntry(confirmRec.id);
        }
      }
      setToast(tr(`Permanently deleted ${confirmRec.module} "${confirmRec.recordName}".`));
      setConfirmRec(null);
      refresh();
    } catch (err) {
      setToast(tr(err?.message || "Couldn't delete this record. Please try again."));
    }
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
                placeholder={tr("Search record, module, or archived by...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="arc-btn-group">
              <FilterPanel panel={filter} title="Filter Archive">
                <DateFilterFields panel={filter} label="Date Archived" years={dateOptions.years} months={dateOptions.months} />
                <FilterSection label="Filters">
                  <FilterSelect panel={filter} field="module" label="Module" allLabel="All Modules" options={moduleOptions} />
                </FilterSection>
              </FilterPanel>
            </div>
          </div>
        </div>

        <ActiveFilterChips panel={filter} chips={activeChips} />

        {error && <div className="pb-error-banner">{error}</div>}

        <div className="arc-stats-grid">
          <div className="arc-stat-card">
            <div className="arc-stat-icon gold"><FiArchive /></div>
            <div><h3>{stats.total}</h3><p>{tr("Total Archived")}</p><span>{tr("All Time")}</span></div>
          </div>
          <div className="arc-stat-card">
            <div className="arc-stat-icon blue"><FiCalendar /></div>
            <div><h3>{stats.thisMonth}</h3><p>{tr("Archived This Month")}</p><span>{tr("This Month")}</span></div>
          </div>
          <div className="arc-stat-card">
            <div className="arc-stat-icon green"><FiLayers /></div>
            <div><h3>{stats.modules}</h3><p>{tr("Modules")}</p><span>{tr("Distinct")}</span></div>
          </div>
        </div>

        <TableSection className="arc-table-wrapper">
          <TableScroll>
          <table className="arc-table">
            <thead>
              <tr>
                <th className="arc-sortable-th" onClick={() => cycleSort("archivedAt")}>{tr("Archive Date")}{sortIndicator("archivedAt", sortColumn, sortDirection)}</th>
                <th className="arc-sortable-th" onClick={() => cycleSort("module")}>{tr("Module")}{sortIndicator("module", sortColumn, sortDirection)}</th>
                <th className="arc-sortable-th" onClick={() => cycleSort("recordName")}>{tr("Record Name")}{sortIndicator("recordName", sortColumn, sortDirection)}</th>
                <th className="arc-sortable-th" onClick={() => cycleSort("archivedBy")}>{tr("Archived By")}{sortIndicator("archivedBy", sortColumn, sortDirection)}</th>
                <th>{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="arc-empty-state">{tr("Loading archived records...")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="5" className="arc-empty-state">
                    <div className="arc-empty-content">
                      <FiArchive />
                      <h3>{tr("No archived records found")}</h3>
                      <p>{tr(search || filter.activeCount > 0
                        ? "No records match your search or filter."
                        : "Archived records from any module will appear here.")}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.archivedAt)}</td>
                    <td><span className={badgeClass(r.module)}>{r.module}</span></td>
                    <td>{r.recordName}</td>
                    <td>{r.archivedBy}</td>
                    <td>
                      <div className="arc-actions">
                       {canRestore(r) && (
                        <button
                          className="arc-action-btn restore"
                          onClick={() => askRestore(r)}
                          title={tr("Restore")}
                          aria-label={tr("Restore")}
                        >
                        <FiRotateCcw />
                          </button>
                        )}

                        {isOwner && (
                          <button
                            className="arc-action-btn delete"
                            onClick={() => askDelete(r)}
                            title={tr("Delete")}
                            aria-label={tr("Delete")}
                          >
                            <FiTrash2 />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
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

      {toast && <div className="arc-toast">{toast}</div>}

      {confirmRec && (
        <div className="arc-overlay" onClick={() => setConfirmRec(null)}>
          <div className="arc-modal" onClick={(e) => e.stopPropagation()}>
            {confirmMode === "delete" ? (
              <>
                <h3>{tr("Delete Permanently?")}</h3>
                <p>{tr("This will permanently delete the")}{" "}<strong>{tr(confirmRec.module)}</strong>{" "}{tr("record")}<br />
                  "<strong>{confirmRec.recordName}</strong>{tr("\". This")}{" "}<strong>{tr("cannot be undone")}</strong>.
                </p>
                <div className="arc-modal-btns">
                  <button className="arc-btn-cancel" onClick={() => setConfirmRec(null)}>{tr("Cancel")}</button>
                  <button className="arc-btn-delete" onClick={doDelete}>{tr("Delete")}</button>
                </div>
              </>
            ) : (
              <>
                <h3>{tr("Restore Record?")}</h3>
                <p>{tr("This will restore the")}{" "}<strong>{tr(confirmRec.module)}</strong>{" "}{tr("record")}<br />
                  "<strong>{confirmRec.recordName}</strong>{tr("\" back to its original module and set it")}{" "}<strong>{tr("Active")}</strong>{" "}{tr("again.")}</p>
                <div className="arc-modal-btns">
                  <button className="arc-btn-cancel" onClick={() => setConfirmRec(null)}>{tr("Cancel")}</button>
                  <button className="arc-btn-confirm" onClick={doRestore}>{tr("Restore")}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {depPreview && (
        <div className="arc-overlay" onClick={() => setDepPreview(null)}>
          <div className="arc-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{tr("Permanent Delete Blocked")}</h3>
            <p>
              <strong>"{depPreview.record.recordName}"</strong>{" "}{tr("has related records in other modules. Deleting it would affect this historical data.")}</p>
            <div className="arc-dep-list">
              {depPreview.connections.map((c) => (
                c.path ? (
                  <button
                    key={c.moduleKey}
                    className="arc-dep-row arc-dep-row-clickable"
                    onClick={() => navigate(c.path)}
                    title={`View ${c.module}`}
                  >
                    <span>{tr(c.module)}</span>
                    <span className="arc-dep-count">{c.count.toLocaleString()} →</span>
                  </button>
                ) : (
                  <div key={c.moduleKey} className="arc-dep-row">
                    <span>{tr(c.module)}</span>
                    <span className="arc-dep-count">{c.count.toLocaleString()}</span>
                  </div>
                )
              ))}
            </div>
            <p>{tr("This record cannot be permanently deleted while these connections exist. It stays safely in Archive — restore it if you need to bring it back, or keep it archived indefinitely. Click any module above to review its records.")}</p>
            <div className="arc-modal-btns">
              <button className="arc-btn-cancel" onClick={() => setDepPreview(null)}>{tr("Cancel")}</button>
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
        { label: "ARCHIVE" },
      ]}
    >
      {content}
    </PageLayout>
  );
}