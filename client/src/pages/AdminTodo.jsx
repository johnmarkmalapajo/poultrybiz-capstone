import React, { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiArchive, FiRotateCcw, FiTrash2, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiEye } from "react-icons/fi";
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
    const assigned = getCachedAllAssignedTasks()
      .filter((t) => !t.linkedPersonalTodo)
      .map((t) => ({ ...t, source: "assigned" }));
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
  const [form, setForm] = useState({ title: "", type: "Records", due: "", farmerId: "" });
  const [isPersonal, setIsPersonal] = useState(false);  const [pendingPersonal, setPendingPersonal] = useState([]);
  const [pendingAssigned, setPendingAssigned] = useState([]);
  const [loadingWorkload, setLoadingWorkload] = useState(false);
  const [confirm, setConfirm] = useState(null);  const [sourceTab, setSourceTab] = useState("assigned");
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
      const targetTab = (target.source === "assigned" || target.source === "personal") ? "assigned" : "all";
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
  const inSourceTab = (t) => {
    if (sourceTab === "all") return true;
    // "Assigned Tasks" = tasks the Owner assigned to Farmers + the personal
    // tasks Farmers created for themselves (so the Owner can follow up on both).
    if (sourceTab === "assigned") return t.source === "assigned" || t.source === "personal";
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
    if (col === "dueDate") return row.dueDate || "";
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

  const openAdd = () => {
    setEditingTask(null);
    setIsPersonal(false);
    const defaultFarmerId = farmers[0]?.id || "";
    setForm({ title: "", type: categoryOptionsFor(false)[0], due: "", farmerId: defaultFarmerId });
    setModalOpen(true);
  };
  const openEdit = (t) => { setEditingTask(t); setForm({ title: t.title, type: t.type, due: t.dueDate, farmerId: t.personnelId }); setModalOpen(true); };

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
    try {
      if (editingTask) {
        const payload = {
          work: form.title.trim(),
          module: form.type,
          dueDate: form.due,
        };
        if (form.farmerId !== editingTask.personnelId) {
          payload.personnelId = form.farmerId;
        }
        await updateAssignedTaskById(editingTask.personnelId, editingTask._id, payload);
      } else if (isPersonal) {
        await addPersonalTodo(user.id, { title: form.title.trim(), type: form.type, dueDate: form.due });
        setSourceTab("personal");      } else {
        await assignTask(
          form.farmerId,
          {
            title: form.title.trim(),
            type: form.type,
            dueDate: form.due,
          },
          user?.name || "Owner"
        );
      }

      setForm({
        title: "",
        type: "Records",
        due: "",
        farmerId: farmers[0]?.id || "",
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
          <button className={`todo-tab ${sourceTab === "assigned" ? "active" : ""}`} onClick={() => setSourceTab("assigned")}>{tr("Assigned Tasks")}</button>
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
                <th className="todo-sortable-th" onClick={() => cycleSort("dueDate")}>{tr("Due Date")}{sortIndicator("dueDate", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("status")}>{tr("Status")}{sortIndicator("status", sortColumn, sortDirection)}</th>
                <th style={{ width: 100 }}>{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="todo-empty-row"><td colSpan={7}>{tr("Loading tasks…")}</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr className="todo-empty-row"><td colSpan={7}>
                  {viewingArchived
                    ? "No archived tasks."
                    : (search || status !== "All")
                    ? "No Matching Tasks Found"
                    : sourceTab === "personal"
                    ? "No Personal Tasks Found"
                    : sourceTab === "assigned"
                    ? "No Assigned Tasks Found"
                    : "No Tasks Found"}
                </td></tr>
              )}
              {!loading && pageRows.map((t) => {
                const done = t.displayStatus === "Completed";
                const farmerName = t.farmerName || "Unknown";
                const isPersonal = t.source === "personal";
                const isOwnPersonal = t.source === "own-personal";
                const canManageAssigned = !isPersonal && !isOwnPersonal && isOwner;
                return (
                  <tr key={t._id} id={`todo-row-${t._id}`} className={`${done && !viewingArchived ? "is-done" : ""} ${highlightId === t._id ? "todo-row-highlight" : ""}`}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">{tr("Archived")}</span> : (isOwnPersonal || isOwner) ? <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggleDone(t)} title={done ? tr("Mark as pending") : tr("Mark as done")}>{done && <FiCheck />}</span> : <span className={`todo-check todo-check-readonly ${done ? "checked" : ""}`} title={done ? tr("Completed") : tr("Not yet completed")}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{tr(t.type)}</td>
                    <td>{farmerName}</td>
                    <td>{t.dueDate ? String(t.dueDate).split("T")[0] : ""}</td>
                    <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
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
                            <thead><tr><th>{tr("Assigned By")}</th><th>{tr("Category")}</th><th>{tr("Task Title")}</th><th>{tr("Due Date")}</th><th>{tr("Status")}</th></tr></thead>
                            <tbody>
                              {pendingAssigned.map((t) => (
                                <tr key={t._id}>
                                  <td title={t.assignedBy}>{t.assignedBy || "—"}</td>
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
                    </div>
                  )}
                </div>
              )}
              <div className="todo-field"><label>{tr("Category")}</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{categoryOptionsFor(isPersonal).map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="todo-field"><label>{tr("Due Date")}</label><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
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