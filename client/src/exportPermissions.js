export const FARMER_EXPORTABLE_MODULES = [
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

export function normalizeModuleLabel(moduleLabel) {
  if (!moduleLabel) return moduleLabel;
  return moduleLabel.split(" — ")[0].trim();
}

export function canExportModule(role, moduleLabel) {
  if (role === "Owner") return true;
  if (role === "Farmer") {
    return FARMER_EXPORTABLE_MODULES.includes(normalizeModuleLabel(moduleLabel));
  }
  return false;
}