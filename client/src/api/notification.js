// api/notification.js — single source of truth for Notifications page,
// Dashboard Alert card, and Reminders. No page should compute/store its own
// copy of this data — everything reads through the functions below.
//
// ⚠️ No real backend for this existed before (it was simulated entirely in
// localStorage by the now-removed mockApi.js). This targets `/api/notifications`
// following the same REST convention as the rest of the app; it is a NEW
// integration point for the backend dev, not a previously-verified endpoint.
import { apiGet, apiPatch, apiDelete } from "./client";

const PATH = "/api/v1/notifications";

// params: { role, type: 'alert'|'reminder', category, read, page, limit }
// The backend is expected to apply role-based filtering (Farmer only gets
// Records/Inventory/Assigned-Task categories) so the frontend never has to
// duplicate that rule beyond a final display-time check.
export const listNotifications = (params) => apiGet(PATH, params);
export const markNotificationRead   = (id)  => apiPatch(`${PATH}/${id}`, { read: true });
export const markNotificationUnread = (id)  => apiPatch(`${PATH}/${id}`, { read: false });
export const markAllNotificationsRead = ()  => apiPatch(`${PATH}/mark-all-read`, {});
export const deleteNotification = (id) => apiDelete(`${PATH}/${id}`);
