import React, { useMemo, useState, useRef, useEffect } from "react";
import { FiPlus, FiSearch, FiFilter, FiCheck, FiEdit2, FiArchive, FiRotateCcw, FiTrash2, FiList, FiClock, FiCheckCircle, FiAlertTriangle } from "react-icons/fi";
import "./ToDo.css";
import PageLayout from "../components/PageLayout";
import { useUser } from "../hooks/useUser";
import {
  getAllAssignedTasks, assignTask, updateAssignedTask, deleteAssignedTask,
  setAssignedTaskDone, getFarmerList, subscribe as subscribeTodos,
} from "../todoStore";

// A task is "Overdue" if it's still Pending and its due date has passed —
// computed live (not a stored status) so it's always accurate.
function withDisplayStatus(t) {
  if (t.status === "Completed") return { ...t, displayStatus: "Completed" };
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const overdue = due && !isNaN(due) && due < new Date(new Date().toDateString());
  return { ...t, displayStatus: overdue ? "Overdue" : "Pending" };
}

export default function AdminTodo() {
  const { user } = useUser();
  const [tasks, setTasks] = useState(() => getAllAssignedTasks().map(withDisplayStatus));
  const [farmers, setFarmers] = useState(getFarmerList());

  useEffect(() => {
    const refresh = () => { setTasks(getAllAssignedTasks().map(withDisplayStatus)); setFarmers(getFarmerList()); };
    refresh();
    return subscribeTodos(refresh);
  }, []);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // { _id, farmerId } or null
  const [form, setForm] = useState({ title: "", type: "Records", priority: "Medium", due: "", farmerId: "" });
  const [confirm, setConfirm] = useState(null); // { type: 'archive' | 'delete', task }

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

  const toggle = (t) => setAssignedTaskDone(t.farmerId, t._id, t.displayStatus !== "Completed", user?.name);
  const openAdd = () => { setEditingTask(null); setForm({ title: "", type: "Records", priority: "Medium", due: "", farmerId: farmers[0]?.id || "" }); setModalOpen(true); };
  const openEdit = (t) => { setEditingTask(t); setForm({ title: t.title, type: t.type, priority: t.priority, due: t.dueDate, farmerId: t.farmerId }); setModalOpen(true); };
  const saveTask = () => {
    if (!form.title.trim() || !form.farmerId) return;
    if (editingTask) {
      // Assignee can't change on edit (it would orphan the record); everything
      // else can. To reassign, archive this one and create a new assignment.
      updateAssignedTask(editingTask.farmerId, editingTask._id, {
        title: form.title, type: form.type, priority: form.priority, dueDate: form.due,
      });
    } else {
      assignTask(form.farmerId, { title: form.title, type: form.type, priority: form.priority, dueDate: form.due }, user?.name || "Admin");
    }
    setModalOpen(false);
  };
  const doRestore = (t) => updateAssignedTask(t.farmerId, t._id, { archived: false });
  // Archive immediately — no confirmation (per UX spec); delete keeps its confirm.
  const archiveTask = (t) => updateAssignedTask(t.farmerId, t._id, { archived: true });

  const runConfirm = () => {
    if (!confirm) return;
    if (confirm.type === "archive") updateAssignedTask(confirm.task.farmerId, confirm.task._id, { archived: true });
    else deleteAssignedTask(confirm.task.farmerId, confirm.task._id);
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
              <tr><th style={{ width: 64 }}>{viewingArchived ? "" : "Done"}</th><th>Task</th><th>Type</th><th>Assigned To</th><th>Priority</th><th>Due Date</th><th>Status</th><th style={{ width: 100 }}>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr className="todo-empty-row"><td colSpan={8}>{viewingArchived ? "No archived tasks." : "No tasks found."}</td></tr>}
              {filtered.map((t) => {
                const done = t.displayStatus === "Completed";
                const farmerName = farmers.find((f) => f.id === t.farmerId)?.name || t.farmerId;
                return (
                  <tr key={t._id} className={done && !viewingArchived ? "is-done" : ""}>
                    <td>{viewingArchived ? <span className="todo-archived-tag">Archived</span> : <span className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggle(t)} title={done ? "Mark as pending" : "Mark as done"}>{done && <FiCheck />}</span>}</td>
                    <td><span className="todo-task-title">{t.title}</span></td>
                    <td>{t.type}</td>
                    <td>{farmerName}</td>
                    <td><span className={`priority ${t.priority.toLowerCase()}`}>{t.priority}</span></td>
                    <td>{t.dueDate}</td>
                    <td><span className={`status ${t.displayStatus.toLowerCase()}`}>{t.displayStatus}</span></td>
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
            <div className="todo-modal-head"><h3>{editingTask ? "Edit Task" : "New Task"}</h3><button className="todo-modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <div className="todo-modal-body">
              <div className="todo-field"><label>Task Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Review egg production" /></div>
              <div className="todo-field">
                <label>Assign To</label>
                <select value={form.farmerId} disabled={!!editingTask} onChange={(e) => setForm({ ...form, farmerId: e.target.value })}>
                  <option value="">Select a Farmer…</option>
                  {farmers.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div className="todo-field"><label>Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Records</option><option>Users</option><option>Reports</option><option>Inventory</option><option>Visitors</option><option>Archive</option></select></div>
              <div className="todo-field"><label>Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select></div>
              <div className="todo-field"><label>Due Date</label><input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
            </div>
            <div className="todo-modal-foot"><button className="todo-btn-cancel" onClick={() => setModalOpen(false)}>Cancel</button><button className="todo-btn-save" onClick={saveTask} disabled={!form.title.trim() || !form.farmerId}>{editingTask ? "Save Changes" : "Add Task"}</button></div>
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