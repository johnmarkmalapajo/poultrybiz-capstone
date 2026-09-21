import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const PATH = "/api/v1/sales-records";

export const listSalesRecords  = (params) => apiGet(PATH, params);
export const getSalesRecord    = (id)      => apiGet(`${PATH}/${id}`);
export const getEggStockSummary = () => apiGet(`${PATH}/egg-stock`);
export const createSalesRecord = (payload) => apiPost(PATH, payload);
export const updateSalesRecord = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteSalesRecord = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveSalesRecord = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreSalesRecord = (id) => apiPut(`${PATH}/${id}/restore`, {});