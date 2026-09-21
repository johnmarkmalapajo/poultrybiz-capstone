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
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";
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

function withDisplayStatus(t) {
  if (t.status === "Completed") return { ...t, displayStatus: "Completed" };
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const overdue = due && !isNaN(due) && due < new Date(new Date().toDateString());
  return { ...t, displayStatus: overdue ? "Overdue" : "Pending" };
}

export default function AdminTodo() {
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
      farmerName: `${t.user?.name || "Unknown"} (own)`,
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
  }, []);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [editingTask, setEditingTask] = useState(null);  const canReassignEditingTask = isOwner;
  const [form, setForm] = useState({ title: "", type: "Records", priority: "Medium", due: "", farmerId: "" });
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
      const targetTab = target.source === "assigned" ? "assigned" : "all";
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
    if (sourceTab === "assigned") return t.source === "assigned";
    return t.source === "own-personal";  };
  const filtered = useMemo(() => tasks.filter((t) => {
    if (!inSourceTab(t)) return false;
    if (viewingArchived) { if (!t.archived) return false; }
    else { if (t.archived) return false; if (status !== "All" && t.displayStatus !== status) return false; }
    if (priority !== "All" && t.priority !== priority) return false;
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
  }), [tasks, sourceTab, status, priority, search, viewingArchived]);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "task") return row.title || "";
    if (col === "category") return row.type || row.module || "";
    if (col === "assignedTo") return row.farmerName || "";
    if (col === "priority") return { High: 3, Medium: 2, Low: 1 }[row.priority] ?? 0;
    if (col === "dueDate") return row.dueDate || "";
    if (col === "status") return row.displayStatus || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [sourceTab, status, priority, search, viewingArchived]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const active = tasks.filter((t) => !t.archived && inSourceTab(t));
  const c = { total: active.length, pending: active.filter((t) => t.displayStatus === "Pending").length, completed: active.filter((t) => t.displayStatus === "Completed").length, overdue: active.filter((t) => t.displayStatus === "Overdue").length };
  const activeFilters = (status !== "All" ? 1 : 0) + (priority !== "All" ? 1 : 0);

  const categoryOptionsFor = () =>
    getAccessibleCategories({ isOwner, canSeeFinancials, canViewPersonnel });

  const openAdd = () => {
    setEditingTask(null);
    setIsPersonal(false);
    const defaultFarmerId = farmers[0]?.id || "";
    setForm({ title: "", type: categoryOptionsFor(defaultFarmerId)[0], priority: "Medium", due: "", farmerId: defaultFarmerId });
    setModalOpen(true);
  };
  const openEdit = (t) => { setEditingTask(t); setForm({ title: t.title, type: t.type, priority: t.priority, due: t.dueDate, farmerId: t.personnelId }); setModalOpen(true); };

  const handleViewTaskCategory = (t) => {
    const category = t.type || t.module;
    const route = getTaskCategoryRoute(category);
    if (!route) return;
    if (!canAccessCategory(category, { isOwner, canSeeFinancials, canViewPersonnel })) {
      alert("Access Denied. You no longer have permission to access this module.");
      return;
    }
    navigate(route);
  };

  const saveTask = async () => {
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!form.farmerId) {
      setError("Please select a farmer.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      if (editingTask) {
        const payload = {
          work: form.title.trim(),
          module: form.type,
          priority: form.priority,
          dueDate: form.due,
        };
        if (form.farmerId !== editingTask.personnelId) {
          payload.personnelId = form.farmerId;
        }
        await updateAssignedTaskById(editingTask.personnelId, editingTask._id, payload);
      } else if (isPersonal) {
        await addPersonalTodo(user.id, { title: form.title.trim(), type: form.type, priority: form.priority, dueDate: form.due });
        setSourceTab("personal");      } else {
        await assignTask(
          form.farmerId,
          {
            title: form.title.trim(),
            type: form.type,
            priority: form.priority,
            dueDate: form.due,
          },
          user?.name || "Owner"
        );
      }

      setForm({
        title: "",
        type: "Records",
        priority: "Medium",
        due: "",
        farmerId: farmers[0]?.id || "",
      });
      setEditingTask(null);
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err?.message || "Couldn't save this task. Please try again.");
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

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.type === "delete") {
      await deleteAssignedTaskById(confirm.task.personnelId, confirm.task._id);
    } else if (confirm.type === "complete") {
      if (confirm.task.isOwnPersonal) {
        await updatePersonalTodoById(confirm.task._id, { status: "Completed" }, user?.id);
      } else {
        await setAssignedTaskDoneById(confirm.task.personnelId, confirm.task._id, true);
      }
    }
    setConfirm(null);
    await loadAll();
  };
  const clearFilters = () => { setStatus("All"); setPriority("All"); };

  return (
    <PageLayout
      breadcrumbItems={[{ label: "TO DO" }]}
    >

        <div className="todo-toolbar">
          <button className="todo-add-btn" onClick={openAdd}><FiPlus /> New Task</button>
          <div className="todo-toolbar-actions">
            <div className="todo-search-box"><FiSearch /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task..." /></div>
            <div className="todo-filter-wrap" ref={filterRef}>
              <button className="todo-filter-btn" onClick={() => setFilterOpen((o) => !o)}>
                <FiFilter /> Filter{activeFilters > 0 && <span className="todo-filter-count">{activeFilters}</span>}
              </button>
              {filterOpen && (
                <div className="todo-filter-dropdown">
                  <div className="todo-filter-head"><span>Filter</span><button className="todo-filter-clear" onClick={clearFilters}>Clear</button></div>
                  <div className="todo-filter-group">
                    <label className="todo-filter-label">Status</label>
                    <select className="todo-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                      <option>All</option><option>Pending</option><option>Completed</option><option>Overdue</option><option>Archived</option>
                    </select>
                  </div>
                  <div className="todo-filter-group">
                    <label className="todo-filter-label">Priority</label>
                    <select className="todo-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                      <option>All</option><option>High</option><option>Medium</option><option>Low</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="todo-tabs">
          <button className={`todo-tab ${sourceTab === "all" ? "active" : ""}`} onClick={() => setSourceTab("all")}>
            All
          </button>
          <button className={`todo-tab ${sourceTab === "assigned" ? "active" : ""}`} onClick={() => setSourceTab("assigned")}>
            Assigned Tasks
          </button>
          <button className={`todo-tab ${sourceTab === "personal" ? "active" : ""}`} onClick={() => setSourceTab("personal")}>
            My Tasks
          </button>
        </div>

        <div className="todo-stats">
          <div className="todo-stat-card"><div className="todo-stat-icon gold"><FiList /></div><div><h3>{c.total}</h3><p>Total Tasks</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon orange"><FiClock /></div><div><h3>{c.pending}</h3><p>Pending</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon green"><FiCheckCircle /></div><div><h3>{c.completed}</h3><p>Completed</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon red"><FiAlertTriangle /></div><div><h3>{c.overdue}</h3><p>Overdue</p></div></div>
        </div>

        {error && <p style={{ color: "#d94f4f", fontSize: 13, margin: "0 0 10px" }}>{error}</p>}

        <div className="todo-table-wrapper">
          <table className="todo-table">
            <thead>
              <tr>
                <th style={{ width: 64 }}>{viewingArchived ? "" : "Done"}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("task")}>Task{sortIndicator("task", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("category")}>Category{sortIndicator("category", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("assignedTo")}>Assigned To{sortIndicator("assignedTo", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("priority")}>Priority{sortIndicator("priority", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("dueDate")}>Due Date{sortIndicator("dueDate", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("status")}>Status{sortIndicator("status", sortColumn, sortDirection)}</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr className="todo-empty-row"><td colSpan={8}>Loading tasks…</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr className="todo-empty-row"><td colSpan={8}>
                  {viewingArchived
                    ? "No archived tasks."
                    : (search || status !== "All" || priority !== "All")
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
                const isOwnTask = !isPersonal && !isOwnPersonal && String(t.farmerId) === String(user?.id);
                const canManageAssigned = !isPersonal && !isOwnPersonal && isOwner;
                return (
                  <tr key={t._id} id={`todo-row-${t._id}`} className={`${done && !viewingArchived ? "is-done" : ""} ${highlightId === t._id ? "todo-row-highlight" : ""}`}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">Archived</span> : isPersonal ? <span className="todo-archived-tag" title="Personal to-do — view only">Personal</span> : isOwnPersonal ? <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => done ? updatePersonalTodoById(t._id, { status: "Pending" }, user?.id) : setConfirm({ type: "complete", task: { ...t, isOwnPersonal: true } })} title={done ? "Mark as pending" : "Mark as done"}>{done && <FiCheck />}</span> : (isOwnTask && canManageAssigned) ? <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => done ? setAssignedTaskDoneById(t.personnelId, t._id, false) : setConfirm({ type: "complete", task: t })} title={done ? "Mark as pending" : "Mark as done"}>{done && <FiCheck />}</span> : <span className={`todo-check todo-check-readonly ${done ? "checked" : ""}`} title={done ? "Completed by Farmer" : "Not yet completed — only the assigned Farmer can mark this done"}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{t.type}</td>
                    <td>{farmerName}</td>
                    <td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                    <td>{t.dueDate ? String(t.dueDate).split("T")[0] : ""}</td>
                    <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
                    <td>
                      <div className="todo-row-actions">
                        {isPersonal ? null : isOwnPersonal ? (
                          viewingArchived ? (
                            <>
                              <button className="todo-icon-btn restore" onClick={() => updatePersonalTodoById(t._id, { archived: false }, user?.id)} title="Restore"><FiRotateCcw /></button>
                              <button className="todo-del-btn" onClick={() => deletePersonalTodoById(t._id, user?.id)} title="Delete"><FiTrash2 /></button>
                            </>
                          ) : (
                            <button className="todo-icon-btn archive" onClick={() => updatePersonalTodoById(t._id, { archived: true }, user?.id)} title="Archive"><FiArchive /></button>
                          )
                        ) : !canManageAssigned ? null : viewingArchived ? (
                          <>
                            <button className="todo-icon-btn restore" onClick={() => doRestore(t)} title="Restore"><FiRotateCcw /></button>
                            <button className="todo-del-btn" onClick={() => setConfirm({ type: "delete", task: t })} title="Delete"><FiTrash2 /></button>
                          </>
                        ) : (
                          <>
                            {getTaskCategoryRoute(t.type || t.module) && (
                              <button className="todo-icon-btn view" onClick={() => handleViewTaskCategory(t)} title="View Related Module"><FiEye /></button>
                            )}
                            <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title="Edit"><FiEdit2 /></button>
                            <button className="todo-icon-btn archive" onClick={() => setConfirmArchive(t)} title="Archive"> <FiArchive /></button>
                          </>
                        )}
                      </div>
                    </td>
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
      

      {modalOpen && (
        <div className="todo-overlay" onClick={() => setModalOpen(false)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-head"><h3>{editingTask ? "Edit Task" : "New Task"}</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>Task Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Review egg production" /></div>

              {!editingTask && (
                <div className="todo-field" style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                  <input type="checkbox" id="isPersonalTask" checked={isPersonal} onChange={(e) => setIsPersonal(e.target.checked)} style={{ width: 16, height: 16, margin: 0, marginTop: 2, flexShrink: 0 }} />
                  <label htmlFor="isPersonalTask" style={{ display: "inline", margin: 0, cursor: "pointer", lineHeight: 1.3 }}>Personal task (for myself)</label>
                </div>
              )}

              {!isPersonal && (
                <div className="todo-field">
                  <label>Assign To{editingTask && !canReassignEditingTask && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#a06a1a", background: "#fdf2e6", padding: "2px 8px", borderRadius: 20 }}>Locked</span>}</label>
                  <select value={form.farmerId} disabled={!!editingTask && !canReassignEditingTask} onChange={(e) => {
                    const farmerId = e.target.value;
                    setForm({ ...form, farmerId, type: categoryOptionsFor(farmerId)[0] });
                  }}>
                    <option value="">Select a Farmer…</option>
                    {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}

              {!isPersonal && form.farmerId && (
                <div className="todo-field">
                  <label>Current Pending Tasks <span className="pw-hint">(workload visibility only — does not block saving)</span></label>
                  {loadingWorkload ? (
                    <div className="pw-empty">Loading current workload…</div>
                  ) : (pendingPersonal.length === 0 && pendingAssigned.length === 0) ? (
                    <div className="pw-empty">No pending tasks — this person's workload is currently clear.</div>
                  ) : (
                    <div className="pw-widget">
                      {pendingPersonal.length > 0 && (
                        <div className="pw-section">
                          <div className="pw-section-title">Pending Personal Tasks</div>
                          <table className="pw-table pw-table-personal">
                            <thead><tr><th>Category</th><th>Task Title</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
                            <tbody>
                              {pendingPersonal.map((t) => (
                                <tr key={t._id}>
                                  <td title={t.type}>{t.type || "—"}</td>
                                  <td title={t.title}>{t.title}</td>
                                  <td>{t.priority}</td>
                                  <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                                  <td>{t.status}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {pendingAssigned.length > 0 && (
                        <div className="pw-section">
                          <div className="pw-section-title">Pending Assigned Tasks</div>
                          <table className="pw-table pw-table-assigned">
                            <thead><tr><th>Assigned By</th><th>Category</th><th>Task Title</th><th>Priority</th><th>Due Date</th><th>Status</th></tr></thead>
                            <tbody>
                              {pendingAssigned.map((t) => (
                                <tr key={t._id}>
                                  <td title={t.assignedBy}>{t.assignedBy || "—"}</td>
                                  <td title={t.type}>{t.type || "—"}</td>
                                  <td title={t.title}>{t.title}</td>
                                  <td>{t.priority}</td>
                                  <td>{t.dueDate ? String(t.dueDate).split("T")[0] : "—"}</td>
                                  <td>{t.status}</td>
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
              <div className="todo-field"><label>Category</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{categoryOptionsFor(form.farmerId).map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="todo-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div className="todo-field"><label>Due Date</label><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button><button className="todo-btn-save" onClick={saveTask} disabled={saving || !form.title.trim() || (!isPersonal && !form.farmerId)}>{saving ? "Saving…" : editingTask ? "Save Changes" : "Add Task"}</button></div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="todo-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">{confirm.type === "archive" ? "Archive Task" : confirm.type === "complete" ? "Mark this task as completed?" : "Delete Task"}</h3>
            <p className="todo-confirm-message">{confirm.type === "archive" ? `Move "${confirm.task.title}" to the archive? You can restore it anytime from the Archived filter.` : confirm.type === "complete" ? "The task status will be changed to Completed." : `Are you sure you want to delete "${confirm.task.title}"? This action cannot be undone.`}</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirm(null)}>Cancel</button>
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
      <h3 className="fp-confirm-title">
        Archive Task
      </h3>

      <p className="fp-confirm-message">
        Move task "{confirmArchive.title}" to the archive?
        You can restore it anytime from the Archive page.
      </p>

      <div className="fp-confirm-actions">
        <button
          className="fp-confirm-cancel"
          onClick={() => setConfirmArchive(null)}
        >
          Cancel
        </button>

        <button
          className="fp-confirm-archive"
          onClick={runArchiveConfirm}
        >
          Archive
        </button>
      </div>
    </div>
  </div>
)}

      

    </PageLayout>
  );
}