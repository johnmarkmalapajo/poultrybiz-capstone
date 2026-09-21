import { apiGet } from "./client";

const PATH = "/api/v1/dependencies";

// type is one of: "user", "personnel", "flock" (see server/controllers/dependencyController.js)
export const checkDependencies = (type, id) => apiGet(`${PATH}/${type}/${id}`);

// moduleKey -> dependency-checker "type". Only modules with a registered
// backend checker are listed here — everything else safely skips the
// preview step (see Archive.jsx).
export const DEPENDENCY_TYPE_BY_MODULE_KEY = {
  users: "user",
  pb_personnel: "personnel",
  pb_batches: "flock",
};
