// api/dashboard.js — Dashboard stat cards + charts.
// Endpoint matches what Dashboard.jsx already called before this migration
// (`/dashboard`) — it was never backed by a real server, only by the
// now-removed mock layer, so treat this as a NEW integration point.
//
// Expected response shape (based on what the Dashboard UI renders — confirm
// and adjust with the backend dev):
//   {
//     flock:      { currentFlockSize, productiveRate, mortalityRate, mortalityToday },
//     eggs:       { totalEggsToday, sizeDistribution, dailyTrend },
//     financials: { salesRevenue, totalExpenses, netProfitLoss },   // Admin only
//     feed:       { feedStockKg, feedConsumedToday, feedLowStock, feedCriticalStock },
//     health:     { sickChickens, underTreatment, vaccinationDue },
//     equipment:  { operationalEquipment, maintenanceDueEquipment },
//   }
// The backend is expected to return only the fields the caller's role may
// see (e.g. omit `financials` for a Farmer) rather than the frontend
// filtering a full payload — see the Role Access section of the spec.
import { apiGet } from "./client";

export const getDashboardSummary = (params) => apiGet("/api/v1/dashboard", params);
