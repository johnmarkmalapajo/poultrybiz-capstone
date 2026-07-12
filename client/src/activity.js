// activity.js — one place every module calls to feed Audit Logs + Archive.
// Place at: src/activity.js
//
// USAGE inside any module handler:
//   import { activity } from "../activity";
//   activity.added ({ module:"Egg Records", description:"Added Batch B-001 egg record", user, role });
//   activity.edited({ module:"Egg Records", description:"Updated Batch B-001", prev:"320 eggs", next:"341 eggs", user, role });
//   activity.archived({ module:"Egg Records", recordName:"Batch B-001 Egg Record", moduleKey:"pb_eggs", payload:rec, user, role });
//   activity.restored({ module:"Egg Records", recordName:"Batch B-001 Egg Record", user, role }); // Archive page also does this
//
// user/role are optional — pass from useUser(): const { user, role } = useUser();

import { logAudit } from "./pages/AuditLogs";
import { archiveStore } from "./pages/Archive";

const nameOf = (u) => (typeof u === "string" ? u : u?.name || u?.fullName || "Admin");

export const activity = {
  added({ module, description, user = "Admin", role = "Admin" }) {
    return logAudit({ user: nameOf(user), role, module, action: "Added", description });
  },
  edited({ module, description, prev = null, next = null, user = "Admin", role = "Admin" }) {
    return logAudit({ user: nameOf(user), role, module, action: "Edited", description, prev, next });
  },
  approved({ module, description, user = "Admin", role = "Admin" }) {
    return logAudit({ user: nameOf(user), role, module, action: "Approved", description });
  },
  rejected({ module, description, user = "Admin", role = "Admin" }) {
    return logAudit({ user: nameOf(user), role, module, action: "Rejected", description });
  },
  login({ user = "Admin", role = "Admin", module = "Settings" } = {}) {
    return logAudit({ user: nameOf(user), role, module, action: "Login", description: `${nameOf(user)} logged in` });
  },
  logout({ user = "Admin", role = "Admin", module = "Settings" } = {}) {
    return logAudit({ user: nameOf(user), role, module, action: "Logout", description: `${nameOf(user)} logged out` });
  },
  // Archive → adds to Archive page AND auto-writes the audit log (via archiveStore).
  archived({ module, recordName, moduleKey = "", payload = {}, user = "Admin" }) {
    return archiveStore.archive({ module, recordName, archivedBy: nameOf(user), moduleKey, payload });
  },
  // Restore is normally done from the Archive page; expose for completeness.
  restored({ id, user = "Admin" }) {
    return archiveStore.restore(id, nameOf(user));
  },
};

/* ─────────────────────────────────────────────────────────────
   DEMO SEED — populates Audit Logs + Archive with realistic data
   from ALL 11 modules so both pages show entries immediately.
   Call ONCE (e.g. in src/main.jsx):
       import { seedDemoActivity } from "./activity";
       seedDemoActivity();
────────────────────────────────────────────────────────────── */
const AUDIT_KEY = "pb_audit_logs";
const ARCHIVE_KEY = "pb_archive";
const _read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const _write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore */ } };
const _uid = (p) => p + "_" + Date.now() + "_" + Math.floor(Math.random() * 99999);
const iso = (d, h = 9, m = 0) => new Date(`2026-07-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`).toISOString();

export function seedDemoActivity() {
  // No demo/mock activity — Archive & Audit Logs start empty and fill only
  // from real user actions (archiving records, edits, approvals, etc.).
}

export default activity;
