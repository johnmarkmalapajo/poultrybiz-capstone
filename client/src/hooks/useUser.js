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