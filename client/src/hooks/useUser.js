// ── Text Size (My Profile) ──────────────────────────────────────────────
// The signed-in user's saved Text Size scales every font-size in the app
// through the --pb-text-scale variable on <html> (see vite.config.js). The
// preference lives on the account (server), and the copy in the stored
// user only lets the right size show before the first server reply.
export const TEXT_SIZES = [
  { value: "small", label: "Small", scale: 0.9 },
  { value: "default", label: "Default", scale: 1 },
  { value: "large", label: "Large", scale: 1.15 },
  { value: "xlarge", label: "Extra Large", scale: 1.3 },
];

export const normalizeTextSize = (size) =>
  TEXT_SIZES.some((s) => s.value === size) ? size : "default";

export function applyTextSize(size) {
  const value = normalizeTextSize(size);
  const { scale } = TEXT_SIZES.find((s) => s.value === value);
  try {
    const root = document.documentElement;
    root.style.setProperty("--pb-text-scale", String(scale));
    root.dataset.textSize = value;
  } catch { /* no document (tests) */ }
  return value;
}

// Signed in: the stored user's size. Signed out (Login, Sign Up...): Default,
// so one account's size never carries over to the next person.
export function syncTextSize() {
  try {
    const signedIn = !!localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return applyTextSize(signedIn ? user.textSize : "default");
  } catch {
    return applyTextSize("default");
  }
}

if (typeof window !== "undefined") {
  syncTextSize();
  window.addEventListener("pb_user_updated", syncTextSize);
  // Another tab of the same browser signed in / out or changed the size.
  window.addEventListener("storage", (e) => {
    if (e.key === "user" || e.key === "token" || e.key === null) syncTextSize();
  });
}

export function updateStoredUser(patch) {
  try {
    const current = JSON.parse(localStorage.getItem("user") || "{}");
    const next = { ...current, ...patch };
    localStorage.setItem("user", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("pb_user_updated"));
    return next;
  } catch {
    return null;
  }
}

export function useUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const rawRole = user.role || "";

    let role = rawRole;

    if (rawRole === "owner") role = "Owner";
    if (rawRole === "farmer") role = "Farmer";

    const r = role.toLowerCase();

    const isOwner = r === "owner";
    const isFarmer = r === "farmer";

    const isManagement = isOwner;

    return {
      user: { ...user, role },
      role,

      isOwner,
      isFarmer,
      isManagement,

      canSeeFinancials: isManagement,
      canEdit: isManagement || isFarmer,
      canArchive: isManagement,
      canViewPersonnel: isManagement,
    };
  } catch {
    return {
      user: {},
      role: "",

      isOwner: false,
      isFarmer: false,
      isManagement: false,

      canSeeFinancials: false,
      canEdit: false,
      canArchive: false,
      canViewPersonnel: false,
    };
  }
}