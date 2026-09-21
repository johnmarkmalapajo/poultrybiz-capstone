import { apiGet, apiPost } from "./client";

const PATH = "/api/v1/customers";

export const listCustomers = () => apiGet(PATH);
export const createCustomer = (payload) => apiPost(PATH, payload);