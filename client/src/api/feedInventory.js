// api/feedInventory.js — Feed Inventory module.
//
// ⚠️ Pre-existing inconsistency found in the original code: the List page's
// GET request was hardcoded to `https://poultrybiz.onrender.com/api/v1/feed-inventory`
// (a different host than everything else), while Add/Edit POST'd to a
// relative `/api/feed-inventory`. Centralized here on `/api/feed-inventory`
// through the single VITE_API_URL base — confirm with the backend dev.
import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const PATH = "/api/v1/feed-inventory";

export const listFeedInventory  = (params) => apiGet(PATH, params);
export const getFeedInventory   = (id)      => apiGet(`${PATH}/${id}`);
export const createFeedInventory = (payload) => apiPost(PATH, payload);
export const updateFeedInventory = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteFeedInventory = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveFeedInventory = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreFeedInventory = (id) => apiPut(`${PATH}/${id}/restore`, {});
