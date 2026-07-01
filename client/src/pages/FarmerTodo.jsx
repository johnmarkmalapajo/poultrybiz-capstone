import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiMenu, FiBell, FiCheck, FiPlus, FiEdit2, FiTrash2, FiX,
  FiClipboard, FiUser, FiSearch,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Todo.css";

/* ── To Do store (inline · localStorage · same keys across To Do pages) ── */
const K_ASSIGNED = "pb_assigned_tasks";
const K_PERSONAL = "pb_personal_todos";
const K_NOTIFS = "pb_notifications";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const _write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const _uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

const getCurrentUser = (fallback = null) => {
  for (const key of ["pb_user", "user", "currentUser", "authUser"]) {
    try {
      const raw = localStorage.getItem(key); if (!raw) continue;
      const u = JSON.parse(raw);
      const name = u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
      const id = u._id || u.id || u.personnelId || u.userId || name;
      const role = u.accountRole || u.role || u.userType || "";
      if (name || id) return { id, name: name || "User", role };
    } catch (e) { /* ignore */ }
  }
  return fallback;
};
const pushNotification = (userId, message) => {
  const all = _read(K_NOTIFS);
  all[userId] = [{ _id: _uid("n"), message, read: false, at: new Date().toISOString() }, ...(all[userId] || [])];
  _write(K_NOTIFS, all);
};
const getAssignedTasks = (farmerId) => _read(K_ASSIGNED)[farmerId] || [];
const setAssignedTaskDone = (farmerId, taskId, done, farmerName = "A farmer") => {
  const all = _read(K_ASSIGNED); const list = all[farmerId] || [];
  const t = list.find((x) => x._id === taskId); if (!t) return;
  t.status = done ? "Completed" : "Pending";
  t.completedAt = done ? new Date().toISOString() : null;
  _write(K_ASSIGNED, all);
  if (done) pushNotification("admin", `${farmerName} completed the assigned task: ${t.title}.`);
};
const getPersonalTodos = (userId) => _read(K_PERSONAL)[userId] || [];
const addPersonalTodo = (userId, todo) => {
  const all = _read(K_PERSONAL);
  const t = { _id: _uid("pt"), title: todo.title || "Untitled", description: todo.description || "", dueDate: todo.dueDate || "", priority: todo.priority || "Medium", done: false, completedAt: null, createdAt: new Date().toISOString() };
  all[userId] = [t, ...(all[userId] || [])]; _write(K_PERSONAL, all); return t;
};
const updatePersonalTodo = (userId, todoId, patch) => {
  const all = _read(K_PERSONAL); const t = (all[userId] || []).find((x) => x._id === todoId);
  if (t) Object.assign(t, patch); _write(K_PERSONAL, all);
};
const togglePersonalTodo = (userId, todoId, done) =>
  updatePersonalTodo(userId, todoId, { done, completedAt: done ? new Date().toISOString() : null });
const deletePersonalTodo = (userId, todoId) => {
  const all = _read(K_PERSONAL); all[userId] = (all[userId] || []).filter((x) => x._id !== todoId); _write(K_PERSONAL, all);
};
const getNotifications = (userId) => _read(K_NOTIFS)[userId] || [];
const getUnreadCount = (userId) => getNotifications(userId).filter((n) => !n.read).length;
const markNotificationsRead = (userId) => {
  const all = _read(K_NOTIFS); all[userId] = (all[userId] || []).map((n) => ({ ...n, read: true })); _write(K_NOTIFS, all);
};

// Demo farmer used when no logged-in user is found (replace once auth is wired)
const DEMO_FARMER = { id: "f1", name: "Juan Dela Cruz", role: "Farmer" };

