// api/personnelManpower.js
import { apiGet, apiPost, apiPut, apiDelete } from "./client";

const PATH = "/api/v1/personnel";

/* ===========================
   PERSONNEL
=========================== */

export const listPersonnel = (params) =>
  apiGet(PATH, params);

export const getPersonnel = (id) =>
  apiGet(`${PATH}/${id}`);

export const createPersonnel = (payload) =>
  apiPost(PATH, payload);

export const updatePersonnel = (id, payload) =>
  apiPut(`${PATH}/${id}`, payload);

export const deletePersonnel = (id) =>
  apiDelete(`${PATH}/${id}`);

export const archivePersonnel = (id) =>
  apiPut(`${PATH}/${id}/archive`, {});

export const restorePersonnel = (id) =>
  apiPut(`${PATH}/${id}/restore`, {});

/* ===========================
   ATTENDANCE
=========================== */

export const getPersonnelAttendance = (id, params) =>
  apiGet(`${PATH}/${id}/attendance`, params);

export const createAttendance = () =>
  apiPost("/api/v1/attendance/check");

export const updateAttendance = (attendanceId, payload) =>
  apiPut(`${PATH}/attendance/${attendanceId}`, payload);

export const deleteAttendance = (attendanceId) =>
  apiDelete(`${PATH}/attendance/${attendanceId}`);

/* ===========================
   PERSONNEL TASKS
=========================== */

export const getPersonnelTasks = (personnelId, params) =>
  apiGet(`${PATH}/${personnelId}/tasks`, params);

export const getPersonnelTask = (personnelId, taskId) =>
  apiGet(`${PATH}/${personnelId}/tasks/${taskId}`);

export const createPersonnelTask = (id, payload) =>
  apiPost(`${PATH}/${id}/tasks`, payload);

export const updatePersonnelTask = (personnelId, taskId, payload) =>
  apiPut(`${PATH}/${personnelId}/tasks/${taskId}`, payload);

export const deletePersonnelTask = (personnelId, taskId) =>
  apiDelete(`${PATH}/${personnelId}/tasks/${taskId}`);