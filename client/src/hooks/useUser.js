// src/hooks/useUser.js
export function useUser() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const rawRole = user.role || "";

    // ── Normalize old role names to new ones ──
    // Old: "admin" → New: "Admin"
    // Old: "staff" → New: "Farmer"
    let role = rawRole;
    if (rawRole === "admin")  role = "Admin";
    if (rawRole === "staff")  role = "Farmer";

    const r = role.toLowerCase();

    // ── Access rules (RBAC) ──
    const canSeeFinancials  = r === "admin";              // Only Admin sees financial data
    const canEdit           = r === "admin" || r === "farmer"; // Admin + Farmer can edit
    const canArchive        = r === "admin";              // Only Admin can archive
    const canViewPersonnel  = r === "admin";              // Farmer cannot see Personnel & Visitors

    // Return user with normalized role + permission flags
    return {
      user: { ...user, role },
      role,
      canSeeFinancials,
      canEdit,
      canArchive,
      canViewPersonnel,
    };
  } catch {
    return {
      user: {},
      role: "",
      canSeeFinancials: false,
      canEdit: false,
      canArchive: false,
      canViewPersonnel: false,
    };
  }
}