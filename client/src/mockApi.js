// mockApi.js — FRONTEND-ONLY mock backend (no server needed).
// Intercepts every fetch() to "/api/..." and serves it from localStorage,
// so Add/Edit/Delete on ALL pages persist and show up in the tables.
//
// USE: at the VERY TOP of src/main.jsx (before rendering), add:
//     import "./mockApi";
//
// That's it — no other page needs editing. Data persists across refreshes.
// To wipe everything: clear the site's localStorage in DevTools.

const RESOURCE_KEYS = {
  "egg-records": "pb_eggs",
  "mortality-records": "pb_mortality",
  "health-records": "pb_health",
  "diagnosis-records": "pb_health",
  "treatment-records": "pb_treatment",
  "vaccination-records": "pb_vaccination",
  "flocks": "pb_batches",
  "flock-profiles": "pb_batches",
  "visitors": "pb_visitors",
  "personnel": "pb_personnel",
  "feed-inventory": "pb_feed_inventory",
  "feed-consumption": "pb_feed_consumption",
  "sales": "pb_sales",
  "sales-records": "pb_sales",
  "expenses": "pb_expenses",
  "expense-records": "pb_expenses",
  "quarantine": "pb_quarantine",
  "isolation": "pb_isolation",
  "quarantine-isolation": "pb_isolation",
  "quarantine-records": "pb_isolation",
  "waste": "pb_waste",
  "waste-records": "pb_waste",
  "manure-records": "pb_waste",
  "equipment": "pb_equipment",
};
const keyFor = (r) => RESOURCE_KEYS[r] || "pb_" + r.replace(/-/g, "_");

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore / } try { window.dispatchEvent(new Event("pb_data_changed")); } catch { / ignore */ } };
const uid = () => "rec_" + Date.now() + "_" + Math.floor(Math.random() * 99999);

// Ensure flock batches exist so "Add" dropdowns aren't empty.
function ensureFlocks() {
  // No demo/mock flocks — the user inputs their own records.
  return;
}

function summary(resource, list) {
  const n = list.length;
  if (resource === "egg-records") {
    const sum = (f) => list.reduce((s, r) => s + (Number(r[f]) || 0), 0);
    const total = sum("totalEggs") || sum("quantity") || sum("eggs") || sum("totalCollected");
    const marketable = sum("marketableEggs") || sum("marketable") || sum("sellable");
    const cracked = sum("crackedEggs") || sum("cracked") || sum("damaged") || sum("rejects");
    return { totalEggs: total, marketableEggs: marketable, crackedEggs: cracked, avgDailyEggs: n ? Math.round(total / n) : 0, count: n };
  }
  if (resource === "mortality-records") {
    const total = list.reduce((s, r) => s + (Number(r.count) || Number(r.quantity) || Number(r.mortality) || 0), 0);
    return { totalMortality: total, count: n };
  }
  return { count: n };
}

// GET list → return an ARRAY that ALSO carries .records/.data/.summary/.success,
// so it satisfies every parsing style pages use:
//   Array.isArray(d) ? d : d.records || d.data || []
function listPayload(resource) {
  const list = read(keyFor(resource));
  const arr = list.slice();
  arr.records = list;
  arr.data = list;
  arr.results = list;
  arr.summary = summary(resource, list);
  arr.success = true;
  arr.total = list.length;
  return arr;
}

// ---- Dashboard: compute live stats from the stored records (shared state) ----
const recDate = (r) =>
  String(r.date || r.collectionDate || r.saleDate || r.expenseDate || r.dateRecorded || r.recordedAt || r.createdAt || "").slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);
