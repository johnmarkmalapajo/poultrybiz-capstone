// authSession.js — shared helpers for the login session stored in this
// browser. The token itself is only ever checked by the backend
// (server/utils/authSession.js); these helpers just clear it and send the
// user to Login, remembering where to come back to.

export const SESSION_REASONS = {
  SESSION_REQUIRED: "Your session has expired. Please log in again.",
  SESSION_ENDED: "You have been logged out. Please log in again.",
  SESSION_IDLE: "Your session expired due to inactivity. Please log in again.",
  attendance: "Please log in to record your attendance.",
};

export const getToken = () => {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
};

export const clearStoredSession = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    /* storage unavailable */
  }
};

// Only same-site paths are allowed as a post-login destination, so a crafted
// link can't send someone to another website after they log in.
export const safeRedirectPath = (value) => {
  const path = String(value || "");
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "";
  if (path === "/login" || path.startsWith("/login?")) return "";
  return path;
};

export const loginUrl = (returnTo, reason) => {
  const params = new URLSearchParams();
  const redirect = safeRedirectPath(returnTo);
  if (redirect) params.set("redirect", redirect);
  if (reason) params.set("reason", reason);
  const query = params.toString();
  return `/login${query ? `?${query}` : ""}`;
};

// Called when the backend rejects the stored token (HTTP 401).
export const endSessionAndGoToLogin = (reason = "SESSION_REQUIRED") => {
  clearStoredSession();

  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;

  const here = window.location.pathname + window.location.search;
  window.location.replace(loginUrl(here, reason));
};