// src/utils/todoStore.js
// Frontend simulation layer (localStorage) for the To Do module.
// NOTE: This works within ONE browser. Real cross-user flow (Admin ↔ Farmer
// across different accounts/devices) requires a backend + DB + auth + realtime.

const K = {
  assigned: "pb_assigned_tasks", // { [farmerId]: Task[] }
  personal: "pb_personal_todos", // { [userId]: Todo[] }
  notifs:   "pb_todo_notifs",  // { [userId|'admin']: Notif[] } — separate from module notifications
};

const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch { return {}; } };
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ }
  try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
};
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// Subscribe to changes (same-tab custom event + focus + cross-tab storage).
export const subscribe = (cb) => {
  const handler = () => cb();
  window.addEventListener("pb_data_changed", handler);
  window.addEventListener("storage", handler);
  window.addEventListener("focus", handler);
  return () => {
    window.removeEventListener("pb_data_changed", handler);
    window.removeEventListener("storage", handler);
    window.removeEventListener("focus", handler);
  };
};

/* ── Current user (from auth in real app; demo fallback here) ── */
export const getCurrentUser = (fallback = null) => {
  for (const key of ["pb_user", "user", "currentUser", "authUser"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const name = u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
      // Prefer email as the id: it's the one field shared between the real
      // auth/session user object and the pb_users roster used to assign
      // tasks (two separate stores in this app — see todoStore.getFarmerList).
      const id = u.email || u._id || u.id || u.personnelId || u.userId || name;
      const role = u.accountRole || u.role || u.userType || "";
      if (name || id) return { id, name: name || "User", role };
    } catch (e) { /* ignore */ }
  }
  return fallback;
};

/* ── Assigned tasks (Admin → Farmer) ── */
export const getAssignedTasks = (farmerId) => read(K.assigned)[farmerId] || [];

// Flattened view of every task any Admin has assigned, across all Farmers —
// this is what AdminTodo.jsx / the Admin Dashboard To Do card render, so
// there is exactly one place tasks are created and exactly one place they
// are listed (no separate "pb_admin_todos" store).
export const getAllAssignedTasks = () => {
  const all = read(K.assigned);
  const out = [];
  Object.entries(all).forEach(([farmerId, list]) => {
    (list || []).forEach((t) => out.push({ ...t, farmerId }));
  });
  return out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

export const assignTask = (farmerId, task, assignedBy = "Admin") => {
  const all = read(K.assigned);
  const t = {
    _id: uid("at"),
    title: task.title || task.work || "Untitled task",
    description: task.description || task.notes || "",
    type: task.type || "Records",
    dueDate: task.dueDate || "",
    priority: task.priority || "Medium",
    status: "Pending",
    archived: false,
    completedAt: null,
    assignedBy,
    createdAt: new Date().toISOString(),
  };
  all[farmerId] = [t, ...(all[farmerId] || [])];
  write(K.assigned, all);
  // Farmer gets notified
  pushNotification(farmerId, `New task assigned: ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ""}.`);
  return t;
};

// Toggle completion. On complete → notify admin + (caller updates Personnel Tasks).
export const updateAssignedTask = (farmerId, taskId, patch) => {
  const all = read(K.assigned);
  const list = all[farmerId] || [];
  all[farmerId] = list.map((t) => (t._id === taskId ? { ...t, ...patch } : t));
  write(K.assigned, all);
  return all[farmerId];
};

export const deleteAssignedTask = (farmerId, taskId) => {
  const all = read(K.assigned);
  all[farmerId] = (all[farmerId] || []).filter((t) => t._id !== taskId);
  write(K.assigned, all);
};

export const setAssignedTaskDone = (farmerId, taskId, done, farmerName = "A farmer") => {
  const all = read(K.assigned);
  const list = all[farmerId] || [];
  const t = list.find((x) => x._id === taskId);
  if (!t) return null;
  t.status = done ? "Completed" : "Pending";
  t.completedAt = done ? new Date().toISOString() : null;
  write(K.assigned, all);
  if (done) pushNotification("admin", `${farmerName} completed the assigned task: ${t.title}.`);
  return t;
};

/* ── Personal todos (per user; private) ── */
export const getPersonalTodos = (userId) => read(K.personal)[userId] || [];

export const addPersonalTodo = (userId, todo) => {
  const all = read(K.personal);
  const t = {
    _id: uid("pt"),
    title: todo.title || "Untitled",
    description: todo.description || "",
    type: todo.type || "Records",
    dueDate: todo.dueDate || "",
    priority: todo.priority || "Medium",
    done: false,
    archived: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  all[userId] = [t, ...(all[userId] || [])];
  write(K.personal, all);
  return t;
};

export const updatePersonalTodo = (userId, todoId, patch) => {
  const all = read(K.personal);
  const list = all[userId] || [];
  const t = list.find((x) => x._id === todoId);
  if (t) Object.assign(t, patch);
  write(K.personal, all);
  return t;
};

export const togglePersonalTodo = (userId, todoId, done) =>
  updatePersonalTodo(userId, todoId, { done, completedAt: done ? new Date().toISOString() : null });

export const deletePersonalTodo = (userId, todoId) => {
  const all = read(K.personal);
  all[userId] = (all[userId] || []).filter((x) => x._id !== todoId);
  write(K.personal, all);
};

/* ── Farmer directory (for the Admin's "assign to" picker) — reads the
   real Users & Roles store so the list always matches actual accounts. ── */
export const getFarmerList = () => {
  try {
    const users = JSON.parse(localStorage.getItem("pb_users") || "[]");
    return users
      .filter((u) => u.role === "Farmer" && u.status !== "Inactive")
      .map((u) => ({ id: u.email || u._id, name: u.fullName || u.email || u._id }));
  } catch { return []; }
};

/* ── Notifications ── */
export const pushNotification = (userId, message) => {
  const all = read(K.notifs);
  all[userId] = [{ _id: uid("n"), message, read: false, at: new Date().toISOString() }, ...(all[userId] || [])];
  write(K.notifs, all);
};
export const getNotifications = (userId) => read(K.notifs)[userId] || [];
export const getUnreadCount = (userId) => getNotifications(userId).filter((n) => !n.read).length;
export const markNotificationsRead = (userId) => {
  const all = read(K.notifs);
  all[userId] = (all[userId] || []).map((n) => ({ ...n, read: true }));
  write(K.notifs, all);
};
