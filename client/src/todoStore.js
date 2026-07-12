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
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };
const uid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/* ── Current user (from auth in real app; demo fallback here) ── */
export const getCurrentUser = (fallback = null) => {
  for (const key of ["pb_user", "user", "currentUser", "authUser"]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const u = JSON.parse(raw);
      const name = u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
      const id = u._id || u.id || u.personnelId || u.userId || name;
      const role = u.accountRole || u.role || u.userType || "";
      if (name || id) return { id, name: name || "User", role };
    } catch (e) { /* ignore */ }
  }
  return fallback;
};

/* ── Assigned tasks (Admin → Farmer) ── */
export const getAssignedTasks = (farmerId) => read(K.assigned)[farmerId] || [];

export const assignTask = (farmerId, task, assignedBy = "Admin") => {
  const all = read(K.assigned);
  const t = {
    _id: uid("at"),
    title: task.title || task.work || "Untitled task",
    description: task.description || task.notes || "",
    dueDate: task.dueDate || "",
    priority: task.priority || "Medium",
    status: "Pending",
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
    dueDate: todo.dueDate || "",
    priority: todo.priority || "Medium",
    done: false,
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
