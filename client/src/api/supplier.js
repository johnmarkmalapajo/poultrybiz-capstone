import { apiGet, apiPost } from "./client";

const PATH = "/api/v1/supplier";

export const listSuppliers = () => apiGet(PATH);
export const createSupplier = (name) => apiPost(PATH, { name });