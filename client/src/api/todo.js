import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "./client";

const PATH = "/api/v1/personnel";

export const getAssignedTask = (personnelId, taskId) =>
  apiGet(`${PATH}/${personnelId}/tasks/${taskId}`);

export const createAssignedTask = (personnelId, payload) =>
  apiPost(`${PATH}/${personnelId}/tasks`, payload);

export const updateAssignedTask = (personnelId, taskId, payload) =>
  apiPut(`${PATH}/${personnelId}/tasks/${taskId}`, payload);

export const archiveAssignedTask = (personnelId, taskId) =>
  apiPut(`${PATH}/${personnelId}/tasks/${taskId}/archive`, {});

export const restoreAssignedTask = (personnelId, taskId) =>
  apiPut(`${PATH}/${personnelId}/tasks/${taskId}/restore`, {});

export const deleteAssignedTask = (personnelId, taskId) =>
  apiDelete(`${PATH}/${personnelId}/tasks/${taskId}`);

export const listAssignedTasks = (personnelId) =>
  apiGet(`${PATH}/${personnelId}/tasks`);;

export const listAllAssignedTasks = () =>
  apiGet(`${PATH}/all-tasks`);

export const setAssignedTaskDone = (personnelId, taskId, done) =>
  apiPut(`${PATH}/${personnelId}/tasks/${taskId}`, {
    status: done ? "Completed" : "Pending",
  });

const PERSONAL_PATH = "/api/v1/personal-todos";

export const listPersonalTodos = (userId, params) =>
  apiGet(PERSONAL_PATH, { userId, ...params });

export const listAllPersonalTodos = () =>
  apiGet(`${PERSONAL_PATH}/all`);

export const createPersonalTodo = (userId, payload) =>
  apiPost(PERSONAL_PATH, { ...payload, userId });

export const updatePersonalTodo = (id, payload) =>
  apiPut(`${PERSONAL_PATH}/${id}`, payload);

export const archivePersonalTodo = (id) =>
  apiPut(`${PERSONAL_PATH}/${id}/archive`, {});

export const restorePersonalTodo = (id) =>
  apiPut(`${PERSONAL_PATH}/${id}/restore`, {});

export const deletePersonalTodo = (id) =>
  apiDelete(`${PERSONAL_PATH}/${id}`);

export const getFarmerList = () =>
  apiGet(PATH);