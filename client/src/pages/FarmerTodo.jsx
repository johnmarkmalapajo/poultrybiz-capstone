import { useMemo, useState, useRef, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiRotateCcw, FiTrash2, FiArchive, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiEye } from "react-icons/fi";
import { getTaskCategoryRoute } from "../taskCategoryRoutes";
import { canAccessCategory } from "../moduleRegistry";
import "./ToDo.css";
import PageLayout from "../components/PageLayout";
import { useTableSort, sortIndicator } from "../hooks/useTableSort";
import { usePagination } from "../hooks/usePagination";
import TablePagination from "../components/TablePagination";
import "../components/TablePagination.css";
import {
  refreshAssignedTasks,
  refreshPersonalTodos,
  getCachedAssignedTasks,
  getCachedPersonalTodos,
  setAssignedTaskDoneById,
  addPersonalTodo,
  updatePersonalTodoById,
  archivePersonalTodoById,
  deletePersonalTodoById,
  getCurrentUser,
  subscribe as subscribeTodos,
  getLastError,
} from "../todoStore";
import { getAccessibleCategories } from "../moduleRegistry";

const FARMER_CATEGORIES = getAccessibleCategories({
  isOwner: false, canSeeFinancials: false, canViewPersonnel: false,
});

function withDisplayStatus(t) {
  const status = t.status || (t.done ? "Completed" : "Pending");
  if (status === "Completed") return { ...t, displayStatus: "Completed" };
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const overdue = due && !isNaN(due) && due < new Date(new Date().toDateString());
  return { ...t, displayStatus: overdue ? "Overdue" : "Pending" };
}