function sumBy(list, fields) {
  return list.reduce((s, r) => {
    for (const f of fields) {
      if (r[f] != null && r[f] !== "") {
        const v = Number(r[f]);
        if (!Number.isNaN(v)) return s + v;
      }
    }
    return s;
  }, 0);
}
function computeDashboard() {
  const batches   = read("pb_batches");
  const mortality = read("pb_mortality");
  const eggs      = read("pb_eggs");
  const sales     = read("pb_sales");
  const expenses  = read("pb_expenses");
  const feed      = read("pb_feed_inventory");
  const feedUsed  = read("pb_feed_consumption");

  // Current Flock Size ← Flock Profile: ACTIVE flocks only (archived flocks are
  // already removed from the store; non-active statuses are excluded here).
  const activeBatches = batches.filter((b) => !b.status || /^active$/i.test(String(b.status)));
  const totalBirds = sumBy(activeBatches, ["quantity", "numberOfBirds", "birds", "initialQuantity", "count"]);
  const totalDead  = sumBy(mortality, ["mortality", "count", "quantity", "birds", "deaths"]);
  const currentFlockSize = Math.max(0, totalBirds - totalDead);
  // Mortality Rate (%) ← Mortality Records vs flock population
  const mortalityRate = totalBirds ? +((totalDead / totalBirds) * 100).toFixed(2) : 0;

  // Total Eggs Today ← Egg Records dated TODAY only
  const today = todayStr();
  const eggFields = ["totalEggs", "quantity", "eggs", "totalCollected"];
  const eggsToday = sumBy(eggs.filter((r) => recDate(r) === today), eggFields);
  // Entire Flock Productive Rate (%) = (Total Eggs Today ÷ Current Flock Size) × 100
  // Two decimal places; 0 when flock size is zero (no division-by-zero).
  const productiveRate = currentFlockSize ? +((eggsToday / currentFlockSize) * 100).toFixed(2) : 0;

  const byDate = {};
  eggs.forEach((r) => { const d = recDate(r); if (d) byDate[d] = (byDate[d] || 0) + sumBy([r], eggFields); });
  const dailyTrend = Object.keys(byDate).sort().slice(-7).map((d) => ({ date: d, eggs: byDate[d], total: byDate[d] }));

  const salesRevenue  = sumBy(sales, ["totalAmount", "amount", "total", "revenue", "grandTotal"]);
  const totalExpenses = sumBy(expenses, ["amount", "totalAmount", "cost", "total"]);
  // Feed Stock (kg) ← available balance: Feed Inventory − Feed Consumption
  const feedIn  = sumBy(feed, ["quantity", "kg", "stockKg", "remainingKg", "currentStock"]);
  const feedOut = sumBy(feedUsed, ["quantity", "kg", "amountKg", "consumedKg", "feedConsumed"]);
  const feedStockKg = Math.max(0, +(feedIn - feedOut).toFixed(2));

  // Recent unread ALERT notifications → Dashboard Alert card.
 const alerts = read("pb_notifications")
  .filter((n) => n.type === "alert" && !n.read)
  .sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0))
  .slice(0, 5)
  .map((n) => ({
    type: n.priority === "high" ? "danger" : "warning",
    message: n.title,
    category: n.category,
  }));
  
  return {
    flock:      { currentFlockSize, productiveRate, mortalityRate },
    eggs:       { totalEggsToday: eggsToday, sizeDistribution: {}, dailyTrend },
    financials: { salesRevenue, totalExpenses, netProfitLoss: salesRevenue - totalExpenses },
    feedStockKg,
    tasks:  [],
    alerts,
  };
}

function res(body, ok = true, status = 200) {
  return {
    ok, status, statusText: ok ? "OK" : "Error",
    json: async () => body,
    text: async () => { try { return JSON.stringify(body); } catch { return ""; } },
    headers: { get: () => "application/json" },
    clone() { return this; },
  };
}

const origFetch = typeof window !== "undefined" && window.fetch ? window.fetch.bind(window) : null;

function mockFetch(input, init = {}) {
  const url = typeof input === "string" ? input : (input && input.url) || "";

  // Allow the real backend to handle authentication endpoints
  if (url.includes("/api/v1/auth/")) {
    return origFetch
      ? origFetch(input, init)
      : Promise.reject(new Error("Backend unavailable"));
  }
  const match = url.match(/\/api\/(?:v\d+\/)?([a-z0-9-]+)(?:\/([^/?#]+))?/i);
  if (!match) return origFetch ? origFetch(input, init) : Promise.reject(new Error("network unavailable"));

  const resource = match[1].toLowerCase();
  const id = match[2];
  const method = ((init && init.method) || (typeof input === "object" && input.method) || "GET").toUpperCase();
  const key = keyFor(resource);

  if (resource === "flocks" || resource === "flock-profiles") ensureFlocks();

  // Aggregate/report endpoint (/dashboard) — computed live from stored records,
  // so new Sales/Expenses/Feed/Mortality/Eggs immediately reflect on the Dashboard.
  if (resource === "dashboard") {
    return Promise.resolve(res({ success: true, data: computeDashboard() }));
  }

  let body = init && init.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { /* keep */ } }

  const list = read(key);

  if (method === "GET") {
    if (id) {
      const rec = list.find((r) => String(r._id) === String(id) || String(r.id) === String(id));
      return Promise.resolve(res(rec || null, !!rec, rec ? 200 : 404));
    }
    return Promise.resolve(res(listPayload(resource)));
  }
  if (method === "POST") {
    const rec = { _id: uid(), createdAt: new Date().toISOString(), status: (body && body.status) || "Active", ...(body || {}) };
    list.unshift(rec);
    write(key, list);
    return Promise.resolve(res(rec, true, 201));
  }
  if (method === "PUT" || method === "PATCH") {
    const idx = list.findIndex((r) => String(r._id) === String(id) || String(r.id) === String(id));
    if (idx === -1) return Promise.resolve(res({ message: "Not found" }, false, 404));
    list[idx] = { ...list[idx], ...(body || {}) };
    write(key, list);
    return Promise.resolve(res(list[idx], true, 200));
  }
  if (method === "DELETE") {
    write(key, list.filter((r) => String(r._id) !== String(id) && String(r.id) !== String(id)));
    return Promise.resolve(res({ ok: true, deleted: id }, true, 200));
  }
  return Promise.resolve(res({ message: "Unhandled method" }, false, 400));
}

if (typeof window !== "undefined") {
  window.fetch = mockFetch;
  if (typeof globalThis !== "undefined") globalThis.fetch = mockFetch;
  // eslint-disable-next-line no-console
  console.info("%c[mockApi] frontend-only backend active — data persists in localStorage", "color:#c8930c");
}

export default mockFetch;