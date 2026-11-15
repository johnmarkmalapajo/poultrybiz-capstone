import { apiGet, apiPost } from "./client";

const PATH = "/api/v1/health-options";

export const listHealthOptions = (category) =>
  apiGet(PATH, category ? { category } : undefined);
// Adds one option (only categories the server allows, e.g. "equipmentLocation").
export const createHealthOption = (category, value) =>
  apiPost(PATH, { category, value });