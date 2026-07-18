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
const write = (k, a) => { try { localStorage.setItem(k, JSON.stringify(a)); } catch { /* ignore */ } try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ } };
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
// Every field list below matches the ACTUAL field names each Add-record form
// saves (see AddMortalityRecord.jsx, AddHealthRecord.jsx, AddFeedInventory.jsx,
// etc.) — plus a couple of generic fallbacks in case those forms change.
const recDate = (r) =>
  String(r.date || r.collectionDate || r.saleDate || r.expenseDate || r.dateRecorded || r.recordedAt || r.createdAt || "").slice(0, 10);
const recTime = (r) => {
  const raw = r.createdAt || r.time || "";
  const d = raw ? new Date(raw) : null;
  return d && !isNaN(d) ? d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", hour12: true }) : "";
};
const recCage = (r) => r.cageId || r.cage || r.cageNumber || "Unassigned";
const todayStr = () => new Date().toISOString().slice(0, 10);
const isToday = (r) => recDate(r) === todayStr();
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

// ---- Auto-generated ALERTS + REMINDERS, derived directly from the same
// stored records that feed the Dashboard's stat cards (no separate/duplicate
// data entry, no hardcoded numbers). Every condition below carries a STABLE
// id, so re-running this on every recompute:
//   - won't duplicate an item that's already showing,
//   - preserves whatever read/unread state the user already gave it,
//   - automatically clears itself once the underlying condition resolves.
// Per-batch/per-record items follow the Farmer alert format required by the
// spec: they always name the Batch ID + Cage Number, and category is set so
// Notifications.jsx / notifStore's Farmer allow-list hides admin-only ones
// (sales, expenses, personnel, visitors, users, audit, archive) from Farmers.
function buildAutoNotifications() {
  const batches    = read("pb_batches");
  const mortality  = read("pb_mortality");
  const health     = read("pb_health");
  const eggs       = read("pb_eggs");
  const isolation  = read("pb_isolation");
  const feed       = read("pb_feed_inventory");
  const feedUsed   = read("pb_feed_consumption");
  const equipment  = read("pb_equipment");
  const sales      = read("pb_sales");
  const expenses   = read("pb_expenses");
  const users      = read("pb_users");

  const today = todayStr();
  const items = []; // { id, type: 'alert'|'reminder', category, priority, title, description }

  const activeBatches = batches.filter((b) => !b.status || /^active$/i.test(String(b.status)));

  /* Mortality: high mortality per batch (today's deaths >= 5% of that
     batch's remaining population), formatted with Batch ID + Cage. */
  const batchQty = {};
  activeBatches.forEach((b) => {
    batchQty[b.batchId] = Number(b.quantity ?? b.numberOfBirds ?? b.quantityPurchased ?? b.initialQuantity ?? 0);
  });
  const mortByBatchToday = {};
  mortality.filter(isToday).forEach((r) => {
    const key = r.batchId || "—";
    mortByBatchToday[key] = mortByBatchToday[key] || { count: 0, cage: recCage(r), rec: r };
    mortByBatchToday[key].count += Number(r.numberOfMortality) || 0;
  });
  Object.entries(mortByBatchToday).forEach(([batchId, { count, cage, rec }]) => {
    const qty = batchQty[batchId] || 0;
    const rate = qty ? (count / qty) * 100 : 0;
    if (rate >= 5 || count >= 5) {
      items.push({
        id: `auto_mort_${batchId}_${today}`,
        type: "alert", category: "mortality",
        priority: rate >= 10 || count >= 10 ? "high" : "medium",
        title: "High Mortality Detected",
        description: `High mortality detected in Batch ${batchId} (Cage ${cage}). ${count} bird(s) recorded today, ${today} at ${recTime(rec) || "—"}.`,
      });
    }
  });

  /* Feed: critically low / low stock, using the SAME fields the Feed
     Inventory / Feed Consumption forms actually save. */
  const feedIn  = sumBy(feed, ["quantityIn", "quantity", "kg", "stockKg", "remainingKg", "currentStock"]);
  const feedOutAll = sumBy(feed, ["quantityOut"]) + sumBy(feedUsed, ["quantityConsumed", "quantity", "kg", "amountKg", "consumedKg"]);
  const feedStockKg = Math.max(0, +(feedIn - feedOutAll).toFixed(2));
  const CRITICAL_STOCK = 50, LOW_STOCK = 100;
  if (feedStockKg < LOW_STOCK) {
    const lastFeedRec = [...feedUsed].sort((a, b) => recDate(b).localeCompare(recDate(a)))[0];
    const batchId = lastFeedRec?.batchId || "—";
    const cage = lastFeedRec ? recCage(lastFeedRec) : "Unassigned";
    items.push({
      id: "auto_feed_low",
      type: "alert", category: "feed",
      priority: feedStockKg < CRITICAL_STOCK ? "high" : "medium",
      title: feedStockKg < CRITICAL_STOCK ? "Critical Feed Inventory" : "Low Feed Stock",
      description: `Feed stock is ${feedStockKg < CRITICAL_STOCK ? "critically low" : "running low"} for Batch ${batchId} (Cage ${cage}). ${feedStockKg}kg remaining as of ${today}.`,
    });
  }

  /* Health: sick / disease-flagged birds (per batch + cage). */
  const isSickRec = (r) => /sick|disease|ill/i.test(r.disease || r.diagnosis || r.symptomsObserved || "") && r.recordType !== "Vaccination";
  health.filter(isSickRec).filter(isToday).forEach((r) => {
    items.push({
      id: `auto_health_${r._id || r.batchId + "_" + recDate(r)}`,
      type: "alert", category: "health",
      priority: "high",
      title: "Disease Detected",
      description: `Health issue detected in Batch ${r.batchId || "—"} (Cage ${recCage(r)}): ${r.disease || r.diagnosis || "symptoms observed"}. Reported ${recDate(r)} at ${recTime(r) || "—"}.`,
    });
  });

  /* Health: vaccination due today (or overdue), from nextSchedule. */
  health.filter((r) => (r.recordType === "Vaccination" || r.vaccineOrDrug) && r.nextSchedule).forEach((r) => {
    if (r.nextSchedule <= today) {
      items.push({
        id: `auto_vax_${r._id || r.batchId + "_" + r.nextSchedule}`,
        type: "reminder", category: "health",
        priority: "low",
        title: r.nextSchedule < today ? "Vaccination Overdue" : "Vaccination Due Today",
        description: `Vaccination due for Batch ${r.batchId || "—"} (Cage ${recCage(r)}) on ${r.nextSchedule}.`,
      });
    }
  });

  /* Egg production: batch hasn't logged an egg record today. */
  const batchesLoggedToday = new Set(eggs.filter(isToday).map((r) => r.batchId));
  activeBatches.forEach((b) => {
    if (b.batchId && !batchesLoggedToday.has(b.batchId)) {
      items.push({
        id: `auto_egg_missing_${b.batchId}_${today}`,
        type: "alert", category: "egg",
        priority: "medium",
        title: "Egg Production Not Recorded",
        description: `Egg production has not been recorded today for Batch ${b.batchId} (Cage ${b.cageId || b.cage || "Unassigned"}). ${today}.`,
      });
    }
  });

  /* Quarantine/Isolation: completed and ready for release. */
  isolation.filter((r) => r.recordType !== "Isolation" && r.status === "Ongoing" && r.releasedDate && r.releasedDate <= today).forEach((r) => {
    items.push({
      id: `auto_quarantine_${r._id || r.batchId}`,
      type: "reminder", category: "quarantine",
      priority: "low",
      title: "Quarantine Complete",
      description: `Batch ${r.batchId || "—"} (Cage ${recCage(r)}) quarantine period is complete and ready for release as of ${r.releasedDate}.`,
    });
  });

  /* Equipment: maintenance due (Poor condition = needs attention now). */
  equipment.filter((eq) => eq.condition === "Poor").forEach((eq) => {
    items.push({
      id: `auto_equipment_${eq._id || eq.name}`,
      type: "reminder", category: "equipment",
      priority: "medium",
      title: "Equipment Maintenance Due",
      description: `${eq.name || "Equipment"} at ${eq.location || "the farm"} is in Poor condition and needs maintenance.`,
    });
  });

  /* Admin-only: financial + account-approval alerts (never shown to a
     Farmer — their category isn't in notifStore's FARMER_ALLOWED list). */
  const salesRevenue  = sumBy(sales, ["totalAmount", "amount", "total", "revenue", "grandTotal"]);
  const totalExpenses = sumBy(expenses, ["amount", "totalAmount", "cost", "total"]);
  const netProfitLoss = salesRevenue - totalExpenses;
  if (netProfitLoss < 0 && (sales.length || expenses.length)) {
    items.push({
      id: "auto_net_loss",
      type: "alert", category: "sales",
      priority: "high",
      title: "Net Loss Detected",
      description: `Recorded transactions currently show a net loss of ₱${Math.abs(netProfitLoss).toFixed(2)}.`,
    });
  }
  const pendingUsers = users.filter((u) => u.status === "Pending").length;
  if (pendingUsers > 0) {
    items.push({
      id: "auto_pending_users",
      type: "alert", category: "users",
      priority: "medium",
      title: "Pending Farmer Approval",
      description: pendingUsers === 1
        ? "A new Farmer account is waiting for admin approval."
        : `${pendingUsers} new Farmer accounts are waiting for admin approval.`,
    });
  }

  return items;
}

