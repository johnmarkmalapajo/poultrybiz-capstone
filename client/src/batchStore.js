// batchStore.js — PoultryBiz front-end data store (localStorage)
// One source of truth per module, all keyed by batchId. The QR Batch Summary
// reads from here, so it always reflects the LATEST data across modules.
//
// Place this at: src/batchStore.js   (or src/utils/batchStore.js — adjust imports)

const K = {
  batches:         "pb_batches",
  eggs:            "pb_eggs",
  mortality:       "pb_mortality",
  health:          "pb_health",
  isolation:       "pb_isolation",
  feedConsumption: "pb_feed_consumption",
  feedInventory:   "pb_feed_inventory",
  vaccination:     "pb_vaccination",
};

const read  = (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } try { window.dispatchEvent(new Event("pb_data_changed")); } catch { /* ignore */ } };
const today = () => new Date().toISOString().slice(0, 10);

/* ─────────────────────────────────────────────
   ONE-TIME CLEANUP — wipes the old demo/seed data
   that was saved before seeding was removed. Runs
   ONCE (gated by pb_flock_reset_v1), so the flock
   pages start empty and the user inputs their own.
   After this, the user's real records persist normally.
────────────────────────────────────────────── */
(function cleanupOldDemoData() {
  try {
    if (typeof localStorage === "undefined") return;
    if (localStorage.getItem("pb_flock_reset_v1")) return;
    [
      "pb_batches", "pb_eggs", "pb_mortality", "pb_health", "pb_isolation",
      "pb_feed_consumption", "pb_feed_inventory", "pb_vaccination", "pb_seeded_v1",
    ].forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("pb_flock_reset_v1", "1");
  } catch { /* ignore */ }
})();

/* ─────────────────────────────────────────────
   DEMO SEED (runs once) — so the summary shows
   realistic live-looking data immediately.
   Delete pb_seeded_v1 in localStorage to re-seed.
────────────────────────────────────────────── */
function seed() {
  // No demo/mock data — the user inputs their own flock records.
  // (To re-enable sample data later, restore the write(...) calls here.)
}

const ageWeeks = (dateStr) => {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start)) return null;
  const w = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return 16 + w; // birds arrive at 16 weeks
};

export const batchStore = {
  keys: K,
  seed,

  /* ---- getters ---- */
  getBatches() { seed(); return read(K.batches); },
  getBatch(id) { return this.getBatches().find((b) => b.batchId === id) || null; },

  /* ---- write helpers (call these from each Add module to keep the QR live) ----
     e.g. batchStore.addEgg({ batchId:"F-001", date:"2026-07-05", quantity:41 }) */
  addBatch(rec)        { const a = read(K.batches);         a.push(rec); write(K.batches, a); },
  updateBatch(id, updates) {
    const a = read(K.batches);
    const i = a.findIndex((b) => b.batchId === id || b._id === id);
    if (i !== -1) { a[i] = { ...a[i], ...updates }; write(K.batches, a); }
    return i !== -1;
  },
  deleteBatch(id) {
    const a = read(K.batches).filter((b) => b.batchId !== id && b._id !== id);
    write(K.batches, a);
  },
  addEgg(rec)          { const a = read(K.eggs);            a.push(rec); write(K.eggs, a); },
  addMortality(rec)    { const a = read(K.mortality);       a.push(rec); write(K.mortality, a); },
  addHealth(rec)       { const a = read(K.health);          a.push(rec); write(K.health, a); },
  addIsolation(rec)    { const a = read(K.isolation);       a.push(rec); write(K.isolation, a); },
  addFeedConsumption(rec) { const a = read(K.feedConsumption); a.push(rec); write(K.feedConsumption, a); },
  setFeedInventory(arr){ write(K.feedInventory, arr); },
  addVaccination(rec)  { const a = read(K.vaccination);     a.push(rec); write(K.vaccination, a); },

  /* ---- LIVE aggregation for one batch ---- */
  getSummary(batchId) {
    seed();
    const batch = read(K.batches).find((b) => b.batchId === batchId) || null;
    const eggs  = read(K.eggs).filter((e) => e.batchId === batchId);
    const mort  = read(K.mortality).filter((m) => m.batchId === batchId);
    const health= read(K.health).filter((h) => h.batchId === batchId);
    const iso   = read(K.isolation).filter((i) => i.batchId === batchId);
    const feed  = read(K.feedConsumption).filter((f) => f.batchId === batchId);
    const vac   = read(K.vaccination).filter((v) => v.batchId === batchId);
    const feedInv = read(K.feedInventory);

    const purchased = Number(batch?.quantityPurchased) || 0;
    const totalMortality = mort.reduce((s, m) => s + (Number(m.count) || 0), 0);
    const currentQty = Math.max(0, purchased - totalMortality);
    const mortalityRate = purchased ? (totalMortality / purchased) * 100 : 0;

    const totalEggs = eggs.reduce((s, e) => s + (Number(e.quantity) || 0), 0);
    const eggsToday = eggs.filter((e) => e.date === today()).reduce((s, e) => s + (Number(e.quantity) || 0), 0);
    const eggDays = new Set(eggs.map((e) => e.date)).size;
    const avgDaily = eggDays ? totalEggs / eggDays : 0;

    const isoBirds  = iso.reduce((s, i) => s + (Number(i.birds) || 0), 0);
    const sickBirds = health.filter((h) => /sick/i.test(h.status || "")).reduce((s, h) => s + (Number(h.birds) || 0), 0);
    const liveBirds = Math.max(0, currentQty - isoBirds);
    const productionRate = liveBirds ? (eggsToday / liveBirds) * 100 : 0;

    // cage status C-01 … C-12
    const cages = [];
    for (let n = 1; n <= 12; n++) {
      const id = "C-" + String(n).padStart(2, "0");
      let status = "Healthy";
      if (iso.some((i) => i.cage === id)) status = "Isolation";
      else if (health.some((h) => h.cage === id && /sick/i.test(h.status || ""))) status = "Sick";
      cages.push({ cage: id, status });
    }

    const feedType = batch?.feedType || feed[0]?.feedType || "—";
    const feedToday = feed.filter((f) => f.date === today()).reduce((s, f) => s + (Number(f.kg) || 0), 0);
    const remainingFeed = feedInv.find((fi) => fi.feedType === feedType)?.remainingKg ?? null;
    const lastVac = vac[vac.length - 1] || null;

    return {
      found: !!batch,
      batch,
      ageWeeks: ageWeeks(batch?.dateAcquired),
      purchased, currentQty, totalMortality, mortalityRate,
      totalEggs, eggsToday, avgDaily, productionRate,
      isoBirds, sickBirds, liveBirds,
      isolation: iso, sick: health.filter((h) => /sick/i.test(h.status || "")),
      cages,
      feedType, feedToday, remainingFeed,
      vaccination: lastVac,
    };
  },
};

export default batchStore;
