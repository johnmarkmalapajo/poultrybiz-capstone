import { apiPost } from "./client";

const PATH = "/api/v1/reports";

// Fire-and-forget — never blocks the actual download over a logging
// failure (see ExportMenu.jsx).
export const logReportExport = (payload) => apiPost(`${PATH}/log-export`, payload);