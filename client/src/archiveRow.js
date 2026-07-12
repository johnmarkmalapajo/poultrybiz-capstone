// archiveRow.js — shared, reusable "archive this record" helper.
// Used by ALL record modules so archiving behaves identically everywhere:
//   • NO confirmation dialog — archiving is immediate (per UX spec).
//   • The record moves to the Archive page (with audit log entry).
//   • The record is removed from the module's data store, so the table,
//     statistics, and Dashboard all reflect the change.
// Backend-ready: when a real API exists, swap the localStorage removal
// for a DELETE request — the call sites stay exactly the same.
import { activity } from "./activity";

export function archiveRow({ module, moduleKey, record, name, user = "Admin", reload = true }) {
  if (!record) return;

  // 1) Move to Archive + write audit log
  activity.archived({
    module,
    recordName: name || record.name || record.fullName || record._id || record.id || "Record",
    moduleKey,
    payload: record,
    user,
  });

  // 2) Remove from the module's local store (same store the mock API reads)
  try {
    const arr = JSON.parse(localStorage.getItem(moduleKey) || "[]");
    const id = record._id ?? record.id;
    const next = arr.filter((r) => (r._id ?? r.id) !== id);
    localStorage.setItem(moduleKey, JSON.stringify(next));
  } catch { /* ignore */ }

  // 3) Notify listeners (Dashboard live-sync) + refresh the table
  try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ }
  if (reload) window.location.reload();
}
