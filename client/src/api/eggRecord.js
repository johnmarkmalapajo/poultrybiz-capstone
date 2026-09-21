import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from "./client";

const PATH = "/api/v1/egg-records";

export const listEggRecords = (params) => apiGet(PATH, params);

export const getEggRecord = (id) =>
  apiGet(`${PATH}/${id}`);

export const createEggRecord = (payload) =>
  apiPost(PATH, payload);

export const updateEggRecord = (id, payload) =>
  apiPut(`${PATH}/${id}`, payload);

export const deleteEggRecord = (id) =>
  apiDelete(`${PATH}/${id}`);

export const archiveEggRecord = (id) =>
  apiPatch(`${PATH}/${id}/archive`, {});

export const restoreEggRecord = (id) =>
  apiPatch(`${PATH}/${id}/restore`, {});