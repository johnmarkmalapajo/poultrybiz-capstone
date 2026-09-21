import { apiGet, apiPost, apiPut, apiDelete, API_BASE } from "./client";

const PATH = "/api/v1/expense-records";

export const listExpenseRecords  = (params) => apiGet(PATH, params);
export const getExpenseRecord    = (id)      => apiGet(`${PATH}/${id}`);
export const createExpenseRecord = (payload) => apiPost(PATH, payload);
export const updateExpenseRecord = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteExpenseRecord = (id)      => apiDelete(`${PATH}/${id}`);
export const archiveExpenseRecord = (id) => apiPut(`${PATH}/${id}/archive`, {});
export const restoreExpenseRecord = (id) => apiPut(`${PATH}/${id}/restore`, {});

export const uploadReceipt = async (file) => {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("receipt", file);

  const response = await fetch(`${API_BASE}${PATH}/upload-receipt`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || "Failed to upload receipt.");
  }

  return data;
};