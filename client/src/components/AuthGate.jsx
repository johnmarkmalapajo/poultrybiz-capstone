// AuthGate.jsx — the single login check for every page of the app.
//
//   * Public pages (login, signup, password reset, visitor registration,
//     attendance QR, pending approval, landing) always render.
//   * Any other page needs a stored token. Without one the user goes to
//     Login, which brings them back to the requested page afterwards.
//   * The stored token is confirmed with the backend once per page load
//     (GET /profile) before anything protected renders, and the role used
//     for page access is refreshed from that server response -- so an
//     edited role in localStorage or a logged-out/expired token never shows
//     protected content. Later 401s are handled by api/client.js.
//   * The check runs on every navigation, so Back after logout cannot show
//     a protected page, and logging out in another tab is picked up too.
//
// Owner-only pages are still wrapped in ProtectedRoute (main.jsx), and the
// backend enforces the same rules with protect / ownerOnly.

import { useEffect, useReducer, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getMyProfile } from "../api/profile";
import { getToken, loginUrl } from "../api/session";
import { updateStoredUser } from "../hooks/useUser";
import "./AuthGate.css";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/pending-approval",
  "/visitor/register",
  "/attendance/check-in",
];

// Token already confirmed by the backend during this page load.
const verified = { token: "" };

export default function AuthGate({ children }) {
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.includes(location.pathname);
  // Read on every render: every navigation re-renders this gate, so a token
  // removed by logout is noticed immediately.
  const token = getToken();
  const [status, setStatus] = useState("idle"); // idle | checking | error
  const [retryKey, setRetryKey] = useState(0);
  const [, rerender] = useReducer((n) => n + 1, 0);

  // Logging in or out in another tab updates this tab too.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "token" || e.key === null) rerender();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const needsCheck = !isPublic && !!token && verified.token !== token;

  useEffect(() => {
    if (!needsCheck) return undefined;

    let cancelled = false;

    getMyProfile()
      .then((data) => {
        if (cancelled) return;
        const record = data?.record || {};
        updateStoredUser({
          role: record.role,
          name: record.fullName,
          status: record.status,
        });
        verified.token = token;
        setStatus("idle");
        rerender();
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 -> api/client.js has already cleared the token and is opening
        // Login; keep the loading screen until that navigation happens.
        if (err?.status !== 401) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [needsCheck, token, retryKey]);

  if (isPublic) return children;

  if (!token) {
    const here = location.pathname + location.search;
    return <Navigate to={loginUrl(here, "login")} replace />;
  }

  if (verified.token === token) return children;

  if (status === "error") {
    return (
      <div className="pb-auth-gate" role="alert">
        <div className="pb-auth-card">
          <h2>Can't verify your session</h2>
          <p>The server couldn't be reached. Check your connection and try again.</p>
          <button
            type="button"
            className="pb-auth-btn"
            onClick={() => {
              setStatus("checking");
              setRetryKey((k) => k + 1);
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-auth-gate" role="status" aria-live="polite">
      <div className="pb-auth-spinner" aria-hidden="true" />
      <p className="pb-auth-text">Checking your session…</p>
    </div>
  );
}