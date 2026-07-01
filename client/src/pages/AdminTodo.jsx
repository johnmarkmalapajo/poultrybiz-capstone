import { useState, useEffect, useRef } from "react";
import {
  FiMenu, FiBell, FiCheck, FiPlus, FiEdit2, FiTrash2, FiX, FiUser, FiSearch,
} from "react-icons/fi";
import Sidebar, { openSidebar } from "../components/Sidebar";
import "./Todo.css";

/* ── To Do store (inline · localStorage · same keys across To Do pages) ── */
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

// Demo admin used when no logged-in user is found (replace once auth is wired)
const DEMO_ADMIN = { id: "admin", name: "Engr. Maria Egginear", role: "Owner / Admin" };

const prioClass = (p) => `todo-badge prio-${String(p || "medium").toLowerCase()}`;
const fmtTime = (iso) => { try { return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

export default function AdminTodo() {
  const user = getCurrentUser(DEMO_ADMIN);
  // Admin notifications live under the "admin" key (farmers notify "admin" on completion)
  const adminId = "admin";
  const todoId = user.id || "admin";

  const [personal, setPersonal] = useState([]);
  const [search, setSearch] = useState("");

  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef(null);

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", dueDate: "", priority: "Medium" });

  const refresh = () => {
    setPersonal(getPersonalTodos(todoId));
    setNotifs(getNotifications(adminId));
    setUnread(getUnreadCount(adminId));
  };
  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    const h = (e) => { if (bellRef.current && !bellRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const openNotifs = () => {
    setNotifOpen((o) => !o);
    if (!notifOpen) { markNotificationsRead(adminId); setUnread(0); }
  };

  const openAdd = () => { setForm({ title: "", description: "", dueDate: "", priority: "Medium" }); setModal({ mode: "add" }); };
  const openEdit = (todo) => { setForm({ title: todo.title, description: todo.description, dueDate: todo.dueDate, priority: todo.priority }); setModal({ mode: "edit", todo }); };
  const saveModal = () => {
    if (!form.title.trim()) return;
    if (modal.mode === "add") addPersonalTodo(todoId, form);
    else updatePersonalTodo(todoId, modal.todo._id, form);
    setModal(null); refresh();
  };
  const removeTodo = (todo) => { if (window.confirm("Delete this reminder?")) { deletePersonalTodo(todoId, todo._id); refresh(); } };
  const toggleP = (todo) => { togglePersonalTodo(todoId, todo._id, !todo.done); refresh(); };

  const q = search.toLowerCase();
  const view = personal.filter((t) => (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q));

  return (
    <div className="todo-page">
      <Sidebar />
      <main className="todo-main">
        <div className="todo-breadcrumb">
          <button className="todo-hamburger" onClick={openSidebar} aria-label="Open menu"><FiMenu /></button>
          <span className="breadcrumb-current">MY TO DO</span>
        </div>

        <div className="todo-header">
          <div>
            <h1>My To Do</h1>
            <p>Your personal reminders. (Not linked to Personnel assigned tasks.)</p>
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

        <div className="todo-toolbar">
          <div className="search-box">
            <FiSearch />
            <input type="text" placeholder="Search reminders..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="todo-add-btn" onClick={openAdd}><FiPlus /> Add To Do</button>
        </div>

        <div className="todo-section-head">
          <div>
            <div className="todo-section-title"><FiUser /> Personal Reminders</div>
            <div className="todo-section-sub">Only you can see these.</div>
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
                  <th style={{ width: 96 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.length === 0 ? (
                  <tr><td colSpan="6" className="todo-empty">No reminders yet. Tap “Add To Do”.</td></tr>
                ) : view.map((t) => (
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
          <div className="todo-card-footer">{view.filter((t) => t.done).length} of {view.length} completed</div>
        </div>
      </main>

      {modal && (
        <div className="todo-overlay" onClick={() => setModal(null)}>
          <div className="todo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="todo-modal-head">
              <h3>{modal.mode === "add" ? "Add Reminder" : "Edit Reminder"}</h3>
              <button className="todo-modal-close" onClick={() => setModal(null)}><FiX /></button>
            </div>
            <div className="todo-modal-body">
              <div className="todo-field">
                <label>Task Title <span className="req">*</span></label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Review feed inventory" />
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
              <button className="todo-btn-save" onClick={saveModal}>{modal.mode === "add" ? "Add Reminder" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}