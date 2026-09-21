// api/healthRecord.js
// Health Record API (Diagnosis, Vaccination, Medication, Vitamin Administration)

import {
  apiGet,
  apiPost,
  apiPut,
  apiPatch,
  apiDelete,
} from "./client";

const PATH = "/api/v1/health-records";

/*
|--------------------------------------------------------------------------
| Health Records
|--------------------------------------------------------------------------
*/

export const listHealthRecords = (params) =>
  apiGet(PATH, params);

export const getHealthRecord = (id) =>
  apiGet(`${PATH}/${id}`);

export const createHealthRecord = (payload) =>
  apiPost(PATH, payload);

export const updateHealthRecord = (id, payload) =>
  apiPut(`${PATH}/${id}`, payload);

export const deleteHealthRecord = (id) =>
  apiDelete(`${PATH}/${id}`);

/*
|--------------------------------------------------------------------------
| Archive / Restore
|--------------------------------------------------------------------------
*/

export const archiveHealthRecord = (id) =>
  apiPatch(`${PATH}/${id}/archive`);

export const restoreHealthRecord = (id) =>
  apiPatch(`${PATH}/${id}/restore`);

export const listArchivedHealthRecords = () =>
  apiGet(`${PATH}/archived`);