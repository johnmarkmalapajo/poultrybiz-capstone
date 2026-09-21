import { apiGet, apiPost } from "./client";

const PATH = "/api/v1/breed";

export const listBreeds = () => apiGet(PATH);
export const createBreed = (name) => apiPost(PATH, { name });