// api/wasteManure.js — Waste & Manure Record module.
//
// ⚠️ Pre-existing inconsistency found in the original code: Add Manure posts
// to `/api/manure-records`, Add Waste posts to `/api/waste-records`, but the
// List page only ever fetched `/api/waste-records` (manure entries were
// created but never displayed). Both are exposed here and the List page
// merges them, which is a correctness fix, not a new endpoint invention —
// the manure-records endpoint already existed and was simply unused.
import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const WASTE_PATH  = "/api/v1/waste-records";
const MANURE_PATH = "/api/v1/manure-records";

export const listWasteRecords  = (params) => apiGet(WASTE_PATH, params);
export const createWasteRecord = (payload) => apiPost(WASTE_PATH, payload);
export const getWasteRecord    = (id) => apiGet(`${WASTE_PATH}/${id}`);
export const updateWasteRecord = (id, payload) => apiPut(`${WASTE_PATH}/${id}`, payload);
export const deleteWasteRecord = (id) => apiDelete(`${WASTE_PATH}/${id}`);
export const archiveWasteRecord = (id) => apiPut(`${WASTE_PATH}/${id}/archive`, {});
export const restoreWasteRecord = (id) => apiPut(`${WASTE_PATH}/${id}/restore`, {});

export const listManureRecords  = (params) => apiGet(MANURE_PATH, params);
export const createManureRecord = (payload) => apiPost(MANURE_PATH, payload);
export const getManureRecord    = (id) => apiGet(`${MANURE_PATH}/${id}`);
export const updateManureRecord = (id, payload) => apiPut(`${MANURE_PATH}/${id}`, payload);
export const deleteManureRecord = (id) => apiDelete(`${MANURE_PATH}/${id}`);
export const archiveManureRecord = (id) => apiPut(`${MANURE_PATH}/${id}/archive`, {});
export const restoreManureRecord = (id) => apiPut(`${MANURE_PATH}/${id}/restore`, {});
