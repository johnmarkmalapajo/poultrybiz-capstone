import React, { useMemo, useState, useRef, useEffect } from "react";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiArchive, FiRotateCcw, FiTrash2, FiList, FiClock, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import "./ToDo.css";
import PageLayout from "../components/PageLayout";

const STORAGE_KEY = "pb_admin_todos";
const initialTasks = [
  { id: 1, title: "Review Daily Egg Production", type: "Records", priority: "High", due: "Jul 3, 2026", status: "Pending", archived: false },
  { id: 2, title: "Approve New User Accounts", type: "Users", priority: "Medium", due: "Jul 3, 2026", status: "Pending", archived: false },
  { id: 3, title: "Prepare Weekly Sales Report", type: "Reports", priority: "Low", due: "Jul 4, 2026", status: "Completed", archived: false },
  { id: 4, title: "Check Feed Inventory Summary", type: "Inventory", priority: "High", due: "Jul 3, 2026", status: "Overdue", archived: false },
  { id: 5, title: "Review Visitor Logs", type: "Visitors", priority: "Medium", due: "Jul 5, 2026", status: "Pending", archived: false },
  { id: 6, title: "Archive Old Records", type: "Archive", priority: "Low", due: "Jul 6, 2026", status: "Completed", archived: false },
];
function loadTasks() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
  return initialTasks;
}

export default function AdminTodo() {
  const [tasks, setTasks] = useState(loadTasks);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch { /* ignore */ } }, [tasks]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", type: "Records", priority: "Medium", due: "" });
  const [confirm, setConfirm] = useState(null); // { type: 'archive' | 'delete', task }

  useEffect(() => {
    const h = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const viewingArchived = status === "Archived";
  const filtered = useMemo(() => tasks.filter((t) => {
    if (viewingArchived) { if (!t.archived) return false; }
    else { if (t.archived) return false; if (status !== "All" && t.status !== status) return false; }
    if (priority !== "All" && t.priority !== priority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, status, priority, search, viewingArchived]);

  const active = tasks.filter((t) => !t.archived);
  const c = { total: active.length, pending: active.filter((t) => t.status === "Pending").length, completed: active.filter((t) => t.status === "Completed").length, overdue: active.filter((t) => t.status === "Overdue").length };
  const activeFilters = (status !== "All" ? 1 : 0) + (priority !== "All" ? 1 : 0);

  const toggle = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, status: t.status === "Completed" ? "Pending" : "Completed" } : t)));
  const openAdd = () => { setEditingId(null); setForm({ title: "", type: "Records", priority: "Medium", due: "" }); setModalOpen(true); };
  const openEdit = (t) => { setEditingId(t.id); setForm({ title: t.title, type: t.type, priority: t.priority, due: t.due }); setModalOpen(true); };
  const saveTask = () => {
    if (!form.title.trim()) return;
    if (editingId) setTasks(tasks.map((t) => (t.id === editingId ? { ...t, ...form } : t)));
    else setTasks([{ id: Date.now(), ...form, status: "Pending", archived: false }, ...tasks]);
    setModalOpen(false);
  };
  const doRestore = (t) => setTasks(tasks.map((x) => (x.id === t.id ? { ...x, archived: false } : x)));
  // Archive immediately — no confirmation (per UX spec); delete keeps its confirm.
  const archiveTask = (t) =>
    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, archived: true } : x)));

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "archive") setTasks(tasks.map((x) => (x.id === confirm.task.id ? { ...x, archived: true } : x)));
    else setTasks(tasks.filter((x) => x.id !== confirm.task.id));
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
              <tr><th style={{ width: 64 }}>{viewingArchived ? "" : "Done"}</th><th>Task</th><th>Type</th><th>Priority</th><th>Due Date</th><th>Status</th><th style={{ width: 100 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr className="todo-empty-row"><td colSpan={7}>{viewingArchived ? "No archived tasks." : "No tasks found."}</td></tr>}
              {filtered.map((t) => {
                const done = t.status === "Completed";
                return (
                  <tr key={t.id} className={done && !viewingArchived ? "is-done" : ""}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">Archived</span> : <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggle(t.id)} title={done ? "Mark as pending" : "Mark as done"}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{t.type}</td>
                    <td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                    <td>{t.due}</td>
                    <td><span className={`status ${t.status.toLowerCase()}`}>{t.status}</span></td>
                    <td>
                      <div className="todo-row-actions">
                        {viewingArchived ? (
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
              <div className="todo-field"><label>Task Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Review egg production" /></div>
              <div className="todo-field"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Records</option><option>Users</option><option>Reports</option><option>Inventory</option><option>Visitors</option><option>Archive</option></select></div>
              <div className="todo-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div className="todo-field"><label>Due Date</label><input value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} placeholder="e.g. Jul 5, 2026" /></div>
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