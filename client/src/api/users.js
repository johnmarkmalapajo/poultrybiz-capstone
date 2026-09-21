import { apiGet, apiPut, apiPatch, apiDelete } from "./client";

const PATH = "/api/v1/users";

export const listUsers = () => apiGet(`${PATH}/all-users`);

export const getPendingUsers = () => apiGet(`${PATH}/pending-users`);

export const approveUser = (id) =>
  apiPut(`${PATH}/approve/${id}`, {});

export const rejectUser = (id) =>
  apiPut(`${PATH}/reject/${id}`, {});

export const activateUser = (id) =>
  apiPatch(`${PATH}/${id}/activate`, {});

export const deactivateUser = (id) =>
  apiPatch(`${PATH}/${id}/deactivate`, {});

export const archiveUser = (id) =>
  apiPatch(`${PATH}/${id}/archive`, {});

export const restoreUser = (id) =>
  apiPatch(`${PATH}/${id}/restore`, {});

export const deleteUserPermanently = (id) =>
  apiDelete(`${PATH}/${id}/permanent`);

export const getUser = () => {
  throw new Error("getUser() is not implemented.");
};

export const getArchivedUsers = () =>
  apiGet(`${PATH}/archived-users`);