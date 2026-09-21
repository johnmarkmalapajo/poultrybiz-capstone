import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const PATH = "/api/v1/visitors";

export const listVisitors  = (params) => apiGet(PATH, params);
export const getVisitor    = (id)      => apiGet(`${PATH}/${id}`);
export const createVisitor = (payload) => apiPost(PATH, payload);
export const updateVisitor = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteVisitor = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveVisitor = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreVisitor = (id) => apiPut(`${PATH}/${id}/restore`, {});
export const getVisitorLogs = (id, params) => apiGet(`${PATH}/${id}/logs`, params);

export const registerVisitorCheckIn = (payload) => apiPost(`${PATH}/register`, payload);