export default function FarmerTodo() {
  const navigate = useNavigate();
  const me = getCurrentUser({ id: "me", userId: "me", name: "Farmer" });
  console.log("CURRENT USER:", me);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sourceTab, setSourceTab] = useState("assigned");  const [searchParams] = useSearchParams();
  const [highlightId, setHighlightId] = useState(searchParams.get("task"));

  const buildTasks = () => {
    const assigned = getCachedAssignedTasks().filter((t) => !t.linkedPersonalTodo) .map((t) => ({ ...t, source: "assigned", assignedBy: t.assignedBy || "Owner",}));
    const personal = getCachedPersonalTodos().map((t) => ({ ...t, source: "personal", assignedBy: "You" }));
    return [...assigned, ...personal].map(withDisplayStatus);
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([refreshAssignedTasks(me.id), refreshPersonalTodos(me.userId)]);
    setTasks(buildTasks());
    setError(getLastError()?.message || "");
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const refresh = () => setTasks(buildTasks());
    return subscribeTodos(refresh);
  }, [me.id]);

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

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", type: FARMER_CATEGORIES[0], priority: "Medium", due: "" });
  const [confirm, setConfirm] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null);
  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const viewingArchived = status === "Archived";
  const filtered = useMemo(() => tasks.filter((t) => {
    if (sourceTab !== "all" && t.source !== sourceTab) return false;
    if (viewingArchived) { if (!t.archived) return false; }
    else { if (t.archived) return false; if (status !== "All" && t.displayStatus !== status) return false; }
    if (priority !== "All" && t.priority !== priority) return false;
    if (search) {
      const q = search.toLowerCase();
      const matches =
        (t.title || "").toLowerCase().includes(q) ||
        (t.type || t.module || "").toLowerCase().includes(q) ||
        (t.assignedBy || "").toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  }), [tasks, sourceTab, status, priority, search, viewingArchived]);

  const { sortColumn, sortDirection, cycleSort, sortData } = useTableSort();
  const sortAccessor = (row, col) => {
    if (col === "task") return row.title || "";
    if (col === "category") return row.type || row.module || "";
    if (col === "priority") return { High: 3, Medium: 2, Low: 1 }[row.priority] ?? 0;
    if (col === "dueDate") return row.dueDate || "";
    if (col === "assignedBy") return row.assignedBy || "";
    if (col === "status") return row.displayStatus || "";
    return "";
  };
  const sorted = sortData(filtered, sortAccessor);
  const pager = usePagination(sorted.length);
  useEffect(() => { pager.setPage(1); }, [sourceTab, status, priority, search, viewingArchived]);
  const pageRows = sorted.slice(pager.startIndex, pager.endIndex);

  const active = tasks.filter((t) => !t.archived && (sourceTab === "all" || t.source === sourceTab));
  const c = { total: active.length, pending: active.filter((t) => t.displayStatus === "Pending").length, completed: active.filter((t) => t.displayStatus === "Completed").length, overdue: active.filter((t) => t.displayStatus === "Overdue").length };
  const activeFilters = (status !== "All" ? 1 : 0) + (priority !== "All" ? 1 : 0);

  const handleViewTaskCategory = (t) => {
    const category = t.type || t.module;
    const route = getTaskCategoryRoute(category);
    if (!route) return;
    if (!canAccessCategory(category, { isOwner: false, canSeeFinancials: false, canViewPersonnel: false })) {
      alert("Access Denied. You no longer have permission to access this module.");
      return;
    }
    navigate(route);
  };

  const toggle = (t) => {
    if (t.displayStatus !== "Completed") {
      setConfirmComplete(t);
    } else {
      doToggle(t);
    }
  };

  const doToggle = (t) => {
  if (t.source === "assigned") {
    setAssignedTaskDoneById(
      me.id,
      t._id,
      t.displayStatus !== "Completed"
    );
  } else {
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
  }
};
  const openAdd = () => { setEditingId(null); setForm({ title: "", type: FARMER_CATEGORIES[0], priority: "Medium", due: "" }); setModalOpen(true); };
  const openEdit = (t) => { setEditingId(t._id); setForm({ title: t.title, type: t.type, priority: t.priority, due: t.dueDate }); setModalOpen(true); };
  const saveTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updatePersonalTodoById(editingId, { title: form.title, type: form.type, priority: form.priority, dueDate: form.due }, me.userId);
      } else {
        await addPersonalTodo(me.userId, { title: form.title, type: form.type, priority: form.priority, dueDate: form.due });
        setSourceTab("personal");      }
      setModalOpen(false);
    } catch (err) {
      setError(err?.message || "Couldn't save this task. Please try again.");
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
                <th className="todo-sortable-th" onClick={() => cycleSort("priority")}>Priority{sortIndicator("priority", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("dueDate")}>Due Date{sortIndicator("dueDate", sortColumn, sortDirection)}</th>
                <th className="todo-sortable-th" onClick={() => cycleSort("assignedBy")}>Assigned By{sortIndicator("assignedBy", sortColumn, sortDirection)}</th>
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
                return (
                  <tr key={t._id} id={`todo-row-${t._id}`} className={`${done && !viewingArchived ? "is-done" : ""} ${highlightId === t._id ? "todo-row-highlight" : ""}`}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">Archived</span> : <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggle(t)} title={done ? "Mark as pending" : "Mark as done"}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{t.type}</td>
                    <td><span className={`priority ${(t.priority || "Medium").toLowerCase()}`}> {t.priority || "Medium"}</span></td>
                    <td>{t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : ""}</td>
                    <td>{t.assignedBy}</td>
                    <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
                    <td>
                      <div className="todo-row-actions">
                        {t.source === "assigned" ? (
                          <>
                            {getTaskCategoryRoute(t.type || t.module) && (
                              <button className="todo-icon-btn view" onClick={() => handleViewTaskCategory(t)} title="View Related Module"><FiEye /></button>
                            )}
                            <span className="todo-archived-tag" title="Assigned by Owner — managed from the Owner To Do page">Assigned</span>
                          </>
                        ) : viewingArchived ? (
                          <>
                            <button className="todo-icon-btn restore" onClick={() => doRestore(t)} title="Restore"><FiRotateCcw /></button>
                            <button className="todo-del-btn" onClick={() => setConfirm({ type: "delete", task: t })} title="Delete"><FiTrash2 /></button>
                          </>
                        ) : (
                          <>
                            <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title="Edit"><FiEdit2 /></button>
                            <button className="todo-icon-btn archive" onClick={() => askArchive(t)} title="Archive"><FiArchive /></button>
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
            <div className="todo-modal-head"><h3>{editingId ? "Edit Task" : "New Task"}</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>Task Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Refill water dispensers" /></div>
              <div className="todo-field"><label>Category</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{FARMER_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div className="todo-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div className="todo-field"><label>Due Date</label><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button><button className="todo-btn-save" onClick={saveTask} disabled={saving || !form.title.trim()}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add Task"}</button></div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="todo-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">Delete Task</h3>
            <p className="todo-confirm-message">{`Are you sure you want to delete "${confirm.task.title}"? This action cannot be undone.`}</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="todo-confirm-delete" onClick={runConfirm}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmComplete && (
        <div className="todo-confirm-overlay" onClick={() => setConfirmComplete(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">Mark this task as completed?</h3>
            <p className="todo-confirm-message">The task status will be changed to Completed.</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirmComplete(null)}>Cancel</button>
              <button className="todo-btn-save" onClick={() => { doToggle(confirmComplete); setConfirmComplete(null); }}>Mark as Completed</button>
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
        Archive Personal Task
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