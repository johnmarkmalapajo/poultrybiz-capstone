const path = require("path");
const assert = require("assert");
const { EventEmitter } = require("events");
const S = "/home/claude/POULTRYBIZ-CAPSTONE-MAKDOMAK-DASHBOARD-FIXED/server";
const stub = (rel, exportsObj) => {
  const f = path.join(S, rel);
  require.cache[f] = { id: f, filename: f, loaded: true, exports: exportsObj, children: [], paths: [] };
};

// ---------- fake Mongo-ish collections ----------
const guardStore = new Map();
const SubmissionGuard = {
  async create({ key }) {
    await Promise.resolve();
    if (guardStore.has(key)) { const e = new Error("dup"); e.code = 11000; throw e; }
    guardStore.set(key, { key, createdAt: new Date() });
  },
  async findOneAndDelete({ key, createdAt }) {
    const d = guardStore.get(key);
    if (d && d.createdAt < createdAt.$lt) { guardStore.delete(key); return d; }
    return null;
  },
  async deleteOne({ key }) { guardStore.delete(key); },
};
stub("models/SubmissionGuard.js", SubmissionGuard);

const optStore = [];
const HealthOption = {
  findOne({ category, value }) {
    const hit = optStore.find((o) => o.category === category && o.value.toLowerCase() === value.toLowerCase());
    return { collation: async () => hit || null };
  },
  async create(o) {
    if (optStore.some((x) => x.category === o.category && x.value.toLowerCase() === o.value.toLowerCase())) { const e = new Error("dup"); e.code = 11000; throw e; }
    optStore.push({ ...o }); return o;
  },
};
stub("models/HealthOption.js", HealthOption);
stub("models/Veterinarian.js", {});

const wasteDocs = [];
const WasteRecord = {
  async create(d) { const r = { _id: String(wasteDocs.length + 1), ...d }; wasteDocs.push(r); return r; },
  async findById(id) { return wasteDocs.find((d) => d._id === id) || null; },
  async findByIdAndUpdate(id, upd) { const r = wasteDocs.find((d) => d._id === id); Object.assign(r, upd); return r; },
};
stub("models/WasteRecord.js", WasteRecord);
stub("controllers/auditController.js", { createAuditLog: async () => {} });
stub("controllers/archiveController.js", { createArchiveEntry: async () => {} });
stub("models/Archive.js", {});

const mkRes = () => {
  const res = new EventEmitter();
  res.statusCode = 200; res.writableEnded = false; res.body = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; res.writableEnded = true; setImmediate(() => { res.emit("finish"); res.emit("close"); }); return res; };
  return res;
};
const tick = () => new Promise((r) => setTimeout(r, 15));

const { preventDuplicateSubmission, DUPLICATE_MESSAGE } = require(path.join(S, "middleware/duplicateGuard.js"));
const wasteCtl = require(path.join(S, "controllers/wasteRecordController.js"));

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); } catch (e) { results.push(["FAIL", name + " -> " + e.message]); }
};

const run = async (body, user = "u1", { respond } = {}) => {
  const req = { method: "POST", baseUrl: "/api/v1/sales-records", path: "/", params: {}, body, user: { id: user } };
  const res = mkRes();
  let passed = false;
  await preventDuplicateSubmission(req, res, () => {
    passed = true;
    if (respond) respond(res);
  });
  await tick();
  return { passed, res };
};

