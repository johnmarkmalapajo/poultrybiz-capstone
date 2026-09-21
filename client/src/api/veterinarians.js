import { apiGet } from "./client";

const PATH = "/api/v1/veterinarians";

export const listVeterinarians = () => apiGet(PATH);