// Reconciles the freshly-computed auto_* items against what's already stored,
// so read/unread state and original timestamps are preserved for anything
// still active, stale ones disappear, and genuinely new ones are appended.
function syncAutoNotifications() {
  const items = buildAutoNotifications();
  const activeIds = new Set(items.map((c) => c.id));
  const now = Date.now();
  let changed = false;

  let next = read("pb_notifications").filter((n) => {
    if (String(n.id).startsWith("auto_") && !activeIds.has(n.id)) { changed = true; return false; }
    return true;
  });

  const existingIds = new Set(next.map((n) => n.id));
  items.forEach((c) => {
    if (!existingIds.has(c.id)) {
      next = [{ read: false, dateTime: now, ...c }, ...next];
      changed = true;
    }
  });

  if (changed) {
    write("pb_notifications", next);
    // notifStore.js listens for its own event name (used by the Sidebar
    // badge and the Dashboard's Alert card) — fire it too so they refresh
    // immediately instead of waiting for the next focus/storage event.
    try { window.dispatchEvent(new Event("pb_notifs_changed")); } catch { /* ignore */ }
  }
}

function computeDashboard() {
  const batches    = read("pb_batches");
  const mortality  = read("pb_mortality");
  const health     = read("pb_health");
  const eggs       = read("pb_eggs");
  const sales      = read("pb_sales");
  const expenses   = read("pb_expenses");
  const feed       = read("pb_feed_inventory");
  const feedUsed   = read("pb_feed_consumption");
  const equipment  = read("pb_equipment");

  // Current Flock Size ← Flock Profile: ACTIVE flocks only (archived flocks are
  // already removed from the store; non-active statuses are excluded here).
  const activeBatches = batches.filter((b) => !b.status || /^active$/i.test(String(b.status)));
  const totalBirds = sumBy(activeBatches, ["quantity", "numberOfBirds", "birds", "initialQuantity", "count", "quantityPurchased"]);
  const totalDead  = sumBy(mortality, ["numberOfMortality", "mortality", "count", "quantity", "birds", "deaths"]);
  const currentFlockSize = Math.max(0, totalBirds - totalDead);
  // Mortality stats ← Mortality Records vs flock population
  const mortalityRate  = totalBirds ? +((totalDead / totalBirds) * 100).toFixed(2) : 0;
  const mortalityToday = sumBy(mortality.filter(isToday), ["numberOfMortality", "mortality", "count", "quantity"]);

  // Total Eggs Today ← Egg Records dated TODAY only
  const today = todayStr();
  const eggFields = ["currentQuantity", "totalEggs", "quantity", "eggs", "totalCollected"];
  const eggsToday = sumBy(eggs.filter(isToday), eggFields);
  // Entire Flock Productive Rate (%) = (Total Eggs Today ÷ Current Flock Size) × 100
  const productiveRate = currentFlockSize ? +((eggsToday / currentFlockSize) * 100).toFixed(2) : 0;

  const sizeKeys = { large: "large", extraLarge: "extraLarge", medium: "medium", jumbo: "jumbo", small: "small", peewee: "peewee", crack: "crackedEggs" };
  const sizeDistribution = {};
  Object.entries(sizeKeys).forEach(([k, field]) => { sizeDistribution[k] = sumBy(eggs, [field]); });

  const byDate = {};
  eggs.forEach((r) => { const d = recDate(r); if (d) byDate[d] = (byDate[d] || 0) + sumBy([r], eggFields); });
  const dailyTrend = Object.keys(byDate).sort().slice(-90).map((d) => ({ date: d, eggs: byDate[d], total: byDate[d] }));

  const salesRevenue  = sumBy(sales, ["totalAmount", "amount", "total", "revenue", "grandTotal"]);
  const totalExpenses = sumBy(expenses, ["amount", "totalAmount", "cost", "total"]);
  const netProfitLoss = salesRevenue - totalExpenses;

  // Feed Stats ← Feed Inventory (quantityIn/quantityOut) net of Feed Consumption
  const feedIn  = sumBy(feed, ["quantityIn", "quantity", "kg", "stockKg", "remainingKg", "currentStock"]);
  const feedOutAll = sumBy(feed, ["quantityOut"]) + sumBy(feedUsed, ["quantityConsumed", "quantity", "kg", "amountKg", "consumedKg"]);
  const feedStockKg = Math.max(0, +(feedIn - feedOutAll).toFixed(2));
  const feedConsumedToday = sumBy(feedUsed.filter(isToday), ["quantityConsumed", "quantity", "kg"]);
  const feedLowStock = feedStockKg < 100;
  const feedCriticalStock = feedStockKg < 50;

  // Health Stats ← Health Records
  const isSickRec = (r) => /sick|disease|ill/i.test(r.disease || r.diagnosis || r.symptomsObserved || "") && r.recordType !== "Vaccination";
  const isUnderTreatment = (r) => r.recordType === "Veterinary Treatment" || r.treatmentApplied;
  const sickChickens   = sumBy(health.filter(isSickRec), ["numberOfBirdsAffected", "numberMortality"]) || health.filter(isSickRec).length;
  const underTreatment = health.filter(isUnderTreatment).length;
  const vaccinationDue = health.filter((r) => (r.recordType === "Vaccination" || r.vaccineOrDrug) && r.nextSchedule && r.nextSchedule <= today).length;

  // Equipment Stats ← Equipment & Tools Record (no maintenance-date field in
  // the current form, so "Poor" condition is used as the maintenance signal)
  const operationalEquipment  = equipment.filter((eq) => eq.condition !== "Poor").length;
  const maintenanceDueEquipment = equipment.filter((eq) => eq.condition === "Poor").length;

  // Keep pb_notifications in sync with the records we just read, BEFORE
  // reading it back for the alerts list below.
  syncAutoNotifications();

  // Recent unread ALERT notifications → Dashboard Alert card (role filtering
  // happens in the Dashboard itself via notifStore's role-aware getters).
  const alerts = read("pb_notifications")
    .filter((n) => n.type === "alert" && !n.read)
    .sort((a, b) => new Date(b.dateTime || 0) - new Date(a.dateTime || 0))
    .slice(0, 10)
    .map((n) => ({
      type: n.priority === "high" ? "danger" : "warning",
      message: n.title,
      category: n.category,
    }));

  return {
    flock: { currentFlockSize, productiveRate, mortalityRate, mortalityToday },
    eggs:  { totalEggsToday: eggsToday, sizeDistribution, dailyTrend },
    financials: { salesRevenue, totalExpenses, netProfitLoss },
    feed: { feedStockKg, feedConsumedToday, feedLowStock, feedCriticalStock },
    health: { sickChickens, underTreatment, vaccinationDue },
    equipment: { operationalEquipment, maintenanceDueEquipment },
    feedStockKg, // kept for backward compatibility with older callers
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