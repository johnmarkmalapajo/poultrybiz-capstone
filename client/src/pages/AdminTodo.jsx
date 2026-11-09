import React, { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiArchive, FiRotateCcw, FiTrash2, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiEye, FiToggleLeft, FiToggleRight } from "react-icons/fi";
import { getTaskCategoryRoute } from "../taskCategoryRoutes";
import { getAccessibleCategories, canAccessCategory } from "../moduleRegistry";
import { listPersonalTodos } from "../api/todo";
import { getPersonnelTasks } from "../api/personnelManpower";
import "./ToDo.css";
import PageLayout from "../components/PageLayout";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination, { TableSection, TableScroll } from "../components/TablePagination";
import { useUser } from "../hooks/useUser";
import {
  refreshAllAssignedTasks, getCachedAllAssignedTasks,
  refreshOthersPersonalTodos, getCachedOthersPersonalTodos,
  refreshPersonalTodos, getCachedPersonalTodos,
  assignTask, updateAssignedTaskById, deleteAssignedTaskById,
  setAssignedTaskDoneById, updatePersonalTodoById,archiveAssignedTaskById, deletePersonalTodoById,
  getFarmerList, subscribe as subscribeTodos, getLastError,
  addPersonalTodo,
} from "../todoStore";
import { useLanguage } from "../i18n/LanguageContext";

// Estimated Duration is a distinct concept from Due Date: how long a task
// is expected to take, not a deadline. Applies to every category.
function formatEstimatedDuration(est) {
  if (!est || est.value == null) return "—";
  const unit = est.unit === "hours"
    ? (est.value === 1 ? "hr" : "hrs")
    : (est.value === 1 ? "min" : "mins");
  return `${est.value} ${unit}`;
}

