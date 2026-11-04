const path = require("path");
const assert = require("assert");
const { EventEmitter } = require("events");
const S = "/home/claude/POULTRYBIZ-CAPSTONE-MAKDOMAK-DASHBOARD-FIXED/server";
const stub = (rel, e) => { const f = path.join(S, rel); require.cache[f] = { id: f, filename: f, loaded: true, exports: e, children: [], paths: [] }; };

const guard = new Map();
stub("models/SubmissionGuard.js", {
  async create({ key }) { await Promise.resolve(); if (guard.has(key)) { const e = new Error("d"); e.code = 11000; throw e; } guard.set(key, { key, createdAt: new Date() }); },
  async findOneAndDelete({ key, createdAt }) { const d = guard.get(key); if (d && d.createdAt < createdAt.$lt) { guard.delete(key); return d; } return null; },
  async deleteOne({ key }) { guard.delete(key); },
});

let flocks = []; let failCreate = false;
const Flock = {
  findOne(q) {
    const list = flocks.filter((f) => String(f.createdBy) === String(q.createdBy));
    const chain = { sort: () => chain, select: () => chain, then: (res, rej) => Promise.resolve(list.sort((a,b)=>b.createdAt-a.createdAt)[0] || null).then(res, rej) };
    return chain;
  },
  find() { const c = { select: () => c, lean: async () => flocks.map((f) => ({ batchId: f.batchId })) }; return c; },
  async exists({ batchId }) { return flocks.some((f) => f.batchId === batchId); },
  async create(d) { await new Promise((r) => setTimeout(r, 5)); if (failCreate) throw new Error("db down"); const r = { ...d, createdAt: new Date() }; flocks.push(r); return r; },
};
stub("models/Flock.js", Flock);
["models/Archive.js","models/QuarantineIsolation.js","models/MortalityRecord.js"].forEach((m) => stub(m, { findOne: async () => null, create: async (d) => d }));
stub("controllers/auditController.js", { createAuditLog: async () => {} });
stub("controllers/archiveController.js", { createArchiveEntry: async () => {} });
stub("controllers/dependencyController.js", { assertNoDependencies: async () => {} });
stub("controllers/notificationController.js", { createNotification: async () => {} });
stub("controllers/breedController.js", { resolveBreedName: async (n) => n });
stub("controllers/supplierController.js", { resolveSupplierName: async (n) => n });
stub("controllers/mortalityRecordController.js", { generateMortalityId: async () => "M-001" });

const ctl = require(path.join(S, "controllers/flockController.js"));
const mkRes = () => { const r = new EventEmitter(); r.statusCode = 200; r.status = (c) => { r.statusCode = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const call = async (fn, body, uid = "u1") => { const res = mkRes(); await fn({ body, user: { id: uid, name: "O", role: "Owner" } }, res); return res; };
const good = (q = 100) => ({ breed: "Hy-Line W-36", supplier: "S", dateAcquired: "2020-01-01", quantityPurchased: q });
const results = []; const test = async (n, f) => { try { await f(); results.push(["PASS", n]); } catch (e) { results.push(["FAIL", n + " -> " + e.message]); } };
const reset = () => { flocks = []; guard.clear(); failCreate = false; };

(async () => {
  await test("COOLDOWN status: none when user has no flocks", async () => { reset(); const r = await call(ctl.getFlockCooldownStatus, {}); assert.strictEqual(r.body.active, false); });
  await test("COOLDOWN status: active with ~remaining seconds after a recent flock", async () => {
    reset(); flocks.push({ createdBy: "u1", createdAt: new Date(Date.now() - 30000), batchId: "F-001" });
    const r = await call(ctl.getFlockCooldownStatus, {}); assert(r.body.active && r.body.remainingSeconds >= 89 && r.body.remainingSeconds <= 90, JSON.stringify(r.body));
  });
  await test("COOLDOWN status: expires after 2 minutes", async () => {
    reset(); flocks.push({ createdBy: "u1", createdAt: new Date(Date.now() - 121000), batchId: "F-001" });
    assert.strictEqual((await call(ctl.getFlockCooldownStatus, {})).body.active, false);
  });
  await test("COOLDOWN: create blocked with 429 + remaining seconds + message; nothing saved", async () => {
    reset(); flocks.push({ createdBy: "u1", createdAt: new Date(Date.now() - 20000), batchId: "F-001" });
    const r = await call(ctl.createFlock, good());
    assert.strictEqual(r.statusCode, 429); assert(r.body.remainingSeconds > 90 && /wait/i.test(r.body.message)); assert.strictEqual(flocks.length, 1);
  });
  await test("COOLDOWN: another user is not blocked", async () => {
    reset(); flocks.push({ createdBy: "u1", createdAt: new Date(Date.now() - 20000), batchId: "F-001" });
    assert.strictEqual((await call(ctl.createFlock, good(), "u2")).statusCode, 201);
  });
  await test("COOLDOWN: first create succeeds, immediate second is blocked", async () => {
    reset();
    assert.strictEqual((await call(ctl.createFlock, good(100))).statusCode, 201);
    assert.strictEqual((await call(ctl.createFlock, good(200))).statusCode, 429);
    assert.strictEqual(flocks.length, 1);
  });
  await test("COOLDOWN: two simultaneous DIFFERENT submissions -> exactly one flock created", async () => {
    reset();
    const rs = await Promise.all([call(ctl.createFlock, good(100)), call(ctl.createFlock, good(200)), call(ctl.createFlock, good(300))]);
    assert.strictEqual(rs.filter((r) => r.statusCode === 201).length, 1);
    assert.strictEqual(flocks.length, 1);
  });
  await test("COOLDOWN: validation failure does not start a cooldown", async () => {
    reset();
    assert.strictEqual((await call(ctl.createFlock, good(0))).statusCode, 400);
    assert.strictEqual((await call(ctl.createFlock, good(50))).statusCode, 201);
  });
  await test("COOLDOWN: DB failure on create releases the marker (user can retry)", async () => {
    reset(); failCreate = true;
    assert.strictEqual((await call(ctl.createFlock, good())).statusCode, 500);
    failCreate = false;
    assert.strictEqual((await call(ctl.createFlock, good())).statusCode, 201);
  });
  results.forEach(([s, n]) => console.log(s, n));
  console.log(`\n${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
  process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
})();