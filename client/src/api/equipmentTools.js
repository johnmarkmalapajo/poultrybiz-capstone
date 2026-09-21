// api/equipmentTools.js — Equipment & Tools Record module.
// Endpoint verified: `${VITE_API_URL}/api/equipment` (List/Add/Edit already agreed).
import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const PATH = "/api/v1/equipment";

export const listEquipment  = (params) => apiGet(PATH, params);
export const getEquipment   = (id)      => apiGet(`${PATH}/${id}`);
export const createEquipment = (payload) => apiPost(PATH, payload);
export const updateEquipment = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteEquipment = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveEquipment = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreEquipment = (id) => apiPut(`${PATH}/${id}/restore`, {});
