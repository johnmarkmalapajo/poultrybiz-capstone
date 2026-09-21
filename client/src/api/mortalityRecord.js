import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from "./client";

const PATH = "/api/v1/mortality-records";

/*
|--------------------------------------------------------------------------
| Mortality Record API
|--------------------------------------------------------------------------
*/

export const listMortalityRecords = (params) =>
  apiGet(PATH, params);

export const getMortalityRecord = (id) =>
  apiGet(`${PATH}/${id}`);

export const createMortalityRecord = (payload) =>
  apiPost(PATH, payload);

export const updateMortalityRecord = (id, payload) =>
  apiPut(`${PATH}/${id}`, payload);

export const deleteMortalityRecord = (id) =>
  apiDelete(`${PATH}/${id}`);

export const archiveMortalityRecord = (id) =>
  apiPatch(`${PATH}/${id}/archive`);

export const restoreMortalityRecord = (id) =>
  apiPatch(`${PATH}/${id}/restore`);

export const listArchivedMortalityRecords = () =>
  apiGet(`${PATH}/archived`);