export const MODULE_REGISTRY = [
  { name: "Flock Profile", group: "records", route: "/records/flock" },
  { name: "Egg Record", group: "records", route: "/records/egg" },
  { name: "Health Record", group: "records", route: "/records/health" },
  { name: "Mortality Record", group: "records", route: "/records/mortality" },
  { name: "Quarantine & Isolation", group: "records", route: "/records/quarantine" },
  { name: "Manure & Waste Record", group: "records", route: "/records/manure" },
  { name: "Feed Inventory", group: "inventory", route: "/inventory/feed-inventory" },
  { name: "Feed Consumption", group: "inventory", route: "/inventory/feed-consumption" },
  { name: "Equipment & Tools", group: "inventory", route: "/inventory/equipment" },
  { name: "Sales Record", group: "financial", route: "/sales-transactions/sales" },
  { name: "Expense Record", group: "financial", route: "/sales-transactions/expenses" },
  { name: "Personnel", group: "personnel", route: "/personnel-visitors/personnel" },
  { name: "Visitor's Log", group: "personnel", route: "/personnel-visitors/visitors" },
  { name: "User & Roles", group: "ownerOnly", route: "/users-roles" },
  { name: "Archive", group: "ownerOnly", route: "/settings/archive" },
  { name: "Audit Logs", group: "ownerOnly", route: "/audit-logs" },
];

export function getAccessibleCategories({ isOwner, canSeeFinancials, canViewPersonnel }) {
  return MODULE_REGISTRY.filter((m) => {
    if (m.group === "records" || m.group === "inventory") return true;
    if (m.group === "financial") return !!canSeeFinancials;
    if (m.group === "personnel") return !!canViewPersonnel;
    if (m.group === "ownerOnly") return !!isOwner;
    return false;
  }).map((m) => m.name);
}

export function getModuleRoute(name) {
  if (!name) return null;
  const found = MODULE_REGISTRY.find((m) => m.name === name);
  return found ? found.route : null;
}

export function canAccessCategory(name, { isOwner, canSeeFinancials, canViewPersonnel }) {
  const found = MODULE_REGISTRY.find((m) => m.name === name);
  if (!found) return false;
  if (found.group === "records" || found.group === "inventory") return true;
  if (found.group === "financial") return !!canSeeFinancials;
  if (found.group === "personnel") return !!canViewPersonnel;
  if (found.group === "ownerOnly") return !!isOwner;
  return false;
}