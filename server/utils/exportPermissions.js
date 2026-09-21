const FARMER_EXPORTABLE_MODULES = [
  "Flock Profile",
  "Egg Record",
  "Health Record",
  "Mortality Record",
  "Quarantine & Isolation",
  "Manure & Waste",
  "Feed Inventory",
  "Feed Consumption",
  "Equipment & Tools",
];

function normalizeModuleLabel(moduleLabel) {
  if (!moduleLabel) return moduleLabel;
  return String(moduleLabel).split(" — ")[0].trim();
}

function canExportModule(role, moduleLabel) {
  if (role === "Owner") return true;
  if (role === "Farmer") {
    return FARMER_EXPORTABLE_MODULES.includes(normalizeModuleLabel(moduleLabel));
  }
  return false;
}

module.exports = { canExportModule, normalizeModuleLabel, FARMER_EXPORTABLE_MODULES };