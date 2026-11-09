import { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiRotateCcw, FiTrash2, FiArchive, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiEye, FiImage, FiX } from "react-icons/fi";
import { getTaskCategoryRoute } from "../taskCategoryRoutes";
import { canAccessCategory } from "../moduleRegistry";
import "./ToDo.css";
import PageLayout from "../components/PageLayout";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";
import { API_BASE } from "../api/client";
import {
  refreshMyTasksToday,
  refreshPersonalTodos,
  getCachedPrimaryTasks,
  getCachedSecondaryTasks,
  getCachedPersonalTodos,
  addPersonalTodo,
  updatePersonalTodoById,
  archivePersonalTodoById,
  deletePersonalTodoById,
  getCurrentUser,
  subscribe as subscribeTodos,
  getLastError,
} from "../todoStore";
import { getAccessibleCategories } from "../moduleRegistry";
import { useLanguage } from "../i18n/LanguageContext";
import ProofOfCompletionModal from "../components/ProofOfCompletionModal";

const FARMER_CATEGORIES = getAccessibleCategories({
  isOwner: false, canSeeFinancials: false, canViewPersonnel: false,
});

// Completion Details' Remarks text collapses behind a "View More" toggle
// past this many characters -- same threshold Personnel -> Task History
// uses, so a Farmer sees their own submission rendered consistently with
// how the Owner sees it.
const REMARKS_PREVIEW_LENGTH = 80;

// Estimated Duration is a distinct concept from Due Date: how long a task
// is expected to take, not a deadline. Same formatting as AdminTodo/
// ViewPersonnel, so a Farmer's own My Tasks table reads consistently with
// the Owner's.
function formatEstimatedDuration(est) {
  if (!est || est.value == null) return "—";
  const unit = est.unit === "hours"
    ? (est.value === 1 ? "hr" : "hrs")
    : (est.value === 1 ? "min" : "mins");
  return `${est.value} ${unit}`;
}

// Date Created is backend-generated and immutable -- this is only a
// preview of what the Farmer will see once the task actually saves (the
// real timestamp is set server-side at that moment, by PersonalTodo's own
// `timestamps: true`). Shown as the current Philippine calendar date since
// that's the farm's own local day.
function phTodayDisplay() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function withDisplayStatus(t) {
  const status = t.status || (t.done ? "Completed" : "Pending");
  if (status === "Completed") return { ...t, displayStatus: "Completed" };
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const overdue = due && !isNaN(due) && due < new Date(new Date().toDateString());
  return { ...t, displayStatus: overdue ? "Overdue" : "Pending" };
}

