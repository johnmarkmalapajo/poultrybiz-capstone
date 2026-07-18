import React, { useMemo, useState, useRef, useEffect } from "react";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiArchive, FiRotateCcw, FiTrash2, FiList, FiClock, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import "./ToDo.css";
import PageLayout from "../components/PageLayout";
import {
  getAssignedTasks, setAssignedTaskDone,
  getPersonalTodos, addPersonalTodo, updatePersonalTodo, deletePersonalTodo,
  getCurrentUser, subscribe as subscribeTodos,
} from "../todoStore";

// A task is "Overdue" if it's still Pending and its due date has passed —
// computed live (not a stored status) so it's always accurate.
function withDisplayStatus(t) {
  const status = t.status || (t.done ? "Completed" : "Pending");
  if (status === "Completed") return { ...t, displayStatus: "Completed" };
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const overdue = due && !isNaN(due) && due < new Date(new Date().toDateString());
  return { ...t, displayStatus: overdue ? "Overdue" : "Pending" };
}

export default function FarmerTodo() {
  // getCurrentUser() reads the real logged-in session (localStorage "user")
  // and resolves an id (preferring email) — the same id Admin's farmer
  // picker uses, so assigned tasks line up for the actual logged-in Farmer.
  const me = getCurrentUser({ id: "me", name: "Farmer" });

  const loadAll = () => {
    const assigned = getAssignedTasks(me.id).map((t) => ({ ...t, source: "assigned", assignedBy: t.assignedBy || "Admin" }));
    const personal = getPersonalTodos(me.id).map((t) => ({ ...t, source: "personal", assignedBy: "You" }));
    return [...assigned, ...personal].map(withDisplayStatus);
  };

  const [tasks, setTasks] = useState(loadAll);
  useEffect(() => {
    const refresh = () => setTasks(loadAll());
    refresh();
    return subscribeTodos(refresh);
  }, [me.id]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", type: "Records", priority: "Medium", due: "" });
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const viewingArchived = status === "Archived";
  const filtered = useMemo(() => tasks.filter((t) => {
    if (viewingArchived) { if (!t.archived) return false; }
    else { if (t.archived) return false; if (status !== "All" && t.displayStatus !== status) return false; }
    if (priority !== "All" && t.priority !== priority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, status, priority, search, viewingArchived]);

  const active = tasks.filter((t) => !t.archived);
  const c = { total: active.length, pending: active.filter((t) => t.displayStatus === "Pending").length, completed: active.filter((t) => t.displayStatus === "Completed").length, overdue: active.filter((t) => t.displayStatus === "Overdue").length };
  const activeFilters = (status !== "All" ? 1 : 0) + (priority !== "All" ? 1 : 0);

  const toggle = (t) => {
    if (t.source === "assigned") setAssignedTaskDone(me.id, t._id, t.displayStatus !== "Completed", me.name);
    else updatePersonalTodo(me.id, t._id, { done: t.displayStatus === "Completed" ? false : true, status: t.displayStatus === "Completed" ? "Pending" : "Completed" });
  };
  const openAdd = () => { setEditingId(null); setForm({ title: "", type: "Records", priority: "Medium", due: "" }); setModalOpen(true); };
  const openEdit = (t) => { setEditingId(t._id); setForm({ title: t.title, type: t.type, priority: t.priority, due: t.dueDate }); setModalOpen(true); };
  const saveTask = () => {
    if (!form.title.trim()) return;
    if (editingId) updatePersonalTodo(me.id, editingId, { title: form.title, type: form.type, priority: form.priority, dueDate: form.due });
    else addPersonalTodo(me.id, { title: form.title, type: form.type, priority: form.priority, dueDate: form.due });
    setModalOpen(false);
  };
  const doRestore = (t) => updatePersonalTodo(me.id, t._id, { archived: false });
  // Archive immediately — no confirmation (per UX spec); delete keeps its confirm.
  // Only personal (self-created) tasks can be archived/deleted here — tasks
  // assigned by Admin are managed from the Admin To Do page, so a Farmer
  // can't make an assigned task silently disappear from the Admin's view.
  const archiveTask = (t) => updatePersonalTodo(me.id, t._id, { archived: true });

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "archive") updatePersonalTodo(me.id, confirm.task._id, { archived: true });
    else deletePersonalTodo(me.id, confirm.task._id);
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

        <div className="todo-stats">
          <div className="todo-stat-card"><div className="todo-stat-icon gold"><FiList /></div><div><h3>{c.total}</h3><p>Total Tasks</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon orange"><FiClock /></div><div><h3>{c.pending}</h3><p>Pending</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon green"><FiCheckCircle /></div><div><h3>{c.completed}</h3><p>Completed</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon red"><FiAlertTriangle /></div><div><h3>{c.overdue}</h3><p>Overdue</p></div></div>
        </div>

        <div className="todo-table-wrapper">
          <table className="todo-table">
            <thead>
              <tr><th style={{ width: 64 }}>{viewingArchived ? "" : "Done"}</th><th>Task</th><th>Type</th><th>Priority</th><th>Due Date</th><th>Assigned By</th><th>Status</th><th style={{ width: 100 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr className="todo-empty-row"><td colSpan={8}>{viewingArchived ? "No archived tasks." : "No tasks found."}</td></tr>}
              {filtered.map((t) => {
                const done = t.displayStatus === "Completed";
                return (
                  <tr key={t._id} className={done && !viewingArchived ? "is-done" : ""}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">Archived</span> : <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggle(t)} title={done ? "Mark as pending" : "Mark as done"}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{t.type}</td>
                    <td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                    <td>{t.dueDate}</td>
                    <td>{t.assignedBy}</td>
                    <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
                    <td>
                      <div className="todo-row-actions">
                        {t.source === "assigned" ? (
                          <span className="todo-archived-tag" title="Assigned by Admin — managed from the Admin To Do page">Assigned</span>
                        ) : viewingArchived ? (
                          <>
                            <button className="todo-icon-btn restore" onClick={() => doRestore(t)} title="Restore"><FiRotateCcw /></button>
                            <button className="todo-del-btn" onClick={() => setConfirm({ type: "delete", task: t })} title="Delete"><FiTrash2 /></button>
                          </>
                        ) : (
                          <>
                            <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title="Edit"><FiEdit2 /></button>
                            <button className="todo-icon-btn archive" onClick={() => archiveTask(t)} title="Archive"><FiArchive /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      

      {modalOpen && (
        <div className="todo-overlay" onClick={() => setModalOpen(false)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-head"><h3>{editingId ? "Edit Task" : "New Task"}</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>Task Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Refill water dispensers" /></div>
              <div className="todo-field"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Records</option><option>Health</option><option>Inventory</option><option>Other</option></select></div>
              <div className="todo-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div className="todo-field"><label>Due Date</label><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button><button className="todo-btn-save" onClick={saveTask}>{editingId ? "Save Changes" : "Add Task"}</button></div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="todo-confirm-overlay" onClick={() => setConfirm(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">{confirm.type === "archive" ? "Archive Task" : "Delete Task"}</h3>
            <p className="todo-confirm-message">{confirm.type === "archive" ? `Move "${confirm.task.title}" to the archive? You can restore it anytime from the Archived filter.` : `Are you sure you want to delete "${confirm.task.title}"? This action cannot be undone.`}</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirm(null)}>Cancel</button>
              <button className={confirm.type === "archive" ? "todo-confirm-archive" : "todo-confirm-delete"} onClick={runConfirm}>{confirm.type === "archive" ? "Archive" : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

    </PageLayout>
  );
}
