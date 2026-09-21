// api/auditLog.js — Audit Logs page.
//
// ⚠️ No real backend for this existed before (simulated in localStorage,
// with the FRONTEND writing its own audit entries). That's the wrong
// architecture for a real audit trail — a log a client can fabricate
// isn't trustworthy. The real backend should generate these entries
// itself whenever a mutation endpoint (create/update/archive/restore/
// approve/reject/login) is called, using the authenticated user from the
// request, not a value the frontend supplies. This file is intentionally
// read-only — there is no createAuditLog() here on purpose.

import { apiGet } from "./client";

const PATH = "/api/v1/audit-logs";

export const listAuditLogs = (params) =>
  apiGet(PATH, params);