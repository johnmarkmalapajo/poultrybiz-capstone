// notifStore.js — single source of truth for notifications.
// Used by both the Notifications page and the Sidebar unread badge so the
// count stays in sync: it decreases as items are marked read and disappears
// once everything has been read.

const now = Date.now();
const min = 60 * 1000, hr = 60 * min, day = 24 * hr;

export const SEED = [
  // ── ALERTS ──
  { id: "n1",  type: "alert", category: "mortality", priority: "high",   read: false, dateTime: now - 12 * min, title: "High Mortality Detected", description: "Batch B-014 mortality reached 10% today. Immediate review required." },
  { id: "n2",  type: "alert", category: "health",    priority: "high",   read: false, dateTime: now - 40 * min, title: "Disease Detected", description: "New diagnosis recorded: suspected Newcastle disease in Batch B-009." },
  { id: "n3",  type: "alert", category: "feed",      priority: "high",   read: false, dateTime: now - 1 * hr,  title: "Critical Feed Inventory", description: "Layer Pellets will last approximately 5 more days. Restocking is recommended." },
  { id: "n4",  type: "alert", category: "visitor",   priority: "high",   read: false, dateTime: now - 2 * hr,  title: "Biosecurity Risk Visitor", description: "Ramon Cruz answered YES to visiting another farm within 7 days. Marked as biosecurity risk." },
  { id: "n5",  type: "alert", category: "egg",       priority: "medium", read: false, dateTime: now - 3 * hr,  title: "Low Hen-Day Production", description: "Hen-Day Production fell to 76% — below the 80% threshold." },
  { id: "n6",  type: "alert", category: "egg",       priority: "medium", read: true,  dateTime: now - 5 * hr,  title: "Egg Production Drop", description: "Hen-Day Production decreased by 3.4% compared to yesterday." },
  { id: "n7",  type: "alert", category: "egg",       priority: "medium", read: false, dateTime: now - 6 * hr,  title: "Daily Egg Record Not Submitted", description: "Today's egg record has not yet been submitted." },
  { id: "n8",  type: "alert", category: "sales",     priority: "medium", read: true,  dateTime: now - 8 * hr,  title: "Sales Decrease", description: "Daily sales dropped 22% versus the 7-day average." },
  { id: "n9",  type: "alert", category: "sales",     priority: "high",   read: false, dateTime: now - 10 * hr, title: "Net Loss Detected", description: "Yesterday's transactions resulted in a net loss of ₱1,240." },
  { id: "n10", type: "alert", category: "feed",      priority: "medium", read: true,  dateTime: now - 12 * hr, title: "Low Feed Stock", description: "Estimated feed supply is less than 14 days for Starter Mash." },
  { id: "n11", type: "alert", category: "mortality", priority: "medium", read: false, dateTime: now - 14 * hr, title: "Mortality Threshold Reached", description: "Batch B-006 mortality reached 5%." },
  { id: "n12", type: "alert", category: "isolation", priority: "medium", read: true,  dateTime: now - 20 * hr, title: "New Isolation Case", description: "A chicken from Batch B-011 was placed under isolation." },
  { id: "n13", type: "alert", category: "personnel", priority: "medium", read: false, dateTime: now - 1 * day, title: "Task Overdue", description: "Assigned task 'Clean coop section C' for Juan D. is now overdue." },
  { id: "n14", type: "alert", category: "users",     priority: "medium", read: false, dateTime: now - 1 * day - 3 * hr, title: "Pending Farmer Approval", description: "A new Farmer account is waiting for admin approval.", roles: ["Admin"] },

  // ── REMINDERS ──
  { id: "n15", type: "reminder", category: "age",        priority: "low", read: false, dateTime: now - 2 * hr,          title: "Culling Reminder — Approaching", description: "Batch B-002 reached 95 weeks. Prepare for culling or replacement soon." },
  { id: "n16", type: "reminder", category: "age",        priority: "low", read: true,  dateTime: now - 1 * day,         title: "Recommended for Culling", description: "Batch B-001 reached 104 weeks (2 years) and is recommended for culling." },
  { id: "n17", type: "reminder", category: "age",        priority: "low", read: false, dateTime: now - 2 * day,         title: "Overage Active Flock", description: "Batch B-000 exceeded 104 weeks but is still marked Active." },
  { id: "n18", type: "reminder", category: "quarantine", priority: "low", read: false, dateTime: now - 5 * hr,          title: "Quarantine Complete", description: "Batch Q-03 quarantine period is complete and ready for release." },
  { id: "n19", type: "reminder", category: "health",     priority: "low", read: true,  dateTime: now - 1 * day - 6 * hr, title: "Vaccination Reminder", description: "Scheduled vaccination for Batch B-007 is due tomorrow." },
];

const N_KEY = "pb_notifications";
const SEED_FLAG = "pb_notif_seeded_v2";
const EVENT = "pb_notifs_changed";

const read = () => {
  try { const a = JSON.parse(localStorage.getItem(N_KEY)); return Array.isArray(a) ? a : []; }
  catch { return []; }
};

const write = (arr) => {
  try { localStorage.setItem(N_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
  // notify same-tab listeners (the sidebar badge, etc.)
  try { window.dispatchEvent(new Event(EVENT)); } catch { /* ignore */ }
};

// A notification with no `roles` field is visible to everyone (e.g. the
// operational farm alerts). One WITH a `roles` array is only visible to
// users whose role is included — e.g. Admin-only account approvals or
// financial alerts should never count toward a Farmer's badge/list.
function isVisibleToRole(n, role) {
  if (!n.roles || n.roles.length === 0) return true;
  if (!role) return true; // unknown role — fail open rather than hide info
  return n.roles.includes(role);
}

// No demo/mock notifications — the list starts empty.
export function seedOnce() { /* intentionally empty */ }

// `role` is optional — pass the current user's role (e.g. "Admin" or
// "Farmer") to scope the results to what that role should see.
export function getAll(role) {
  seedOnce();
  const all = read();
  return role ? all.filter((n) => isVisibleToRole(n, role)) : all;
}

export function setAll(next) { write(next); }

export function getUnreadCount(role) {
  seedOnce();
  return read().filter((n) => !n.read && isVisibleToRole(n, role)).length;
}

// Subscribe to changes (same-tab custom event + focus + cross-tab storage).
// Returns an unsubscribe function.
export function subscribe(cb) {
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener("focus", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("focus", handler);
    window.removeEventListener("storage", handler);
  };
}