import { apiPost } from "./client";

export const logout = () => apiPost("/api/v1/auth/logout");