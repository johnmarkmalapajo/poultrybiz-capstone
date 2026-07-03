import React, { useMemo, useState } from "react";
import Sidebar, { openSidebar } from "../components/Sidebar";
import { FiPlus, FiSearch, FiList, FiClock, FiCheckCircle, FiAlertTriangle, FiTrash2 } from "react-icons/fi";
import "./Todo.css";

const initialTasks = [
  { id: 1, title: "Feed the layers (morning)", type: "Records", priority: "High", due: "Jul 3, 2026", assignedBy: "Admin", status: "Pending" },
  { id: 2, title: "Clean the coop", type: "Health", priority: "Medium", due: "Jul 3, 2026", assignedBy: "Admin", status: "Pending" },
  { id: 3, title: "Record daily egg count", type: "Records", priority: "High", due: "Jul 3, 2026", assignedBy: "Admin", status: "Overdue" },
  { id: 4, title: "Refill water dispensers", type: "Inventory", priority: "Low", due: "Jul 4, 2026", assignedBy: "Admin", status: "Completed" },
  { id: 5, title: "Check flock health", type: "Health", priority: "Medium", due: "Jul 5, 2026", assignedBy: "Admin", status: "Pending" },
  { id: 6, title: "Collect eggs (afternoon batch)", type: "Records", priority: "Low", due: "Jul 6, 2026", assignedBy: "Admin", status: "Completed" },
];

export default function FarmerTodo() {
  const [tasks, setTasks] = useState(initialTasks);
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState({ title: "", type: "Records", priority: "Medium", due: "" });

  const filtered = useMemo(() => tasks.filter((t) => {
    if (tab !== "All" && t.status !== tab) return false;
    if (status !== "All" && t.status !== status) return false;
    if (priority !== "All" && t.priority !== priority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, tab, status, priority, search]);

  const c = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "Pending").length,
    completed: tasks.filter((t) => t.status === "Completed").length,
    overdue: tasks.filter((t) => t.status === "Overdue").length,
  };

  const toggle = (id) => setTasks(tasks.map((t) => (t.id === id ? { ...t, status: t.status === "Completed" ? "Pending" : "Completed" } : t)));
  const saveTask = () => {
    if (!form.title.trim()) return;
    setTasks([{ id: Date.now(), ...form, assignedBy: "You", status: "Pending" }, ...tasks]);
    setForm({ title: "", type: "Records", priority: "Medium", due: "" });
    setModalOpen(false);
  };
  const deleteTask = () => {
    if (!confirmDel) return;
    setTasks(tasks.filter((t) => t.id !== confirmDel.id));
    setConfirmDel(null);
  };

  return (
    <div className="todo-page">
      <Sidebar />
      <main className="todo-main">
        <div className="todo-breadcrumb">
          <button className="todo-hamburger" onClick={openSidebar} aria-label="Open menu">☰</button>
          <span className="breadcrumb-current">TO DO</span>
        </div>

        <div className="todo-toolbar">
          <button className="todo-add-btn" onClick={() => setModalOpen(true)}><FiPlus /> New Task</button>
          <div className="todo-toolbar-actions">
            <div className="search-box"><FiSearch /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search task..." /></div>
            <select className="todo-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>All</option><option>Pending</option><option>Completed</option><option>Overdue</option>
            </select>
            <select className="todo-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option>All</option><option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
        </div>

        <div className="todo-stats">
          <div className="todo-stat-card"><div className="todo-stat-icon gold"><FiList /></div><div><h3>{c.total}</h3><p>Total Tasks</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon orange"><FiClock /></div><div><h3>{c.pending}</h3><p>Pending</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon green"><FiCheckCircle /></div><div><h3>{c.completed}</h3><p>Completed</p></div></div>
          <div className="todo-stat-card"><div className="todo-stat-icon red"><FiAlertTriangle /></div><div><h3>{c.overdue}</h3><p>Overdue</p></div></div>
        </div>

        <div className="todo-tabs">
          {["All", "Pending", "Completed"].map((x) => (
            <button key={x} className={`todo-tab ${tab === x ? "active" : ""}`} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>

        <div className="todo-table-wrapper">
          <table className="todo-table">
            <thead>
              <tr><th>Task</th><th>Type</th><th>Priority</th><th>Due Date</th><th>Assigned By</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr className="todo-empty-row"><td colSpan={7}>No tasks found.</td></tr>}
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td><span className="todo-task-title">{t.title}</span></td>
                  <td>{t.type}</td>
                  <td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                  <td>{t.due}</td>
                  <td>{t.assignedBy}</td>
                  <td><span className={`status ${t.status.toLowerCase()}`}>{t.status}</span></td>
                  <td><div className="todo-row-actions"><button className="todo-act-btn" onClick={() => toggle(t.id)}>{t.status === "Completed" ? "Undo" : "Complete"}</button><button className="todo-del-btn" onClick={() => setConfirmDel(t)} title="Delete"><FiTrash2 /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {modalOpen && (
        <div className="todo-overlay" onClick={() => setModalOpen(false)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-head"><h3>New Task</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>Task Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Refill water dispensers" /></div>
              <div className="todo-field"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Records</option><option>Health</option><option>Inventory</option><option>Other</option></select></div>
              <div className="todo-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div className="todo-field"><label>Due Date</label><input value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} placeholder="e.g. Jul 5, 2026" /></div>
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button><button className="todo-btn-save" onClick={saveTask}>Add Task</button></div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="todo-confirm-overlay" onClick={() => setConfirmDel(null)}>
          <div className="todo-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="todo-confirm-title">Delete Task</h3>
            <p className="todo-confirm-message">Are you sure you want to delete "{confirmDel.title}"? This action cannot be undone.</p>
            <div className="todo-confirm-actions">
              <button className="todo-confirm-cancel" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="todo-confirm-delete" onClick={deleteTask}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}