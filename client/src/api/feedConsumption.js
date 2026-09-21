// api/feedConsumption.js — Feed Consumption module.
// ⚠️ Same pre-existing GET-vs-POST host mismatch as feedInventory.js —
// centralized on `/api/feed-consumption` through VITE_API_URL.
import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const PATH = "/api/v1/feed-consumption";

export const listFeedConsumption  = (params) => apiGet(PATH, params);
export const getFeedConsumption   = (id)      => apiGet(`${PATH}/${id}`);
export const createFeedConsumption = (payload) => apiPost(PATH, payload);
export const updateFeedConsumption = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteFeedConsumption = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveFeedConsumption = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreFeedConsumption = (id) => apiPut(`${PATH}/${id}/restore`, {});
