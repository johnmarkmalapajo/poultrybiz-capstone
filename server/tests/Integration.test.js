process.env.TZ = "Asia/Manila";
const S = "/home/claude/POULTRYBIZ-CAPSTONE-MAKDOMAK-DASHBOARD-FIXED/server";
const mongoose = require(S + "/node_modules/mongoose");
const express = require(S + "/node_modules/express");
const assert = require("assert");
const http = require("http");
(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27555/pbtest");
  await mongoose.connection.dropDatabase();
  const SG = require(S + "/models/SubmissionGuard");
  const HealthOption = require(S + "/models/HealthOption");
  const WasteRecord = require(S + "/models/WasteRecord");
  const Flock = require(S + "/models/Flock");
  await Promise.all([SG.init(), HealthOption.init(), WasteRecord.init(), Flock.init()]);
  const { preventDuplicateSubmission } = require(S + "/middleware/duplicateGuard");
  const waste = require(S + "/controllers/wasteRecordController");
  const flockCtl = require(S + "/controllers/flockController");
  const R = []; const t = async (n, f) => { try { await f(); R.push(["PASS", n]); } catch (e) { R.push(["FAIL", n + " -> " + e.message]); } };

  // real HTTP app
  let saved = [];
  const app = express(); app.use(express.json());
  const user = new mongoose.Types.ObjectId();
  app.use((req, _r, n) => { req.user = { id: req.headers["x-user"] || String(user), name: "T", role: "Owner" }; n(); });
  app.post("/items", preventDuplicateSubmission, async (req, res) => {
    if (req.body.bad) return res.status(400).json({ message: "bad" });
    await new Promise((r) => setTimeout(r, 30)); saved.push(req.body); res.status(201).json({ ok: true });
  });
  app.post("/waste", preventDuplicateSubmission, waste.createWasteRecord);
  app.post("/flocks", preventDuplicateSubmission, flockCtl.createFlock);
  const srv = http.createServer(app).listen(0); const port = srv.address().port;
  const post = (p, body, uid) => new Promise((resolve) => {
    const d = JSON.stringify(body);
    const rq = http.request({ port, path: p, method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(d), ...(uid ? { "x-user": uid } : {}) } }, (rs) => { let b = ""; rs.on("data", (c) => b += c); rs.on("end", () => resolve({ s: rs.statusCode, b: JSON.parse(b || "{}") })); });
    rq.end(d);
  });

  await t("INDEX: SubmissionGuard has unique key + TTL index", async () => {
    const ix = await SG.collection.indexes();
    assert(ix.some((i) => i.key.key && i.unique), "unique"); assert(ix.some((i) => i.key.createdAt && i.expireAfterSeconds === 180), "ttl");
  });
  await t("HTTP: 6 parallel identical POSTs -> 1x201, 5x409, one saved", async () => {
    saved = []; const rs = await Promise.all(Array(6).fill(0).map(() => post("/items", { name: "A", qty: 3 })));
    assert.strictEqual(rs.filter((r) => r.s === 201).length, 1); assert.strictEqual(rs.filter((r) => r.s === 409).length, 5);
    assert.strictEqual(saved.length, 1); assert(/already been submitted/.test(rs.find((r) => r.s === 409).b.message));
  });
  await t("HTTP: different quantity is a legitimate separate record", async () => {
    const r = await post("/items", { name: "A", qty: 4 }); assert.strictEqual(r.s, 201);
  });
  await t("HTTP: 400 response releases marker; fixed resubmit allowed", async () => {
    const a = await post("/items", { name: "Z", bad: true }); const b = await post("/items", { name: "Z", bad: true });
    assert.strictEqual(a.s, 400); assert.strictEqual(b.s, 400);
  });
  await t("HTTP: expired marker (>2 min, TTL sweeper not yet run) is replaced", async () => {
    await SG.updateMany({}, { createdAt: new Date(Date.now() - 125000) });
    const r = await post("/items", { name: "A", qty: 3 }); assert.strictEqual(r.s, 201);
  });
  const w = { date: "2026-11-02", quantity: 2, unit: "kg", personResponsible: "P" };
  await t("WASTE (real DB): 5 parallel saves of same new custom value -> one option, 1 record (dup guard)", async () => {
    const rs = await Promise.all(Array(5).fill(0).map(() => post("/waste", { ...w, newWasteType: "Egg Trays", disposalMethod: "Burial" })));
    assert.strictEqual(rs.filter((r) => r.s === 201).length, 1);
    assert.strictEqual(await HealthOption.countDocuments({ category: "wasteType" }), 1);
    assert.strictEqual(await WasteRecord.countDocuments({}), 1);
  });
  await t("WASTE (real DB): different records racing on same new option -> option created once", async () => {
    const rs = await Promise.all([1,2,3,4].map((q) => post("/waste", { ...w, quantity: q, wasteType: "Dead Birds", newDisposalMethod: "  Sent to   rendering " + (q % 2 ? "" : "") })));
    assert(rs.every((r) => r.s === 201), JSON.stringify(rs.map((r) => r.s)));
    assert.strictEqual(await HealthOption.countDocuments({ category: "disposalMethod" }), 1);
    const o = await HealthOption.findOne({ category: "disposalMethod" }); assert.strictEqual(o.value, "Sent to rendering");
  });
  await t("WASTE (real DB): case variant reuses stored option; stored value displays custom text", async () => {
    const r = await post("/waste", { ...w, quantity: 9, newWasteType: "egg TRAYS", disposalMethod: "Burial" });
    assert.strictEqual(r.s, 201); assert.strictEqual(r.b.record.wasteType, "Egg Trays");
    assert.strictEqual(await HealthOption.countDocuments({ category: "wasteType" }), 1);
  });
  await t("WASTE (real DB): 'Others' with no text -> 400, nothing saved", async () => {
    const n = await WasteRecord.countDocuments({});
    const r = await post("/waste", { ...w, quantity: 77, wasteType: "Others", disposalMethod: "Burial" });
    assert.strictEqual(r.s, 400); assert.strictEqual(await WasteRecord.countDocuments({}), n);
  });
  const f = { breed: "Hy-Line W-36", supplier: "S", dateAcquired: "2026-10-01", quantityPurchased: 100 };
  await t("FLOCK (real DB): first ok, 2nd different payload blocked 429, other user ok", async () => {
    const a = await post("/flocks", f); const b = await post("/flocks", { ...f, quantityPurchased: 200 });
    const c = await post("/flocks", f, String(new mongoose.Types.ObjectId()));
    assert.strictEqual(a.s, 201); assert.strictEqual(b.s, 429); assert(b.b.remainingSeconds > 100 && b.b.remainingSeconds <= 120); assert.strictEqual(c.s, 201);
  });
  await t("FLOCK (real DB): becomes available again after 2 min", async () => {
    await Flock.collection.updateMany({ createdBy: user }, { $set: { createdAt: new Date(Date.now() - 121000) } });
    await SG.deleteMany({ key: /^flock-cooldown/ });
    const r = await post("/flocks", { ...f, quantityPurchased: 300 }); assert.strictEqual(r.s, 201);
  });
  await t("FLOCK (real DB): 4 parallel different submissions from a fresh user -> 1 flock", async () => {
    const u = String(new mongoose.Types.ObjectId());
    const rs = await Promise.all([11,12,13,14].map((q) => post("/flocks", { ...f, quantityPurchased: q }, u)));
    assert.strictEqual(rs.filter((r) => r.s === 201).length, 1); assert.strictEqual(await Flock.countDocuments({ createdBy: u }), 1);
  });
  R.forEach(([s, n]) => console.log(s, n));
  console.log(`${R.filter((r) => r[0] === "PASS").length}/${R.length} passed`);
  srv.close(); await mongoose.disconnect(); process.exit(R.some((r) => r[0] === "FAIL") ? 1 : 0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });