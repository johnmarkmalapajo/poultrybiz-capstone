// Role-Based Export Permission System — Export is Owner-only across
// every module. Farmers (and any other role) cannot export anything.
// The backend enforces the same rule in server/utils/exportPermissions.js.

export function normalizeModuleLabel(moduleLabel) {
  if (!moduleLabel) return moduleLabel;
  return moduleLabel.split(" — ")[0].trim();
}

export function canExportModule(role) {
  return String(role || "").toLowerCase() === "owner";
}