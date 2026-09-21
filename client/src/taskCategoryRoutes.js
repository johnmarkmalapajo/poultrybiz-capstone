// taskCategoryRoutes.js — Task Category Redirection (Personnel Task
// Management redesign). Maps a PersonnelTask's `module`/`type` field to
// the related module's route, so clicking View on a task row opens that
// module directly instead of just staying on the To-Do page.
//
// The canonical name -> route mapping now lives in moduleRegistry.js
// (single source of truth, shared with the ToDo Category dropdown).
// This file adds LEGACY ALIASES for the older, shorter category names
// used before that registry existed, so tasks created earlier still
// resolve to the right module.

import { getModuleRoute } from "./moduleRegistry";

const LEGACY_ALIASES = {
  "Health": "Health Record",
  "Mortality": "Mortality Record",
  "Quarantine": "Quarantine & Isolation",
  "Isolation": "Quarantine & Isolation",
  "Manure": "Manure & Waste Record",
  "Waste": "Manure & Waste Record",
  "Sales": "Sales Record",
  "Expenses": "Expense Record",
  "Equipment": "Equipment & Tools",
  "Visitors": "Visitor's Log",
};

// Returns the route for a task's category, or null if the task has no
// recognized module category (e.g. a plain personal reminder) — callers
// should hide/disable the View-related-module action in that case.
export function getTaskCategoryRoute(category) {
  if (!category) return null;
  return getModuleRoute(category) || getModuleRoute(LEGACY_ALIASES[category]) || null;
}