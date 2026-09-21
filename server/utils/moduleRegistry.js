const MODULE_REGISTRY = [
  { name: "Flock Profile", group: "records" },
  { name: "Egg Record", group: "records" },
  { name: "Health Record", group: "records" },
  { name: "Mortality Record", group: "records" },
  { name: "Quarantine & Isolation", group: "records" },
  { name: "Manure & Waste Record", group: "records" },
  { name: "Feed Inventory", group: "inventory" },
  { name: "Feed Consumption", group: "inventory" },
  { name: "Equipment & Tools", group: "inventory" },
  { name: "Sales Record", group: "financial" },
  { name: "Expense Record", group: "financial" },
  { name: "Personnel", group: "personnel" },
  { name: "Visitor's Log", group: "personnel" },
  { name: "User & Roles", group: "ownerOnly" },
  { name: "Archive", group: "ownerOnly" },
  { name: "Audit Logs", group: "ownerOnly" },
];

function canUseCategory(category, role) {
  if (!category) return true;
  const found = MODULE_REGISTRY.find((m) => m.name === category);
  if (!found) return false;
  if (found.group === "records" || found.group === "inventory") return true;
  if (found.group === "financial") return role === "Owner";
  if (found.group === "personnel") return role === "Owner";
  if (found.group === "ownerOnly") return role === "Owner";
  return false;
}

module.exports = { MODULE_REGISTRY, canUseCategory };