const prioClass = (p) => `todo-badge prio-${String(p || "medium").toLowerCase()}`;
const initials = (n) => (n ? n.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") : "?").toUpperCase();
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function FarmerTodo() {
  const navigate = useNavigate();
  const user = getCurrentUser(DEMO_FARMER);
  const farmerId = user.id;

  const [assigned, setAssigned] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [search, setSearch] = useState("");

  // Notifications
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef(null);

  // Modal (add/edit personal)
  const [modal, setModal] = useState(null); // null | {mode:'add'} | {mode:'edit', todo}
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", priority: "Medium" });

  const refresh = () => {
    setAssigned(getAssignedTasks(farmerId));
    setPersonal(getPersonalTodos(farmerId));
    setNotifs(getNotifications(farmerId));
    setUnread(getUnreadCount(farmerId));
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [farmerId]);

  // Close notif dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const openNotifs = () => {
    setNotifOpen((o) => !o);
    if (!notifOpen) { markNotificationsRead(farmerId); setUnread(0); }
  };

  // Assigned task checkbox → complete (updates store + notifies Admin + Personnel Tasks)
  const toggleAssigned = (t) => {
    const done = t.status !== "Completed";
    setAssignedTaskDone(farmerId, t._id, done, user.name);
    refresh();
  };

  // Personal todo CRUD
  const openAdd = () => { setForm({ title: "", description: "", dueDate: "", priority: "Medium" }); setModal({ mode: "add" }); };
  const openEdit = (todo) => { setForm({ title: todo.title, description: todo.description, dueDate: todo.dueDate, priority: todo.priority }); setModal({ mode: "edit", todo }); };
  const saveModal = () => {
    if (!form.title.trim()) return;
    if (modal.mode === "add") addPersonalTodo(farmerId, form);
    else updatePersonalTodo(farmerId, modal.todo._id, form);
    setModal(null); refresh();
  };
  const removeTodo = (todo) => { if (window.confirm("Delete this personal to-do?")) { deletePersonalTodo(farmerId, todo._id); refresh(); } };
  const toggleP = (todo) => { togglePersonalTodo(farmerId, todo._id, !todo.done); refresh(); };

  const q = search.toLowerCase();
  const assignedView = assigned.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));
  const personalView = personal.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));

  return (
    <div className="todo-page">
      <Sidebar />
      <main className="todo-main">
        {/* Breadcrumb */}
        <div className="todo-breadcrumb">
          <button className="todo-hamburger" onClick={openSidebar} aria-label="Open menu"><FiMenu /></button>
          <span className="breadcrumb-current">MY TO DO</span>
        </div>

        {/* Header + bell */}
        <div className="todo-header">
          <div>
            <h1>My To Do</h1>
            <p>Tasks assigned to you, plus your own personal reminders.</p>
          </div>
          <div className="todo-bell-wrap" ref={bellRef}>
            <button className="todo-bell" onClick={openNotifs} aria-label="Notifications">
              <FiBell />
              {unread > 0 && <span className="todo-bell-badge">{unread}</span>}
            </button>
            {notifOpen && (
              <div className="todo-notif-menu">
                <div className="todo-notif-head">Notifications</div>
                <div className="todo-notif-list">
                  {notifs.length === 0 ? (
                    <div className="todo-notif-empty">No notifications yet.</div>
                  ) : notifs.map((n) => (
                    <div key={n._id} className={`todo-notif-item ${n.read ? "" : "unread"}`}>
                      {n.message}<small>{fmtTime(n.at)}</small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="todo-toolbar">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder="Search tasks..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {/* ── ASSIGNED TASKS ── */}
        <div className="todo-section-head">
          <div>
            <div className="todo-section-title"><FiClipboard /> Assigned Tasks</div>
            <div className="todo-section-sub">Assigned by the Admin. Check the box when finished — you can't edit these.</div>
          </div>
        </div>
        <div className="todo-card">
          <div className="todo-table-wrapper">
            <table className="todo-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>Done</th>
                  <th>Task</th>
                  <th>Description</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th>Assigned By</th>
                </tr>
              </thead>
              <tbody>
                {assignedView.length === 0 ? (
                  <tr><td colSpan="6" className="todo-empty">No assigned tasks right now.</td></tr>
                ) : assignedView.map((t) => {
                  const done = t.status === "Completed";
                  return (
                    <tr key={t._id} className={done ? "is-done" : ""}>
                      <td>
                        <button className={`todo-check ${done ? "checked" : ""}`} onClick={() => toggleAssigned(t)} aria-label="Mark done">
                          {done && <FiCheck />}
                        </button>
                      </td>
                      <td className="todo-task-title">{t.title}</td>
                      <td>{t.description || "—"}</td>
                      <td>{t.dueDate || "—"}</td>
                      <td><span className={prioClass(t.priority)}>{t.priority}</span></td>
                      <td>
                        <span className="todo-assigner">
                          <span className="av">{initials(t.assignedBy)}</span> {t.assignedBy || "Admin"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="todo-card-footer">{assignedView.filter((t) => t.status === "Completed").length} of {assignedView.length} completed</div>
        </div>

        {/* ── PERSONAL TO DO ── */}
        <div className="todo-section-head">
          <div>
            <div className="todo-section-title"><FiUser /> Personal To Do</div>
            <div className="todo-section-sub">Your own private reminders — only you can see these.</div>
          </div>
          <button className="todo-add-btn" onClick={openAdd}><FiPlus /> Add To Do</button>
        </div>
        <div className="todo-card">
          <div className="todo-table-wrapper">
            <table className="todo-table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>Done</th>
                  <th>Task</th>
                  <th>Description</th>
                  <th>Due Date</th>
                  <th>Priority</th>
                  <th style={{ width: 96 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {personalView.length === 0 ? (
                  <tr><td colSpan="6" className="todo-empty">No personal to-dos yet. Tap “Add To Do”.</td></tr>
                ) : personalView.map((t) => (
                  <tr key={t._id} className={t.done ? "is-done" : ""}>
                    <td>
                      <button className={`todo-check ${t.done ? "checked" : ""}`} onClick={() => toggleP(t)} aria-label="Mark done">
                        {t.done && <FiCheck />}
                      </button>
                    </td>
                    <td className="todo-task-title">{t.title}</td>
                    <td>{t.description || "—"}</td>
                    <td>{t.dueDate || "—"}</td>
                    <td><span className={prioClass(t.priority)}>{t.priority}</span></td>
                    <td>
                      <div className="todo-row-actions">
                        <button className="todo-icon-btn edit" onClick={() => openEdit(t)} title="Edit"><FiEdit2 /></button>
                        <button className="todo-icon-btn del" onClick={() => removeTodo(t)} title="Delete"><FiTrash2 /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="todo-card-footer">{personalView.filter((t) => t.done).length} of {personalView.length} completed</div>
        </div>
      </main>

      {/* Add / Edit personal modal */}
      {modal && (
        <div className="todo-overlay" onClick={() => setModal(null)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-head">
              <h3>{modal.mode === "add" ? "Add Personal To Do" : "Edit To Do"}</h3>
              <button className="todo-modal-close" onClick={() => setModal(null)}><FiX /></button>
            </div>
            <div className="todo-modal-body">
              <div className="todo-field">
                <label>Task Title <span className="req">*</span></label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Refill water tanks" />
              </div>
              <div className="todo-field">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional details..." />
              </div>
              <div className="todo-field">
                <label>Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              <div className="todo-field">
                <label>Priority</label>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
            </div>
            <div className="todo-modal-foot">
              <button className="todo-btn-cancel" onClick={() => setModal(null)}>Cancel</button>
              <button className="todo-btn-save" onClick={saveModal}>{modal.mode === "add" ? "Add To Do" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}