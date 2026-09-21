// api/archive.js — the Archive page (cross-module view of every archived
// record). Individual "archive this record" actions already go through
// each module's own endpoint directly (see archiveRow.js and the
// archive*() functions in every other api/*.js file) — this file is only
// for the unified LIST view and its restore/permanently-delete actions.
//
// ⚠️ No real backend for this existed before. `/api/archive` is a NEW
// integration point: the expected contract is that the backend tracks
// every soft-deleted record from every module in one queryable place
// (each entry carrying at least: id, module, moduleKey, recordName,
// archivedBy, archivedAt, and the original record payload) so this page
// doesn't need to query 13 different endpoints and merge them itself.
import { apiGet, apiDelete } from "./client";

const PATH = "/api/v1/archive";

export const listArchivedRecords = (params) => apiGet(PATH, params);
// Permanently deletes the archive entry itself (NOT the same as restoring
// it — restoring goes through the original module's restore*() function,
// via archiveRow.js's RESTORE_FN_BY_MODULE_KEY map, since that's the
// module that owns the record's real shape).
export const deleteArchiveEntry = (id) => apiDelete(`${PATH}/${id}`);
