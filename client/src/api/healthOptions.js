import { apiGet } from "./client";

const PATH = "/api/v1/health-options";

export const listHealthOptions = (category) =>
  apiGet(PATH, category ? { category } : undefined);