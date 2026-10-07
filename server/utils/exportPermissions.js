// Role-Based Export Permission System — Export is Owner-only across
// every module. Farmers (and any other role) cannot export anything.
// Mirrors client/src/exportPermissions.js.

function normalizeModuleLabel(moduleLabel) {
  if (!moduleLabel) return moduleLabel;
  return String(moduleLabel).split(" — ")[0].trim();
}

function canExportModule(role) {
  return String(role || "").toLowerCase() === "owner";
}

module.exports = { canExportModule, normalizeModuleLabel };