import {
  listNotifications,
  markNotificationRead as apiMarkNotificationRead,
  markAllNotificationsRead as apiMarkAllNotificationsRead,
  deleteNotification as apiDeleteNotification,
} from "./api/notification";

export const FARMER_ALLOWED_CATEGORIES = [
  "egg", "feed", "health", "mortality", "quarantine", "isolation", "equipment", "age", "task", "todo",
];

function isVisibleToRole(n, role) {
  if (role === "Farmer" && n.category && !FARMER_ALLOWED_CATEGORIES.includes(n.category)) return false;
  if (!n.roles || n.roles.length === 0) return true;
  if (!role) return true;
  return n.roles.includes(role);
}

let cache = [];
let lastError = null;
let inFlight = null;
const listeners = new Set();
const notify = () => listeners.forEach((cb) => cb());

export async function refresh(role) {
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const json = await listNotifications(role ? { role } : undefined);

      cache = Array.isArray(json)
        ? json
        : json?.notifications || json?.data || [];

      lastError = null;
    } catch (err) {
      lastError = err;
    }

    notify();
    return cache;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function getCached(role) {
  return role ? cache.filter((n) => isVisibleToRole(n, role)) : cache;
}

export function getLastError() { return lastError; }

export function getUnreadCount(role) {
  return getCached(role).filter((n) => !n.read).length;
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function markNotificationRead(id) {
  await apiMarkNotificationRead(id);
  await refresh();
}

export async function markAllNotificationsRead() {
  await apiMarkAllNotificationsRead();
  await refresh();
}

export async function deleteNotification(id) {
  await apiDeleteNotification(id);
  await refresh();
}