// Date Created is backend-generated and immutable -- this is only a
// preview of what the Owner will see once the task actually saves (the
// real timestamp is set server-side at that moment). Shown as the current
// Philippine calendar date since that's the farm's own local day.
function phTodayDisplay() {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function withDisplayStatus(t) {
  if (t.status === "Completed") return { ...t, displayStatus: "Completed" };
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const overdue = due && !isNaN(due) && due < new Date(new Date().toDateString());
  return { ...t, displayStatus: overdue ? "Overdue" : "Pending" };
}

export default function AdminTodo() {
  const { t: tr } = useLanguage();
  const { user, isOwner, canSeeFinancials, canViewPersonnel } = useUser();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState(searchParams.get("task"));

  const loadAll = async () => {
    setLoading(true);
    const [, , , personnelList] = await Promise.all([
      refreshAllAssignedTasks(),
      refreshOthersPersonalTodos(),
      refreshPersonalTodos(user?.id),
      getFarmerList(),
    ]);

    const assignableRoles = ["Farmer"];
    setFarmers(
      personnelList
        .filter((p) => assignableRoles.includes(p.user?.role))
        .map((p) => ({
          id: p._id,
          userId: p.user?._id,
          name: p.user?.name || "Unknown",
          role: p.user?.role || "Farmer",
        }))
    );

    setTasks(mergeTaskSources().map(withDisplayStatus));
    setError(getLastError()?.message || "");
    setLoading(false);
  };

  const mergeTaskSources = () => {
    // Replaces the old single "Assigned Task" source: every PersonnelTask
    // is now either a recurring Primary task or a one-off Secondary task
    // (see server/models/PersonnelTask.js's `category` field).
    const assigned = getCachedAllAssignedTasks()
      .filter((t) => !t.linkedPersonalTodo)
      .map((t) => ({ ...t, source: t.category === "Primary" ? "primary" : "secondary" }));
    const others = getCachedOthersPersonalTodos().map((t) => ({
      ...t,
      source: "personal",
      title: t.title,
      type: t.type,
      farmerName: t.user?.name || "Unknown",
    }));
    const mine = getCachedPersonalTodos().map((t) => ({
      ...t,
      source: "own-personal",
      farmerName: `${user?.name || "You"} (own)`,
    }));
    return [...assigned, ...others, ...mine];
  };

  useEffect(() => {
    loadAll();
    const refresh = () => setTasks(mergeTaskSources().map(withDisplayStatus));
    return subscribeTodos(refresh);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [editingTask, setEditingTask] = useState(null);  const canReassignEditingTask = isOwner;
  const [form, setForm] = useState({
    title: "", type: "Records", due: "",
    estimatedDurationValue: "", estimatedDurationUnit: "minutes",
    farmerId: "", category: "Secondary",
  });
  const [isPersonal, setIsPersonal] = useState(false);  const [pendingPersonal, setPendingPersonal] = useState([]);
  const [pendingAssigned, setPendingAssigned] = useState([]);
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [confirm, setConfirm] = useState(null);  const [sourceTab, setSourceTab] = useState("primary");
  useEffect(() => {
    if (!modalOpen || isPersonal || !form.farmerId) {
      setPendingPersonal([]);
      setPendingAssigned([]);
      return;
    }
    const selected = farmers.find((f) => f.id === form.farmerId);
    if (!selected) return;

    setLoadingWorkload(true);
    Promise.all([
      selected.userId ? listPersonalTodos(selected.userId).catch(() => []) : Promise.resolve([]),
      getPersonnelTasks(selected.id).catch(() => []),
    ]).then(([personalRes, assignedRes]) => {
      const personalList = Array.isArray(personalRes) ? personalRes : (personalRes?.records || personalRes?.data || []);
      const assignedList = Array.isArray(assignedRes) ? assignedRes : (assignedRes?.records || assignedRes?.data || []);
      setPendingPersonal(personalList.filter((t) => !t.archived && t.status === "Pending"));
      setPendingAssigned(
        assignedList.filter((t) => !t.archived && !t.linkedPersonalTodo && t.status === "Pending")
      );
    }).finally(() => setLoadingWorkload(false));
  }, [modalOpen, isPersonal, form.farmerId, farmers]);

  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

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

const viewingArchived = status === "Archived";
  // Primary tasks never have a Due Date -- while viewing the Primary
  // Tasks tab specifically, the column itself is omitted entirely rather
  // than showing a column full of placeholder dashes.
  const hideDueDateColumn = sourceTab === "primary";
  const inSourceTab = (t) => {
    if (sourceTab === "all") return true;
    if (sourceTab === "primary") return t.source === "primary";
    if (sourceTab === "secondary") return t.source === "secondary";
    return t.source === "own-personal";  };
  const filtered = useMemo(() => tasks.filter((t) => {
    if (!inSourceTab(t)) return false;
    if (viewingArchived) { if (!t.archived) return false; }
    else { if (t.archived) return false; if (status !== "All" && t.displayStatus !== status) return false; }
    if (search) {
      const q = search.toLowerCase();
      const matches =
        (t.title || "").toLowerCase().includes(q) ||
        (t.type || t.module || "").toLowerCase().includes(q) ||
        (t.assignedBy || "").toLowerCase().includes(q) ||
        (t.farmerName || "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  }), [tasks, sourceTab, status, search, viewingArchived]);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "task") return row.title || "";
    if (col === "category") return row.type || row.module || "";
    if (col === "assignedTo") return row.farmerName || "";
    if (col === "estimatedDuration") {
      const est = row.estimatedDuration;
      if (!est || est.value == null) return -1;
      return est.unit === "hours" ? est.value * 60 : est.value;
    }
    if (col === "dueDate") {
      if (row.source === "personal" || row.source === "own-personal") return row.dueDate || "";
      return row.category === "Primary" ? "" : (row.dueDate || "");
    }
    if (col === "dateCreated") return row.dateCreated || row.createdAt || "";
    if (col === "status") return row.displayStatus || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [sourceTab, status, search, viewingArchived]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const active = tasks.filter((t) => !t.archived && inSourceTab(t));
  const c = { total: active.length, pending: active.filter((t) => t.displayStatus === "Pending").length, completed: active.filter((t) => t.displayStatus === "Completed").length, overdue: active.filter((t) => t.displayStatus === "Overdue").length };
  const activeFilters = (status !== "All" ? 1 : 0);

  const categoryOptionsFor = (personal = isPersonal) => {
    const all = getAccessibleCategories({ isOwner, canSeeFinancials, canViewPersonnel });
    return personal ? all : all.filter((c) => c !== "Flock Profile");
  };

  // The active task tab decides the new task's default category -- never
  // a stale/arbitrary default that could be saved without the Owner
  // noticing. "All" has no single category to infer, so it keeps the
  // previous default (Secondary).
  const openAdd = () => {
    setEditingTask(null);
    const personalDefault = sourceTab === "personal";
    const categoryDefault = sourceTab === "primary" ? "Primary" : "Secondary";
    setIsPersonal(personalDefault);
    const defaultFarmerId = farmers[0]?.id || "";
    setForm({
      title: "", type: categoryOptionsFor(personalDefault)[0], due: "",
      estimatedDurationValue: "", estimatedDurationUnit: "minutes",
      farmerId: defaultFarmerId, category: categoryDefault,
    });
    setModalOpen(true);
  };
  const openEdit = (t) => {
    setEditingTask(t);
    setForm({
      title: t.title,
      type: t.type,
      due: t.dueDate ? String(t.dueDate).split("T")[0] : "",
      estimatedDurationValue: t.estimatedDuration?.value != null ? String(t.estimatedDuration.value) : "",
      estimatedDurationUnit: t.estimatedDuration?.unit || "minutes",
      farmerId: t.personnelId,
      category: t.category || "Secondary",
    });
    setModalOpen(true);
  };

  const handleViewTaskCategory = (t) => {
    const category = t.type || t.module;
    const route = getTaskCategoryRoute(category);
    if (!route) return;
    if (!canAccessCategory(category, { isOwner, canSeeFinancials, canViewPersonnel })) {
      alert(tr("Access Denied. You no longer have permission to access this module."));
      return;
    }
    navigate(route);
  };

  const saveTask = async () => {
    if (!form.title.trim()) {
      setError(tr("Task title is required."));
      return;
    }
    if (!form.farmerId) {
      setError(tr("Please select a farmer."));
      return;
    }

    setSaving(true);
    setError("");
    // Estimated Duration applies to every category, including Primary.
    const estimatedDuration = form.estimatedDurationValue
      ? { value: Number(form.estimatedDurationValue), unit: form.estimatedDurationUnit }
      : null;
    try {
      if (editingTask) {
        // editingTask rows are always Primary/Secondary (never personal --
        // personal rows have no Edit action). Due Date is never
        // applicable to Primary; optional for Secondary.
        const payload = {
          work: form.title.trim(),
          module: form.type,
          estimatedDuration,
          dueDate: form.category === "Primary" ? null : (form.due || null),
        };
        if (form.farmerId !== editingTask.personnelId) {
          payload.personnelId = form.farmerId;
        }
        await updateAssignedTaskById(editingTask.personnelId, editingTask._id, payload);
      } else if (isPersonal) {
        await addPersonalTodo(user.id, { title: form.title.trim(), type: form.type, dueDate: form.due, estimatedDuration });
        setSourceTab("personal");      } else {
        await assignTask(
          form.farmerId,
          {
            title: form.title.trim(),
            type: form.type,
            category: form.category,
            estimatedDuration,
            // Due Date is never applicable to Primary tasks (perpetually
            // recurring); optional for Secondary.
            dueDate: form.category === "Primary" ? null : (form.due || null),
          },
          user?.name || "Owner"
        );
        setSourceTab(form.category === "Primary" ? "primary" : "secondary");
      }

      setForm({
        title: "",
        type: "Records",
        due: "",
        estimatedDurationValue: "",
        estimatedDurationUnit: "minutes",
        farmerId: farmers[0]?.id || "",
        category: "Secondary",
      });
      setEditingTask(null);
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(tr(err?.message || "Couldn't save this task. Please try again."));
    } finally {
      setSaving(false);
    }
  };
const doRestore = (t) => updateAssignedTaskById( t.personnelId, t._id, { archived: false } );
const archiveTask = (t) => archiveAssignedTaskById( t.personnelId, t._id );

// Deactivating a Primary/Secondary task definition stops it from producing
// any new daily/lifetime occurrences going forward, without deleting the
// task or any of its historical occurrences (unlike Archive, which hides
// the task entirely).
const toggleActiveFor = async (t) => {
  try {
    await updateAssignedTaskById(t.personnelId, t._id, { active: !(t.active !== false) });
    await loadAll();
  } catch (err) {
    setError(tr(err?.message || "Couldn't update this task. Please try again."));
  }
};

  const runArchiveConfirm = async () => {
  if (!confirmArchive) return;

  await archiveAssignedTaskById(
    confirmArchive.personnelId,
    confirmArchive._id
  );

  setConfirmArchive(null);
  await loadAll();
};

  // Check / uncheck a task. Works for all three kinds of rows the Owner sees:
  // tasks assigned to Farmers, Farmers' personal tasks, and the Owner's own.
  const applyDone = async (t, markDone) => {
    try {
      setError("");
      if (t.source === "own-personal") {
        await updatePersonalTodoById(t._id, { status: markDone ? "Completed" : "Pending" }, user?.id);
      } else if (t.source === "personal") {
        await updatePersonalTodoById(t._id, { status: markDone ? "Completed" : "Pending" }, user?.id);
        await refreshOthersPersonalTodos();
      } else {
        await setAssignedTaskDoneById(t.personnelId, t._id, markDone);
      }
    } catch (err) {
      setError(tr(err?.message || "Couldn't update this task. Please try again."));
    }
  };

  const toggleDone = (t) => {
    if (t.displayStatus === "Completed") applyDone(t, false);
    else setConfirm({ type: "complete", task: t });
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === "delete") {
      await deleteAssignedTaskById(confirm.task.personnelId, confirm.task._id);
    } else if (confirm.type === "complete") {
      await applyDone(confirm.task, true);
    }
    setConfirm(null);
    await loadAll();
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
              <tr>
                <th style={{ width: 64 }}>{viewingArchived ? "" : "Done"}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("task")}>{tr("Task")}{sortIndicator("task", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("category")}>{tr("Category")}{sortIndicator("category", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("assignedTo")}>{tr("Assigned To")}{sortIndicator("assignedTo", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("dateCreated")}>{tr("Date Created")}{sortIndicator("dateCreated", sortColumn, sortDirection)}</th>
                {!hideDueDateColumn && (
                  <th className="todo-sortable-th" onClick={() => cycleSort("dueDate")}>{tr("Due Date")}{sortIndicator("dueDate", sortColumn, sortDirection)}</th>
                )}
                <th className="todo-sortable-th" onClick={() => cycleSort("estimatedDuration")}>{tr("Estimated Duration")}{sortIndicator("estimatedDuration", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("status")}>{tr("Status")}{sortIndicator("status", sortColumn, sortDirection)}</th>
                <th style={{ width: 100 }}>{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="todo-empty-row"><td colSpan={hideDueDateColumn ? 8 : 9}>{tr("Loading tasks…")}</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr className="todo-empty-row"><td colSpan={hideDueDateColumn ? 8 : 9}>
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
                const farmerName = t.farmerName || "Unknown";
                const isPersonal = t.source === "personal";
                const isOwnPersonal = t.source === "own-personal";
                const isFarmerAssigned = t.source === "primary" || t.source === "secondary";
                const canManageAssigned = isFarmerAssigned && isOwner;
                const isActive = t.active !== false;
                return (
                  <tr key={t._id} id={`todo-row-${t._id}`} className={`${done && !viewingArchived ? "is-done" : ""} ${highlightId === t._id ? "todo-row-highlight" : ""}`}>
                    <td>
                      {viewingArchived ? (
                        <span className="todo-archived-tag">{tr("Archived")}</span>
                      ) : isFarmerAssigned ? (
                        // Completion now requires the Farmer's own Proof of
                        // Completion submission -- the Owner can no longer
                        // mark it done directly from here. See Personnel ›
                        // Task History for each day's submission.
                        <span className="todo-check todo-check-readonly" title={tr("Completion is submitted by the Farmer with Proof of Completion — see Personnel › Task History")}>—</span>
                      ) : (isOwnPersonal || isOwner) ? (
                        <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggleDone(t)} title={done ? tr("Mark as pending") : tr("Mark as done")}>{done && <FiCheck />}</span>
                      ) : (
                        <span className={`todo-check todo-check-readonly ${done ? "checked" : ""}`} title={done ? tr("Completed") : tr("Not yet completed")}>{done && <FiCheck />}</span>
                      )}
                    </td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{tr(t.type)}</td>
                    <td>{farmerName}</td>
                    <td>{(t.dateCreated || t.createdAt) ? String(t.dateCreated || t.createdAt).split("T")[0] : "—"}</td>
                    {!hideDueDateColumn && (
                      <td>
                        {isFarmerAssigned
                          ? (t.category === "Primary" ? "—" : (t.dueDate ? String(t.dueDate).split("T")[0] : "—"))
                          : (t.dueDate ? String(t.dueDate).split("T")[0] : "—")}
                      </td>
                    )}
                    <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                    <td>
                      {isFarmerAssigned ? (
                        <span className={`status ${isActive ? "pending" : "archived"}`} title={tr("Daily completion status is tracked per occurrence — see Personnel › Task History")}>
                          {isActive ? tr("Active") : tr("Deactivated")}
                        </span>
                      ) : (
                        <span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span>
                      )}
                    </td>
                    <td>
                      <div className="todo-row-actions">
                        {isPersonal ? null : isOwnPersonal ? (
                          viewingArchived ? (
                            <>
                              <button className="todo-icon-btn restore" onClick={() => updatePersonalTodoById(t._id, { archived: false }, user?.id)} title={tr("Restore")}><FiRotateCcw /></button>
                              <button className="todo-del-btn" onClick={() => deletePersonalTodoById(t._id, user?.id)} title={tr("Delete")}><FiTrash2 /></button>
                            </>
                          ) : (
                            <button className="todo-icon-btn archive" onClick={() => updatePersonalTodoById(t._id, { archived: true }, user?.id)} title={tr("Archive")}><FiArchive /></button>
                          )
                        ) : !canManageAssigned ? null : viewingArchived ? (
                          <>
                            <button className="todo-icon-btn restore" onClick={() => doRestore(t)} title={tr("Restore")}><FiRotateCcw /></button>
                            <button className="todo-del-btn" onClick={() => setConfirm({ type: "delete", task: t })} title={tr("Delete")}><FiTrash2 /></button>
                          </>
                        ) : (
                          <>
                            {getTaskCategoryRoute(t.type || t.module) && (
                              <button className="todo-icon-btn view" onClick={() => handleViewTaskCategory(t)} title={tr("View Related Module")}><FiEye /></button>
                            )}
                            <button
                              className="todo-icon-btn"
                              onClick={() => toggleActiveFor(t)}
                              title={isActive ? tr("Deactivate — stop producing new daily occurrences") : tr("Reactivate")}
                            >
                              {isActive ? <FiToggleRight /> : <FiToggleLeft />}
                            </button>
                            <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title={tr("Edit")}><FiEdit2 /></button>
                            <button className="todo-icon-btn archive" onClick={() => setConfirmArchive(t)} title={tr("Archive")}> <FiArchive /></button>
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
            <div className="todo-modal-head"><h3>{editingTask ? "Edit Task" : "New Task"}</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>{tr("Task Title")}</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tr("e.g. Review egg production")} /></div>

              {/* Date Created is backend-generated and immutable -- shown
                  here so the Owner isn't left guessing, but never editable.
                  When adding a new task, this previews today's Philippine
                  date (the actual timestamp is set by the server at the
                  moment of creation); when editing, it shows the task's
                  real, original Date Created. */}
              <div className="todo-field">
                <label>{tr("Date Created")}</label>
                <span className="todo-archived-tag" title={tr("Automatically recorded when the task is created — never editable.")}>
                  {editingTask
                    ? ((editingTask.dateCreated || editingTask.createdAt) ? String(editingTask.dateCreated || editingTask.createdAt).split("T")[0] : "—")
                    : phTodayDisplay()}
                </span>
              </div>

              {!editingTask && (
                <div className="todo-field" style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <input type="checkbox" id="isPersonalTask" checked={isPersonal} onChange={(e) => {
                    const personal = e.target.checked;
                    setIsPersonal(personal);
                    setForm((f) => ({ ...f, type: categoryOptionsFor(personal)[0] || f.type }));
                  }} style={{ width: 16, height: 16, margin: 0, marginTop: 2, flexShrink: 0 }} />
                  <label htmlFor="isPersonalTask" style={{ display: "inline", margin: 0, cursor: "pointer", lineHeight: 1.3 }}>{tr("Personal task (for myself)")}</label>
                </div>
              )}

              {!isPersonal && !editingTask && (
                <div className="todo-field">
                  <label>{tr("Task Category")}</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="Primary">{tr("Primary — recurring daily responsibility")}</option>
                    <option value="Secondary">{tr("Secondary — one-off special assignment")}</option>
                  </select>
                </div>
              )}

              {!isPersonal && editingTask && (
                <div className="todo-field">
                  <label>{tr("Task Category")}</label>
                  <span className="todo-archived-tag" title={tr("Task category cannot be changed after creation.")}>
                    {tr(form.category === "Primary" ? "Primary" : "Secondary")}
                  </span>
                </div>
              )}

              {!isPersonal && (
                <div className="todo-field">
                  <label>{tr("Assign To")}{editingTask && !canReassignEditingTask && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#a06a1a", background: "#fdf2e6", padding: "2px 8px", borderRadius: 20 }}>{tr("Locked")}</span>}</label>
                  <select value={form.farmerId} disabled={!!editingTask && !canReassignEditingTask} onChange={(e) => {
                    const farmerId = e.target.value;
                    setForm({ ...form, farmerId, type: categoryOptionsFor(false)[0] });
                  }}>
                    <option value="">{tr("Select a Farmer…")}</option>
                    {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {!isPersonal && form.farmerId && (
                <div className="todo-field">
                  <label>{tr("Current Pending Tasks")}{" "}<span className="pw-hint">{tr("(workload visibility only — does not block saving)")}</span></label>
                  {loadingWorkload ? (
                    <div className="pw-empty">{tr("Loading current workload…")}</div>
                  ) : (pendingPersonal.length === 0 && pendingAssigned.length === 0) ? (
                    <div className="pw-empty">{tr("No pending tasks — this person's workload is currently clear.")}</div>
                  ) : (
                    <div className="pw-widget">
                      {pendingPersonal.length > 0 && (
                        <div className="pw-section">
                          <div className="pw-section-title">{tr("Pending Personal Tasks")}</div>
                          <table className="pw-table pw-table-personal">
                            <thead><tr><th>{tr("Category")}</th><th>{tr("Task Title")}</th><th>{tr("Due Date")}</th><th>{tr("Status")}</th></tr></thead>
                            <tbody>
                              {pendingPersonal.map((t) => (
                                <tr key={t._id}>
                                  <td title={t.type}>{t.type ? tr(t.type) : "—"}</td>
                                  <td title={t.title}>{t.title}</td>
                                  <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                                  <td>{tr(t.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {pendingAssigned.length > 0 && (
                        <div className="pw-section">
                          <div className="pw-section-title">{tr("Pending Assigned Tasks")}</div>
                          <table className="pw-table pw-table-assigned">
                            <thead><tr><th>{tr("Assigned By")}</th><th>{tr("Category")}</th><th>{tr("Task Title")}</th><th>{tr("Estimated Duration")}</th><th>{tr("Due Date")}</th><th>{tr("Status")}</th></tr></thead>
                            <tbody>
                              {pendingAssigned.map((t) => (
                                <tr key={t._id}>
                                  <td title={t.assignedBy}>{t.assignedBy || "—"}</td>
                                  <td title={t.type}>{t.type ? tr(t.type) : "—"}</td>
                                  <td title={t.title}>{t.title}</td>
                                  <td>{formatEstimatedDuration(t.estimatedDuration)}</td>
                                  <td>{t.category === "Primary" ? "—" : (t.dueDate ? String(t.dueDate).split("T")[0] : "—")}</td>
                                  <td>{tr(t.status)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <div className="todo-field"><label>{tr("Category")}</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{categoryOptionsFor(isPersonal).map((c) => <option key={c}>{c}</option>)}</select></div>

              {/* Estimated Duration -- how long the task is expected to
                  take. Optional, applies to every category including
                  Primary, and never auto-completes or expires a task. */}
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

              {/* Due Date -- an optional deadline, distinct from Estimated
                  Duration. Never applicable to Primary tasks; optional for
                  Secondary and Personal tasks. */}
              {(isPersonal || form.category === "Secondary") && (
                <div className="todo-field">
                  <label>{tr("Due Date")}{" "}<span className="pw-hint">{tr("(optional)")}</span></label>
                  <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
                </div>
              )}
              {!isPersonal && form.category === "Primary" && (
                <p className="pw-hint" style={{ margin: "-6px 0 0" }}>
                  {tr("Primary tasks are recurring daily responsibilities — no Due Date applies.")}
                </p>
              )}
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>{tr("Cancel")}</button><button className="todo-btn-save" onClick={saveTask} disabled={saving || !form.title.trim() || (!isPersonal && !form.farmerId)}>{saving ? "Saving…" : editingTask ? "Save Changes" : "Add Task"}</button></div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="todo-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">{confirm.type === "archive" ? "Archive Task" : confirm.type === "complete" ? "Mark this task as completed?" : "Delete Task"}</h3>
            <p className="todo-confirm-message">{confirm.type === "archive" ? `Move "${confirm.task.title}" to the archive? You can restore it anytime from the Archived filter.` : confirm.type === "complete" ? "The task status will be changed to Completed." : `Are you sure you want to delete "${confirm.task.title}"? This action cannot be undone.`}</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirm(null)}>{tr("Cancel")}</button>
              <button className={confirm.type === "archive" ? "todo-confirm-archive" : confirm.type === "complete" ? "todo-btn-save" : "todo-confirm-delete"} onClick={runConfirm}>{confirm.type === "archive" ? "Archive" : confirm.type === "complete" ? "Mark as Completed" : "Delete"}</button>
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
      <h3 className="fp-confirm-title">{tr("Archive Task")}</h3>

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

      

    </PageLayout>
  );
}