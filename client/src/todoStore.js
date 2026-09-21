import {
  listAllAssignedTasks, listAssignedTasks, createAssignedTask,
  updateAssignedTask as apiUpdateAssignedTask,
  archiveAssignedTask as apiArchiveAssignedTask,
  restoreAssignedTask as apiRestoreAssignedTask,
  setAssignedTaskDone as apiSetAssignedTaskDone,
  deleteAssignedTask as apiDeleteAssignedTask,
  listPersonalTodos, createPersonalTodo as apiCreatePersonalTodo,
  updatePersonalTodo as apiUpdatePersonalTodo,
  deletePersonalTodo as apiDeletePersonalTodo,
  listAllPersonalTodos,
  getFarmerList as apiGetFarmerList,
  archivePersonalTodo as apiArchivePersonalTodo,
  restorePersonalTodo as apiRestorePersonalTodo,
  
} from "./api/todo";

export const getCurrentUser = (fallback = null) => {
  for (const key of ["pb_user", "user", "currentUser", "authUser"]) {
    try {
      const raw = localStorage.getItem(key);if (!raw) continue;
      const u = JSON.parse(raw);
      const name = u.fullName || u.name || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username;
      const id = u.personnelId || u.userId || u._id || u.id || u.email || name;
      const userId = u.userId || u._id || u.id || u.email || name;
      const role = u.accountRole || u.role || u.userType || "";
      if (name || id) return { id, userId, name: name || "User", role };
    } catch { }
  }
  return fallback;
};

let cache = { assignedAll: [], assigned: [], personal: [], personalOthers: [] };
let lastError = null;
const listeners = new Set();
const notify = () => listeners.forEach((cb) => cb());

export const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
export const getLastError = () => lastError;

export const getCachedAllAssignedTasks = () => cache.assignedAll;
export const getCachedAssignedTasks    = () => cache.assigned;
export const getCachedPersonalTodos    = () => cache.personal;
export const getCachedOthersPersonalTodos = () => cache.personalOthers;

export async function refreshAllAssignedTasks() {
  try { cache.assignedAll = await listAllAssignedTasks(); lastError = null; }
  catch (err) { lastError = err; }notify();
  return cache.assignedAll;
}
export async function refreshAssignedTasks(farmerId) {
  try {
    const result = await listAssignedTasks(farmerId);
    cache.assigned = result.records || result.data || result || [];
    lastError = null;
  } catch (err) {
    lastError = err;
  }
  notify();
  return cache.assigned;
}
export async function refreshPersonalTodos(userId) {
  try { cache.personal = await listPersonalTodos(userId); lastError = null; }
  catch (err) { lastError = err; }
  notify();
  return cache.personal;
}
export async function refreshOthersPersonalTodos() {
  try { cache.personalOthers = await listAllPersonalTodos(); lastError = null; }
  catch (err) { lastError = err; }
  notify();
  return cache.personalOthers;
}

export async function assignTask(farmerId, task, assignedBy = "Owner") {
  const t = await createAssignedTask(farmerId, { ...task, assignedBy });
  await refreshAllAssignedTasks();
  return t;
}
export async function updateAssignedTaskById(personnelId, taskId, patch) {
  await apiUpdateAssignedTask(personnelId, taskId, patch);
  await refreshAllAssignedTasks();
}
export async function archiveAssignedTaskById(personnelId, taskId) {
  await apiArchiveAssignedTask(personnelId, taskId);
  await refreshAllAssignedTasks();
}
export async function archivePersonalTodoById(id, userId) {
  await apiArchivePersonalTodo(id);
  await refreshPersonalTodos(userId);
}
export async function restorePersonalTodoById(id, userId) {
  await apiRestorePersonalTodo(id);
  await refreshPersonalTodos(userId);
}
export async function restoreAssignedTaskById(personnelId, taskId) {
  await apiRestoreAssignedTask(personnelId, taskId);
  await refreshAllAssignedTasks();
}
export async function deleteAssignedTaskById(personnelId, taskId) {
  await apiDeleteAssignedTask(personnelId, taskId);
  await refreshAllAssignedTasks();
}
export async function setAssignedTaskDoneById(personnelId, taskId, done) {
  await apiSetAssignedTaskDone(personnelId, taskId, done);

  await Promise.all([
    refreshAssignedTasks(personnelId),
    refreshAllAssignedTasks(),
  ]);

  notify();
}
export async function addPersonalTodo(userId, todo) {
  const t = await apiCreatePersonalTodo(userId, todo);
  await refreshPersonalTodos(userId);
  return t;
}
export async function updatePersonalTodoById(id, patch, userId) {
  await apiUpdatePersonalTodo(id, patch);
  await refreshPersonalTodos(userId);
}
export async function deletePersonalTodoById(id, userId) {
  await apiDeletePersonalTodo(id);
  await refreshPersonalTodos(userId);
}

export async function getFarmerList() {
  try { return await apiGetFarmerList(); }
  catch { return []; }
}