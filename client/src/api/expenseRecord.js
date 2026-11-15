import { apiGet, apiPost, apiPut, apiDelete, API_BASE } from "./client";

const PATH = "/api/v1/expense-records";

export const listExpenseRecords  = (params) => apiGet(PATH, params);
export const getExpenseRecord    = (id)      => apiGet(`${PATH}/${id}`);
export const createExpenseRecord = (payload) => apiPost(PATH, payload);
export const updateExpenseRecord = (id, payload) => apiPut(`${PATH}/${id}`, payload);
export const deleteExpenseRecord = (id)      => apiDelete(`${PATH}/${id}`);
export const restoreExpenseRecord = (id) => apiPut(`${PATH}/${id}/restore`, {});

// Receipt / Proof of Delivery files: JPG, PNG or PDF, up to 5MB -- the same
// rule the server enforces (server/middleware/receiptUpload.js).
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
};

// Message for a file that can't be uploaded, or "" when it's fine. Used when
// the file is chosen, so the problem shows right away, and again before upload.
export function receiptFileError(file) {
  if (!file) return "";
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const allowed = RECEIPT_TYPES[file.type];
  if (!allowed || !allowed.includes(ext)) return "Only JPG, PNG or PDF files are allowed.";
  if (file.size > RECEIPT_MAX_BYTES) return "The file is too large. The maximum size is 5MB.";
  if (file.size === 0) return "The file is empty. Choose another file.";
  return "";
}

// Uploads one Receipt or Proof of Delivery file and returns the server's
// response ({ success, receipt: "/uploads/receipts/<file>" }). Throws an
// Error with a message the form can show when the upload fails.
export const uploadReceipt = async (file) => {
  const invalid = receiptFileError(file);
  if (invalid) throw new Error(invalid);

  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("receipt", file);

  let response;
  try {
    response = await fetch(`${API_BASE}${PATH}/upload-receipt`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch {
    throw new Error("Couldn't upload the file. Check your connection and try again.");
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || `Failed to upload the file (error ${response.status}).`);
  }
  if (!data.receipt) {
    throw new Error("The server did not return the uploaded file. Please try again.");
  }

  return data;
};