(async () => {
  await test("DUP: first passes, identical second is blocked with 409 + message", async () => {
    guardStore.clear();
    const a = await run({ qty: 5, item: "Large" }, "u1", { respond: (r) => r.status(201).json({ ok: 1 }) });
    const b = await run({ qty: 5, item: "Large" });
    assert(a.passed && !b.passed);
    assert.strictEqual(b.res.statusCode, 409);
    assert.strictEqual(b.res.body.message, DUPLICATE_MESSAGE);
  });
  await test("DUP: different payload (quantity) is allowed", async () => {
    guardStore.clear();
    await run({ qty: 5, item: "Large" }, "u1", { respond: (r) => r.status(201).json({}) });
    const b = await run({ qty: 6, item: "Large" });
    assert(b.passed);
  });
  await test("DUP: different user with same payload is allowed", async () => {
    guardStore.clear();
    await run({ qty: 5 }, "u1", { respond: (r) => r.status(201).json({}) });
    const b = await run({ qty: 5 }, "u2");
    assert(b.passed);
  });
  await test("DUP: key order and surrounding spaces do not defeat the check", async () => {
    guardStore.clear();
    await run({ a: 1, b: " x " }, "u1", { respond: (r) => r.status(201).json({}) });
    const b = await run({ b: "x", a: 1 });
    assert(!b.passed && b.res.statusCode === 409);
  });
  await test("DUP: failed first attempt (400) releases the marker so the corrected resubmit works", async () => {
    guardStore.clear();
    const a = await run({ qty: 5 }, "u1", { respond: (r) => r.status(400).json({ message: "bad" }) });
    const b = await run({ qty: 5 });
    assert(a.passed && b.passed);
  });
  await test("DUP: 5 simultaneous identical requests -> exactly one reaches the handler", async () => {
    guardStore.clear();
    const rs = await Promise.all([1,2,3,4,5].map(() => run({ qty: 9 }, "u1", { respond: (r) => r.status(201).json({}) })));
    assert.strictEqual(rs.filter((r) => r.passed).length, 1);
    assert.strictEqual(rs.filter((r) => r.res.statusCode === 409).length, 4);
  });
  await test("DUP: same payload allowed again once the 2-minute window has passed", async () => {
    guardStore.clear();
    await run({ qty: 5 }, "u1", { respond: (r) => r.status(201).json({}) });
    for (const d of guardStore.values()) d.createdAt = new Date(Date.now() - 121000);
    const b = await run({ qty: 5 });
    assert(b.passed);
  });
  await test("DUP: still blocked at ~1m59s", async () => {
    guardStore.clear();
    await run({ qty: 5 }, "u1", { respond: (r) => r.status(201).json({}) });
    for (const d of guardStore.values()) d.createdAt = new Date(Date.now() - 119000);
    const b = await run({ qty: 5 });
    assert(!b.passed);
  });

  // ---------- Waste ----------
  const call = async (fn, body, params = {}) => {
    const res = mkRes();
    await fn({ body, params, user: { name: "T", role: "Owner" } }, res);
    return res;
  };
  const baseWaste = { date: "2020-01-01", quantity: 2, unit: "kg", personResponsible: "P", remarks: "" };

  await test("WASTE: custom waste type saved as typed (whitespace normalized), not 'Others'", async () => {
    const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: "  Egg   Trays ", disposalMethod: "Burial" });
    assert.strictEqual(r.statusCode, 201);
    assert.strictEqual(r.body.record.wasteType, "Egg Trays");
    assert(optStore.some((o) => o.category === "wasteType" && o.value === "Egg Trays"));
  });
  await test("WASTE: same custom value in different case reuses the saved option (no duplicate)", async () => {
    const before = optStore.length;
    const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: "egg trays", disposalMethod: "Burial" });
    assert.strictEqual(r.body.record.wasteType, "Egg Trays");
    assert.strictEqual(optStore.length, before);
  });
  await test("WASTE: custom disposal method saved once and listed under its own category", async () => {
    const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, wasteType: "Dead Birds", newDisposalMethod: "Sold to  rendering plant" });
    assert.strictEqual(r.body.record.disposalMethod, "Sold to rendering plant");
    assert(optStore.some((o) => o.category === "disposalMethod" && o.value === "Sold to rendering plant"));
  });
  await test("WASTE: custom value equal to a predefined one maps to it and creates no option", async () => {
    const before = optStore.length;
    const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: "dead birds", newDisposalMethod: "burial" });
    assert.strictEqual(r.body.record.wasteType, "Dead Birds");
    assert.strictEqual(r.body.record.disposalMethod, "Burial");
    assert.strictEqual(optStore.length, before);
  });
  await test("WASTE: 'Others' selected with empty custom text is rejected (400)", async () => {
    const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, wasteType: "Others", disposalMethod: "Burial" });
    assert.strictEqual(r.statusCode, 400);
    const r2 = await call(wasteCtl.createWasteRecord, { ...baseWaste, wasteType: "Burial".length ? "Dead Birds" : "", newDisposalMethod: "   " , disposalMethod: "Others"});
    assert.strictEqual(r2.statusCode, 400);
  });
  await test("WASTE: literal 'Others'/'Other' typed as custom value is rejected", async () => {
    for (const v of ["Others", "other", " OTHERS "]) {
      const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: v, disposalMethod: "Burial" });
      assert.strictEqual(r.statusCode, 400, v);
    }
  });
  await test("WASTE: punctuation-only and >60-char custom values are rejected", async () => {
    let r = await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: "!!!", disposalMethod: "Burial" });
    assert.strictEqual(r.statusCode, 400);
    r = await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: "x".repeat(61), disposalMethod: "Burial" });
    assert.strictEqual(r.statusCode, 400);
  });
  await test("WASTE: rejected requests save no record and no option", async () => {
    const recs = wasteDocs.length, opts = optStore.length;
    await call(wasteCtl.createWasteRecord, { ...baseWaste, newWasteType: "Others", disposalMethod: "Burial" });
    assert.strictEqual(wasteDocs.length, recs);
    assert.strictEqual(optStore.length, opts);
  });
  await test("WASTE: editing a legacy 'Other' record without changing it still saves", async () => {
    wasteDocs.push({ _id: "legacy", ...baseWaste, wasteType: "Other", disposalMethod: "Other" });
    const r = await call(wasteCtl.updateWasteRecord, { ...baseWaste, wasteType: "Other", disposalMethod: "Other", remarks: "x" }, { id: "legacy" });
    assert.strictEqual(r.statusCode, 200);
    assert.strictEqual(r.body.record.wasteType, "Other");
  });
  await test("WASTE: editing a record to 'Others' with no custom text is rejected", async () => {
    const r = await call(wasteCtl.updateWasteRecord, { ...baseWaste, wasteType: "Others", disposalMethod: "Burial" }, { id: "legacy" });
    assert.strictEqual(r.statusCode, 400);
  });
  await test("WASTE: predefined values still work unchanged", async () => {
    const r = await call(wasteCtl.createWasteRecord, { ...baseWaste, wasteType: "Feed Bags", disposalMethod: "Recycling" });
    assert.strictEqual(r.statusCode, 201);
    assert.strictEqual(r.body.record.wasteType, "Feed Bags");
  });

  results.forEach(([s, n]) => console.log(s, n));
  console.log(`\n${results.filter((r) => r[0] === "PASS").length}/${results.length} passed`);
  process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
})();