export default function FarmerTodo() {
  const { t: tr } = useLanguage();
  const navigate = useNavigate();
  const me = getCurrentUser({ id: "me", userId: "me", name: "Farmer" });
  console.log("CURRENT USER:", me);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceTab, setSourceTab] = useState("primary");  const [searchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState(searchParams.get("task"));
  const [proofTarget, setProofTarget] = useState(null); // { task, occurrence }
  const [photoViewer, setPhotoViewer] = useState(null); // { url, taskName, occurrenceDate }
  const [expandedRemarks, setExpandedRemarks] = useState(() => new Set());
  const toggleRemarksExpanded = (occurrenceId) => {
    setExpandedRemarks((prev) => {
      const next = new Set(prev);
      if (next.has(occurrenceId)) next.delete(occurrenceId);
      else next.add(occurrenceId);
      return next;
    });
  };

  const buildTasks = () => {
    // Primary/Secondary completion state lives on each task's own daily (or
    // lifetime, for Secondary) occurrence rather than on the task document
    // itself -- see server/controllers/personnelTaskController.getMyTasksToday.
    const primary = getCachedPrimaryTasks().map((t) => ({
      ...t, source: "primary", assignedBy: "Owner",
      status: t.occurrence?.status || "Pending", dueDate: null,
    }));
    const secondary = getCachedSecondaryTasks().map((t) => ({
      ...t, source: "secondary", assignedBy: "Owner",
      status: t.occurrence?.status || "Pending",
    }));
    const personal = getCachedPersonalTodos().map((t) => ({ ...t, source: "personal", assignedBy: "You" }));
    return [...primary, ...secondary, ...personal].map(withDisplayStatus);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([refreshMyTasksToday(), refreshPersonalTodos(me.userId)]);
    setTasks(buildTasks());
    setError(getLastError()?.message || "");
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const refresh = () => setTasks(buildTasks());
    return subscribeTodos(refresh);
  }, [me.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlightId || tasks.length === 0) return;
    const target = tasks.find((t) => t._id === highlightId);
    if (target) {
      const targetTab = (target.source === "primary" || target.source === "secondary") ? target.source : "all";
      if (targetTab !== sourceTab) {
        setSourceTab(targetTab);
        return;      }
    }
    const row = document.getElementById(`todo-row-${highlightId}`);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId, tasks, sourceTab]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingTask, setEditingTask] = useState(null); // full row, for the read-only Date Created preview only
  const [form, setForm] = useState({
    title: "", type: FARMER_CATEGORIES[0], due: "", description: "",
    estimatedDurationValue: "", estimatedDurationUnit: "minutes",
  });
  const [confirm, setConfirm] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const viewingArchived = status === "Archived";
  // My Tasks (the Personal tab) is its own table shape -- no Completion
  // Details (Personal tasks have no Photo Proof/Remarks concept at all),
  // and it adds Description/Date Created/Estimated Duration instead. The
  // "All" tab keeps mixing every category under the original shared
  // layout, since it is not one of the three distinct table structures
  // this redesign calls out (My Tasks / To Do Primary+Secondary / Task
  // History) -- only the dedicated "My Tasks" tab gets the new shape.
  const isPersonalTab = sourceTab === "personal";
  const filtered = useMemo(() => tasks.filter((t) => {
    if (sourceTab !== "all" && t.source !== sourceTab) return false;
    if (viewingArchived) { if (!t.archived) return false; }
    else { if (t.archived) return false; if (status !== "All" && t.displayStatus !== status) return false; }
    if (search) {
      const q = search.toLowerCase();
      const matches =
        (t.title || "").toLowerCase().includes(q) ||
        (t.type || t.module || "").toLowerCase().includes(q) ||
        (t.assignedBy || "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  }), [tasks, sourceTab, status, search, viewingArchived]);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "task") return row.title || "";
    if (col === "category") return row.type || row.module || "";
    if (col === "dueDate") return row.dueDate || "";
    if (col === "assignedBy") return row.assignedBy || "";
    if (col === "dateCreated") return row.createdAt || row.dateCreated || "";
    if (col === "estimatedDuration") {
      const est = row.estimatedDuration;
      if (!est || est.value == null) return -1;
      return est.unit === "hours" ? est.value * 60 : est.value;
    }
    if (col === "status") return row.displayStatus || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [sourceTab, status, search, viewingArchived]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const active = tasks.filter((t) => !t.archived && (sourceTab === "all" || t.source === sourceTab));
  const c = { total: active.length, pending: active.filter((t) => t.displayStatus === "Pending").length, completed: active.filter((t) => t.displayStatus === "Completed").length, overdue: active.filter((t) => t.displayStatus === "Overdue").length };
  const activeFilters = (status !== "All" ? 1 : 0);

  const handleViewTaskCategory = (t) => {
    const category = t.type || t.module;
    const route = getTaskCategoryRoute(category);
    if (!route) return;
    if (!canAccessCategory(category, { isOwner: false, canSeeFinancials: false, canViewPersonnel: false })) {
      alert(tr("Access Denied. You no longer have permission to access this module."));
      return;
    }
    navigate(route);
  };

  const toggle = (t) => {
    if (t.source === "primary" || t.source === "secondary") {
      // Required Proof of Completion modal -- identical flow whether opened
      // from here or from the Dashboard. A Completed occurrence is a
      // permanent historical record and is never toggled back from here;
      // Primary tasks simply get a brand-new Pending occurrence tomorrow.
      if (t.displayStatus !== "Completed") {
        setProofTarget({ task: t, occurrence: t.occurrence });
      }
      return;
    }
    if (t.displayStatus !== "Completed") {
      setConfirmComplete(t);
    } else {
      doToggle(t);
    }
  };

  const doToggle = (t) => {
  updatePersonalTodoById(
    t._id,
    {
      done: t.displayStatus !== "Completed",
      status:
        t.displayStatus === "Completed"
          ? "Pending"
          : "Completed",
    },
    me.userId
  );
};
  const openAdd = () => {
    setEditingId(null);
    setEditingTask(null);
    setForm({
      title: "", type: FARMER_CATEGORIES[0], due: "", description: "",
      estimatedDurationValue: "", estimatedDurationUnit: "minutes",
    });
    setModalOpen(true);
  };
  const openEdit = (t) => {
    setEditingId(t._id);
    setEditingTask(t);
    setForm({
      title: t.title, type: t.type, due: t.dueDate, description: t.description || "",
      estimatedDurationValue: t.estimatedDuration?.value != null ? String(t.estimatedDuration.value) : "",
      estimatedDurationUnit: t.estimatedDuration?.unit || "minutes",
    });
    setModalOpen(true);
  };
  const saveTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      // Estimated Duration is optional and distinct from Due Date -- only
      // sent when the Farmer actually entered a value.
      const estimatedDuration = form.estimatedDurationValue
        ? { value: Number(form.estimatedDurationValue), unit: form.estimatedDurationUnit }
        : null;
      if (editingId) {
        await updatePersonalTodoById(editingId, {
          title: form.title, type: form.type, dueDate: form.due,
          description: form.description, estimatedDuration,
        }, me.userId);
      } else {
        await addPersonalTodo(me.userId, {
          title: form.title, type: form.type, dueDate: form.due,
          description: form.description, estimatedDuration,
        });
        setSourceTab("personal");      }
      setModalOpen(false);
    } catch (err) {
      setError(tr(err?.message || "Couldn't save this task. Please try again."));
    } finally {
      setSaving(false);
    }
  };
  const doRestore = (t) => updatePersonalTodoById(t._id, { archived: false }, me.userId);
  const askArchive = (t) => setConfirmArchive(t);

const runArchiveConfirm = async () => {
  if (!confirmArchive) return;

  await archivePersonalTodoById(
  confirmArchive._id,
  me.userId
);
  setConfirmArchive(null);
};

  const runConfirm = async () => {
    if (!confirm) return;
    await deletePersonalTodoById(confirm.task._id, me.userId);
    setConfirm(null);
  };
  const clearFilters = () => { setStatus("All"); };

  return (
    <PageLayout
      breadcrumbItems={[{ label: "TO DO" }]}
    >

        <div className="todo-toolbar">
          <button className="todo-add-btn" onClick={openAdd}><FiPlus />{" "}{tr("New Task")}</button>
          <div className="todo-toolbar-actions">
            <div className="todo-search-box"><FiSearch /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search task...")} /></div>
            <div className="todo-filter-wrap" ref={filterRef}>
              <button className="todo-filter-btn" onClick={() => setFilterOpen((o) => !o)}>
                <FiFilter />{" "}{tr("Filter")}{activeFilters > 0 && <span className="todo-filter-count">{activeFilters}</span>}
              </button>
              {filterOpen && (
                <div className="todo-filter-dropdown">
                  <div className="todo-filter-head"><span>{tr("Filter")}</span><button className="todo-filter-clear" onClick={clearFilters}>{tr("Clear")}</button></div>
                  <div className="todo-filter-group">
                    <label className="todo-filter-label">{tr("Status")}</label>
                    <select className="todo-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option value="All">{tr("All")}</option><option value="Pending">{tr("Pending")}</option><option value="Completed">{tr("Completed")}</option><option value="Overdue">{tr("Overdue")}</option><option value="Archived">{tr("Archived")}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="todo-tabs">
          <button className={`todo-tab ${sourceTab === "all" ? "active" : ""}`} onClick={() => setSourceTab("all")}>{tr("All")}</button>
          <button className={`todo-tab ${sourceTab === "primary" ? "active" : ""}`} onClick={() => setSourceTab("primary")}>{tr("Primary Tasks")}</button>
          <button className={`todo-tab ${sourceTab === "secondary" ? "active" : ""}`} onClick={() => setSourceTab("secondary")}>{tr("Secondary Tasks")}</button>
          <button className={`todo-tab ${sourceTab === "personal" ? "active" : ""}`} onClick={() => setSourceTab("personal")}>{tr("My Tasks")}</button>
        </div>

        <div className="todo-stats">
          <div className="todo-stat-card"><div className="todo-stat-icon gold"><FiList /></div><div><h3>{c.total}</h3><p>{tr("Total Tasks")}</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon orange"><FiClock /></div><div><h3>{c.pending}</h3><p>{tr("Pending")}</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon green"><FiCheckCircle /></div><div><h3>{c.completed}</h3><p>{tr("Completed")}</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon red"><FiAlertTriangle /></div><div><h3>{c.overdue}</h3><p>{tr("Overdue")}</p></div></div>
        </div>

        {error && <p style={{ color: "#d94f4f", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}

        <TableSection className="todo-table-wrapper">
          <TableScroll>
          <table className="todo-table">
            <thead>
              {isPersonalTab ? (
                <tr>
                  <th className="todo-sortable-th" onClick={() => cycleSort("task")}>{tr("Task Name")}{sortIndicator("task", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("category")}>{tr("Task Category")}{sortIndicator("category", sortColumn, sortDirection)}</th>
                  <th>{tr("Description")}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("dateCreated")}>{tr("Date Created")}{sortIndicator("dateCreated", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("dueDate")}>{tr("Due Date")}{sortIndicator("dueDate", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("estimatedDuration")}>{tr("Estimated Duration")}{sortIndicator("estimatedDuration", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("status")}>{tr("Status")}{sortIndicator("status", sortColumn, sortDirection)}</th>
                  <th style={{ width: 120 }}>{tr("Action")}</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: 64 }}>{viewingArchived ? "" : "Done"}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("task")}>{tr("Task")}{sortIndicator("task", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("category")}>{tr("Category")}{sortIndicator("category", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("dueDate")}>{tr("Due Date")}{sortIndicator("dueDate", sortColumn, sortDirection)}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("assignedBy")}>{tr("Assigned By")}{sortIndicator("assignedBy", sortColumn, sortDirection)}</th>
                  <th>{tr("Completion Details")}</th>
                  <th className="todo-sortable-th" onClick={() => cycleSort("status")}>{tr("Status")}{sortIndicator("status", sortColumn, sortDirection)}</th>
                  <th style={{ width: 100 }}>{tr("Actions")}</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading && <tr className="todo-empty-row"><td colSpan={8}>{tr("Loading tasks…")}</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr className="todo-empty-row"><td colSpan={8}>
                  {viewingArchived
                    ? "No archived tasks."
                    : (search || status !== "All")
                    ? "No Matching Tasks Found"
                    : sourceTab === "personal"
                    ? "No Personal Tasks Found"
                    : sourceTab === "primary"
                    ? "No Primary Tasks Found"
                    : sourceTab === "secondary"
                    ? "No Secondary Tasks Found"
                    : "No Tasks Found"}
                </td></tr>
              )}
              {!loading && pageRows.map((t) => {
                const done = t.displayStatus === "Completed";

                // My Tasks (Personal) row: Task Name, Task Category,
                // Description, Date Created, Due Date, Estimated Duration,
                // Status, Action -- no Completion Details column at all
                // (Personal tasks have no Photo Proof/Remarks concept),
                // and no "Assigned By" (every row here is self-assigned).
                // The completion toggle moves into the Action cell instead
                // of a separate Done checkbox column, but calls the exact
                // same `toggle(t)` used everywhere else -- same confirm
                // dialog, same doToggle, same completion workflow.
                if (isPersonalTab) {
                  return (
                    <tr key={t._id} id={`todo-row-${t._id}`} className={`${done && !viewingArchived ? "is-done" : ""} ${highlightId === t._id ? "todo-row-highlight" : ""}`}>
                      <td><span className="todo-task-title">{t.title}</span></td>
                      <td>{tr(t.type)}</td>
                      <td className="todo-completion-remarks-text" style={{ maxWidth: 240 }} title={t.description || undefined}>{t.description || "—"}</td>
                      <td>{t.createdAt ? new Date(t.createdAt).toISOString().split("T")[0] : (t.dateCreated ? new Date(t.dateCreated).toISOString().split("T")[0] : "—")}</td>
                      <td>{t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "—"}</td>
                      <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                      <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
                      <td>
                        <div className="todo-row-actions">
                          {viewingArchived ? (
                            <>
                              <button className="todo-icon-btn restore" onClick={() => doRestore(t)} title={tr("Restore")}><FiRotateCcw /></button>
                              <button className="todo-del-btn" onClick={() => setConfirm({ type: "delete", task: t })} title={tr("Delete")}><FiTrash2 /></button>
                            </>
                          ) : (
                            <>
                              <button
                                className={`todo-icon-btn ${done ? "archive" : "edit"}`}
                                onClick={() => toggle(t)}
                                title={done ? tr("Mark as pending") : tr("Mark as done")}
                              ><FiCheck /></button>
                              <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title={tr("Edit")}><FiEdit2 /></button>
                              <button className="todo-icon-btn archive" onClick={() => askArchive(t)} title={tr("Archive")}><FiArchive /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={t._id} id={`todo-row-${t._id}`} className={`${done && !viewingArchived ? "is-done" : ""} ${highlightId === t._id ? "todo-row-highlight" : ""}`}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">{tr("Archived")}</span> : done && (t.source === "primary" || t.source === "secondary") ? <span className="todo-check todo-check-readonly checked" title={tr("Completed — Proof of Completion already submitted for this occurrence")}><FiCheck /></span> : <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggle(t)} title={done ? tr("Mark as pending") : tr("Mark as done")}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{tr(t.type)}</td>
                    <td>{t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : ""}</td>
                    <td>{t.assignedBy}</td>
                    <td className="todo-completion-cell">
                      {(() => {
                        // Completion Details only ever applies to Primary/
                        // Secondary rows, and only once that occurrence's
                        // own Proof of Completion submission has actually
                        // saved (status === "Completed") -- a Pending
                        // occurrence, or a Personal task (no photo/remarks
                        // concept at all), always shows the "—" placeholder.
                        // Photo + remarks both come from this row's own
                        // `t.occurrence` -- the same occurrence record the
                        // Farmer just submitted to and the one Personnel ->
                        // Task History reads for the Owner -- so there is
                        // no risk of pairing them with another occurrence.
                        if (t.source !== "primary" && t.source !== "secondary") {
                          return <span className="todo-completion-dash">—</span>;
                        }
                        const occ = t.occurrence;
                        if (!occ || occ.status !== "Completed") {
                          return <span className="todo-completion-dash">—</span>;
                        }
                        const occId = occ._id;
                        const isExpanded = expandedRemarks.has(occId);
                        const remarks = occ.remarks || "";
                        const isLong = remarks.length > REMARKS_PREVIEW_LENGTH;
                        const remarksPreview = isLong && !isExpanded
                          ? `${remarks.slice(0, REMARKS_PREVIEW_LENGTH)}…`
                          : remarks;
                        return (
                          <>
                            <div className="todo-completion-photo">
                              {occ.photoProofUrl ? (
                                <button
                                  type="button"
                                  className="todo-completion-thumb-btn"
                                  onClick={() => setPhotoViewer({
                                    url: `${API_BASE}${occ.photoProofUrl}`,
                                    taskName: t.title,
                                    occurrenceDate: occ.occurrenceDate,
                                  })}
                                  title={tr("View Photo")}
                                >
                                  <img
                                    src={`${API_BASE}${occ.photoProofUrl}`}
                                    alt={tr("Photo proof thumbnail")}
                                    className="todo-completion-thumb"
                                    loading="lazy"
                                  />
                                  <span className="todo-completion-thumb-label"><FiImage /> {tr("View Photo")}</span>
                                </button>
                              ) : (
                                <span className="todo-completion-no-photo">{tr("No photo")}</span>
                              )}
                            </div>
                            <div className="todo-completion-remarks">
                              {remarks ? (
                                <>
                                  <p className="todo-completion-remarks-text" title={isLong ? remarks : undefined}>
                                    {remarksPreview}
                                  </p>
                                  {isLong && (
                                    <button
                                      type="button"
                                      className="todo-completion-toggle"
                                      onClick={() => toggleRemarksExpanded(occId)}
                                    >
                                      {isExpanded ? tr("View Less") : tr("View More")}
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="todo-completion-no-remarks">{tr("No remarks")}</span>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
                    <td>
                      <div className="todo-row-actions">
                        {(t.source === "primary" || t.source === "secondary") ? (
                          <>
                            {getTaskCategoryRoute(t.type || t.module) && (
                              <button className="todo-icon-btn view" onClick={() => handleViewTaskCategory(t)} title={tr("View Related Module")}><FiEye /></button>
                            )}
                            <span className="todo-archived-tag" title={tr("Assigned by Owner — managed from the Owner To Do page")}>{tr(t.source === "primary" ? "Primary" : "Secondary")}</span>
                          </>
                        ) : viewingArchived ? (
                          <>
                            <button className="todo-icon-btn restore" onClick={() => doRestore(t)} title={tr("Restore")}><FiRotateCcw /></button>
                            <button className="todo-del-btn" onClick={() => setConfirm({ type: "delete", task: t })} title={tr("Delete")}><FiTrash2 /></button>
                          </>
                        ) : (
                          <>
                            <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title={tr("Edit")}><FiEdit2 /></button>
                            <button className="todo-icon-btn archive" onClick={() => askArchive(t)} title={tr("Archive")}><FiArchive /></button>
                          </>
                        )}
                      </div>
                    </td>
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
      

      {modalOpen && (
        <div className="todo-overlay" onClick={() => setModalOpen(false)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-head"><h3>{editingId ? "Edit Task" : "New Task"}</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>{tr("Task Title")}</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tr("e.g. Refill water dispensers")} /></div>

              {/* Date Created is backend-generated (PersonalTodo's own
                  `timestamps: true`) and never editable here -- adding
                  previews today's Philippine date (the real timestamp is
                  set server-side at the moment of creation); editing shows
                  the task's real, original Date Created, and the backend
                  strips any createdAt sent in the update body regardless. */}
              <div className="todo-field">
                <label>{tr("Date Created")}</label>
                <span className="todo-archived-tag" title={tr("Automatically recorded when the task is created — never editable.")}>
                  {editingTask
                    ? ((editingTask.createdAt || editingTask.dateCreated) ? String(editingTask.createdAt || editingTask.dateCreated).split("T")[0] : "—")
                    : phTodayDisplay()}
                </span>
              </div>

              <div className="todo-field"><label>{tr("Category")}</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{FARMER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>

              <div className="todo-field">
                <label>{tr("Description")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label>
                <textarea
                  rows="3"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={tr("Optional details about this task")}
                />
              </div>

              <div className="todo-field"><label>{tr("Due Date")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>

              {/* Estimated Duration -- how long the task is expected to
                  take. Optional, distinct from Due Date, never
                  auto-completes or expires a task. */}
              <div className="todo-field">
                <label>{tr("Estimated Duration")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    style={{ flex: 1 }}
                    value={form.estimatedDurationValue}
                    onChange={(e) => setForm({ ...form, estimatedDurationValue: e.target.value })}
                    placeholder={tr("e.g. 30")}
                  />
                  <select
                    style={{ flex: 1 }}
                    value={form.estimatedDurationUnit}
                    onChange={(e) => setForm({ ...form, estimatedDurationUnit: e.target.value })}
                  >
                    <option value="minutes">{tr("Minutes")}</option>
                    <option value="hours">{tr("Hours")}</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>{tr("Cancel")}</button><button className="todo-btn-save" onClick={saveTask} disabled={saving || !form.title.trim()}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add Task"}</button></div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="todo-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">{tr("Delete Task")}</h3>
            <p className="todo-confirm-message">{`Are you sure you want to delete "${confirm.task.title}"? This action cannot be undone.`}</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirm(null)}>{tr("Cancel")}</button>
              <button className="todo-confirm-delete" onClick={runConfirm}>{tr("Delete")}</button>
            </div>
          </div>
        </div>
      )}

      {confirmComplete && (
        <div className="todo-confirm-overlay" onClick={() => setConfirmComplete(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">{tr("Mark this task as completed?")}</h3>
            <p className="todo-confirm-message">{tr("The task status will be changed to Completed.")}</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirmComplete(null)}>{tr("Cancel")}</button>
              <button className="todo-btn-save" onClick={() => { doToggle(confirmComplete); setConfirmComplete(null); }}>{tr("Mark as Completed")}</button>
            </div>
          </div>
        </div>
      )}

      {confirmArchive && (
  <div
    className="fp-confirm-overlay"
    onClick={() => setConfirmArchive(null)}
  >
    <div
      className="fp-confirm-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="fp-confirm-title">{tr("Archive Personal Task")}</h3>

      <p className="fp-confirm-message">{tr("Move task \"")}{confirmArchive.title}{tr("\" to the archive? You can restore it anytime from the Archive page.")}</p>

      <div className="fp-confirm-actions">
        <button
          className="fp-confirm-cancel"
          onClick={() => setConfirmArchive(null)}
        >{tr("Cancel")}</button>

        <button
          className="fp-confirm-archive"
          onClick={runArchiveConfirm}
        >{tr("Archive")}</button>
      </div>
    </div>
  </div>
)}

      {proofTarget && (
        <ProofOfCompletionModal
          task={proofTarget.task}
          occurrence={proofTarget.occurrence}
          onClose={() => setProofTarget(null)}
          onSubmitted={() => setTasks(buildTasks())}
        />
      )}

      {photoViewer && (
        <div className="poc-overlay" onClick={() => setPhotoViewer(null)}>
          <div className="poc-modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 100%)" }}>
            <div className="poc-head">
              <h3>{photoViewer.taskName} — {photoViewer.occurrenceDate}</h3>
              <button className="poc-close" onClick={() => setPhotoViewer(null)} aria-label={tr("Close")}><FiX /></button>
            </div>
            <div className="poc-body">
              <img src={photoViewer.url} alt={tr("Photo proof")} className="poc-preview-img" style={{ maxHeight: "60vh" }} />
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}