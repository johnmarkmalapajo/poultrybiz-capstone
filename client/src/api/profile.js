// api/profile.js
// "My Profile" self-service (logged-in user)

import { apiGet, apiPut, apiPost, API_BASE } from "./client";

const PATH = "/api/v1/profile";

// ==============================
// PROFILE
// ==============================

export const getMyProfile = () => apiGet(PATH);

export const updateMyProfile = (payload) =>
  apiPut(PATH, payload);

// ==============================
// CHANGE PASSWORD
// ==============================

export const changeMyPassword = (payload) =>
  apiPost(`${PATH}/change-password`, payload);

// ==============================
// UPLOAD PROFILE PICTURE
// ==============================

export const uploadAvatar = async (file) => {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("avatar", file);

  const response = await fetch(`${API_BASE}${PATH}/upload-avatar`, {
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
    throw new Error(data.message || "Failed to upload profile picture.");
  }

  return data;
};

// ==============================
// FARM IDENTITY (Owner only to edit; any authenticated user can read)
// ==============================

export const getFarmInfo = () => apiGet(`${PATH}/farm`);

export const uploadFarmLogo = async (file) => {
  const token = localStorage.getItem("token");

  const formData = new FormData();
  formData.append("logo", file);

  const response = await fetch(`${API_BASE}${PATH}/upload-farm-logo`, {
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
    throw new Error(data.message || "Failed to upload farm logo.");
  }

  return data;
};