// api/quarantineIsolation.js — Quarantine & Isolation module.
//
// ⚠️ Pre-existing inconsistency found in the original code: the List and Add
// pages called `/api/quarantine-isolation`, but the Edit page called
// `/api/quarantine-records/:id`. Centralized here on `/api/quarantine-isolation`
// (majority convention). Confirm the real route with the backend dev and
// update PATH below if it should be `quarantine-records` instead.
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "./client";

const PATH = "/api/v1/quarantine-isolation";

export const listQuarantineRecords  = (params) => apiGet(PATH, params);
export const getQuarantineRecord    = (id)      => apiGet(`${PATH}/${id}`);
export const createQuarantineRecord = (payload) => apiPost(PATH, payload);
export const updateQuarantineRecord = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const updateIsolationProgress = (id, payload) => apiPatch(`${PATH}/${id}/progress`, payload);
export const correctIsolationProgress = (id, updateId, payload) => apiPatch(`${PATH}/${id}/progress/${updateId}`, payload);
export const updateQuarantineStatus = (id, status) => apiPatch(`${PATH}/${id}/status`, { status });
export const deleteQuarantineRecord = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveQuarantineRecord = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreQuarantineRecord = (id) => apiPut(`${PATH}/${id}/restore`, {});