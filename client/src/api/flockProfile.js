// api/flockProfile.js — Flock Profile module.
// Endpoint verified: Mortality/Health/Egg/Quarantine/Feed Consumption
// dropdowns already depended on `/api/flocks`; Flockprofile.jsx, Addflock.jsx,
// EditFlock.jsx, and BatchSummary.jsx now use it too (previously local-only
// via the now-removed batchStore.js).
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from "./client";

const PATH = "/api/v1/flocks";

export const listFlocks  = (params) => apiGet(PATH, params);
export const getFlock    = (id)      => apiGet(`${PATH}/${id}`);
export const createFlock = (payload) => apiPost(PATH, payload);
export const updateFlock = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const updateFlockStatus = (id, status) => apiPatch(`${PATH}/${id}/status`, { status });
export const deleteFlock = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveFlock = (id) => apiPatch(`${PATH}/${id}/archive`, {});
export const restoreFlock = (id) => apiPatch(`${PATH}/${id}/restore`, {});