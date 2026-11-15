// Integration test: Quarantine Duration, 14-day release eligibility, Owner-only
// release (with / without deaths) and release reminders.
//
// Runs the REAL controllers and Mongoose models against a REAL MongoDB. The
// release uses a transaction, so the database must be a replica set
// (MongoDB Atlas already is; locally start mongod with --replSet and run
// rs.initiate()).
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27099/pb_release_test?directConnection=true" \
//     node tests/QuarantineRelease.test.js
//
// The test DROPS the database named in MONGO_TEST_URI, so point it at a
// throwaway database -- never at the farm's real one.

const assert = require("assert");
const path = require("path");
const mongoose = require("mongoose");

const URI = process.env.MONGO_TEST_URI;
if (!URI) {
  console.log("SKIP: set MONGO_TEST_URI to a throwaway replica-set database to run this test.");
  process.exit(0);
}

const S = path.join(__dirname, "..");
const QuarantineIsolation = require(path.join(S, "models/QuarantineIsolation"));
const MortalityRecord = require(path.join(S, "models/MortalityRecord"));
const Flock = require(path.join(S, "models/Flock"));
const Notification = require(path.join(S, "models/Notification"));
const dateGuard = require(path.join(S, "utils/dateGuard"));
const qCtl = require(path.join(S, "controllers/quarantineIsolationController"));
const mCtl = require(path.join(S, "controllers/mortalityRecordController"));
const { runQuarantineReleaseReminders } = require(path.join(S, "utils/quarantineRelease"));
const { ownerOnly } = require(path.join(S, "middleware/authMiddleware"));

const { phToday } = dateGuard;
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Releases go through the ownerOnly route guard, so the controller is called
// as the Owner here; the guard itself is tested in section 8.
const user = { id: new mongoose.Types.ObjectId(), name: "Owner Tester", role: "Owner" };
const call = async (fn, { params = {}, body = {}, u = user } = {}) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params, body, user: u }, res);
  return res;
};
const release = (id, body) => call(qCtl.releaseQuarantineRecord, { params: { id: String(id) }, body });

let seq = 0;
// A Quarantined flock + its Ongoing Quarantine record. Defaults to a batch
// that has just completed its 14-day quarantine (eligible for release today).
const makeBatch = async ({ qty = 100, daysAgo = 14, headCount = qty, status = "Ongoing", releasedDate = "", flockStatus = "Quarantined" } = {}) => {
  seq += 1;
  const batchId = `T-${String(seq).padStart(3, "0")}`;
  const flock = await Flock.create({
    batchId, breed: "Hy-Line", supplier: "S", dateAcquired: addDays(phToday(), -daysAgo),
    quantityPurchased: qty, currentQuantity: qty, status: flockStatus, createdBy: user.id,
  });
  const rec = await QuarantineIsolation.create({
    recordType: "Quarantine", batchId, source: "S", breed: "Hy-Line", headCount, status, releasedDate,
  });
  return { flock, rec, batchId };
};
const state = async (batchId, recId) => ({
  flock: await Flock.findOne({ batchId }).lean(),
  rec: await QuarantineIsolation.findById(recId).lean(),
  mortality: await MortalityRecord.find({ batchId }).lean(),
});

const results = [];
const test = async (name, fn) => {
  try { await fn(); results.push(["PASS", name]); }
  catch (e) { results.push(["FAIL", `${name} -> ${e.message}`]); }
};

(async () => {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await MortalityRecord.init();
  await QuarantineIsolation.init();
  await Flock.init();
  await Notification.init();
  // Collections must exist before the first transaction touches them.
  for (const M of [MortalityRecord, QuarantineIsolation, Flock, Notification]) {
    try { await M.createCollection(); } catch { /* already exists */ }
  }
  const tz = process.env.TZ || "(system default)";
  console.log(`Server timezone for this run: ${tz}`);

  // ------------------------------------------------------------------
  // 1. QUARANTINE DURATION
  // ------------------------------------------------------------------
  await test("Duration: pure date maths, Ongoing = start -> Philippine today", async () => {
    const start = addDays(phToday(), -5);
    assert.strictEqual(dateGuard.quarantineDurationDays({ startDate: start, status: "Ongoing" }), 5);
    assert.strictEqual(dateGuard.quarantineDurationDays({ startDate: phToday(), status: "Ongoing" }), 0);
    assert.strictEqual(dateGuard.quarantineDurationDays({ startDate: new Date(`${start}T00:00:00Z`), status: "Ongoing" }), 5);
  });

  await test("Duration: no start date / unknown status -> null (never a made-up number)", async () => {
    assert.strictEqual(dateGuard.quarantineDurationDays({ startDate: "", status: "Ongoing" }), null);
    assert.strictEqual(dateGuard.quarantineDurationDays({ startDate: "2026-01-01", status: "" }), null);
  });

  await test("Duration: Ongoing duration grows by exactly 1 each Philippine day (clock moved forward)", async () => {
    const realNow = Date.now;
    try {
      const start = "2026-11-01";
      const at = (iso) => { Date.now = () => Date.parse(iso); return dateGuard.quarantineDurationDays({ startDate: start, status: "Ongoing" }); };
      assert.strictEqual(at("2026-11-01T00:30:00+08:00"), 0);
      assert.strictEqual(at("2026-11-02T00:30:00+08:00"), 1);
      assert.strictEqual(at("2026-11-06T12:00:00+08:00"), 5);
      assert.strictEqual(at("2026-11-15T09:00:00+08:00"), 14);
    } finally { Date.now = realNow; }
  });

  await test("Duration: rolls over at 12:00 AM Manila time, not at UTC midnight or 8 AM", async () => {
    const realNow = Date.now;
    try {
      const start = "2026-11-01";
      const at = (iso) => { Date.now = () => Date.parse(iso); return dateGuard.quarantineDurationDays({ startDate: start, status: "Ongoing" }); };
      assert.strictEqual(at("2026-11-05T23:59:59+08:00"), 4); // still Nov 5 in Manila
      assert.strictEqual(at("2026-11-06T00:00:00+08:00"), 5); // Nov 6 in Manila (= Nov 5 16:00 UTC)
      assert.strictEqual(at("2026-11-05T16:00:00Z"), 5);      // same instant, written in UTC
      assert.strictEqual(at("2026-11-05T15:59:59Z"), 4);      // one second earlier
    } finally { Date.now = realNow; }
  });

  await test("Duration: Released keeps its FINAL duration (start -> release date), however long ago", async () => {
    const realNow = Date.now;
    try {
      const rec = { startDate: "2026-10-01", status: "Released", releasedDate: "2026-10-15" };
      Date.now = () => Date.parse("2026-10-16T12:00:00+08:00");
      assert.strictEqual(dateGuard.quarantineDurationDays(rec), 14);
      Date.now = () => Date.parse("2027-03-01T12:00:00+08:00");
      assert.strictEqual(dateGuard.quarantineDurationDays(rec), 14);
    } finally { Date.now = realNow; }
  });

  await test("Duration: legacy Released row without releasedDate falls back to the saved day (PH time)", async () => {
    // 2026-10-15T17:00Z is already Oct 16 in Manila.
    const d = dateGuard.quarantineDurationDays({ startDate: "2026-10-01", status: "Released", releasedDate: "", releasedAt: new Date("2026-10-15T17:00:00Z") });
    assert.strictEqual(d, 15);
  });

  await test("Duration: API returns quarantineDurationDays for Ongoing and Released rows; stored data untouched", async () => {
    const a = await makeBatch({ daysAgo: 0 });
    const b = await makeBatch({ daysAgo: 5 });
    const startC = addDays(phToday(), -20);
    const c = await makeBatch({ daysAgo: 20, status: "Released", releasedDate: addDays(startC, 14), flockStatus: "Active" });
    const before = await QuarantineIsolation.find({ _id: { $in: [a.rec._id, b.rec._id, c.rec._id] } }).lean();
    const res = await call(qCtl.getAllQuarantineRecords);
    const by = (id) => res.body.records.find((r) => String(r._id) === String(id));
    assert.strictEqual(by(a.rec._id).quarantineDurationDays, 0);
    assert.strictEqual(by(b.rec._id).quarantineDurationDays, 5);
    assert.strictEqual(by(c.rec._id).quarantineDurationDays, 14);
    assert.strictEqual(by(c.rec._id).status, "Released");
    const after = await QuarantineIsolation.find({ _id: { $in: [a.rec._id, b.rec._id, c.rec._id] } }).lean();
    assert.deepStrictEqual(after.map((r) => [r.status, r.releasedDate, r.headCount]), before.map((r) => [r.status, r.releasedDate, r.headCount]));
    assert.ok(!("quarantineDurationDays" in after[0]), "duration must be computed, never stored");
  });

  // ------------------------------------------------------------------
  // 2. RELEASE WITHOUT DEATHS
  // ------------------------------------------------------------------
  await test("Release (No deaths): Released, no Mortality Record, no flock deduction, flock back to Active", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    const res = await release(rec._id, { hadDeaths: false });
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.rec.status, "Released");
    assert.strictEqual(s.rec.releasedDate, phToday());
    assert.strictEqual(s.rec.releaseMethod, "Manual");
    assert.strictEqual(s.rec.releaseDeaths, 0);
    assert.strictEqual(s.rec.headCount, 100);
    assert.ok(s.rec.releaseFinalizedAt instanceof Date, "actual release date and time saved");
    assert.strictEqual(s.rec.quarantineStartDate, addDays(phToday(), -14), "original start date preserved");
    assert.strictEqual(s.rec.expectedReleaseDate, phToday(), "expected release date preserved");
    assert.strictEqual(s.rec.releasedBy, "Owner Tester");
    assert.strictEqual(s.mortality.length, 0);
    assert.strictEqual(s.flock.currentQuantity, 100);
    assert.strictEqual(s.flock.totalMortality, 0);
    assert.strictEqual(s.flock.status, "Active");
  });

  await test("Release (No deaths): a stray deceasedCount is ignored -- nothing is deducted", async () => {
    const { rec, batchId } = await makeBatch({ qty: 50 });
    const res = await release(rec._id, { hadDeaths: false, deceasedCount: 9 });
    assert.strictEqual(res.statusCode, 200);
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.mortality.length, 0);
    assert.strictEqual(s.flock.currentQuantity, 50);
  });

  // ------------------------------------------------------------------
  // 3. RELEASE WITH DEATHS
  // ------------------------------------------------------------------
  await test("Release (Yes, 7 deaths): ONE Mortality Record, flock deducted, status Released", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    const res = await release(rec._id, { hadDeaths: true, deceasedCount: 7 });
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.mortality.length, 1);
    const m = s.mortality[0];
    assert.strictEqual(m.batchId, batchId);
    assert.strictEqual(m.numberOfMortality, 7);
    assert.strictEqual(String(m.sourceQuarantineId), String(rec._id));
    assert.strictEqual(m.date.toISOString().slice(0, 10), phToday());
    assert.ok(/^M-\d+$/.test(m.mortalityId));
    assert.ok(m.causeOfDeath);
    assert.strictEqual(m.currentBirds, 93);
    assert.strictEqual(s.flock.currentQuantity, 93);
    assert.strictEqual(s.flock.totalMortality, 7);
    assert.strictEqual(s.flock.mortalityRate, 7);
    assert.strictEqual(s.flock.status, "Active");
    assert.strictEqual(s.rec.status, "Released");
    assert.strictEqual(s.rec.releaseDeaths, 7);
    assert.strictEqual(String(s.rec.releaseMortalityRecordId), String(m._id));
    assert.strictEqual(s.rec.headCount, 93, "survivors, same rule the mortality module uses for an Ongoing quarantine");
  });

  await test("Release (Yes): deaths equal to the whole head count is allowed", async () => {
    const { rec, batchId } = await makeBatch({ qty: 10 });
    const res = await release(rec._id, { hadDeaths: true, deceasedCount: "10" });
    assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.flock.currentQuantity, 0);
    assert.strictEqual(s.mortality.length, 1);
  });

  await test("Release (Yes): a Culled flock is NOT reactivated", async () => {
    const { rec, batchId } = await makeBatch({ qty: 20, flockStatus: "Culled" });
    const res = await release(rec._id, { hadDeaths: false });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual((await state(batchId, rec._id)).flock.status, "Culled");
  });

  await test("Release: Mortality Record from a release is read-only except remarks (automatic record)", async () => {
    const { rec, batchId } = await makeBatch({ qty: 40 });
    await release(rec._id, { hadDeaths: true, deceasedCount: 4 });
    const m = (await state(batchId, rec._id)).mortality[0];
    const list = await call(mCtl.getAllMortalityRecords);
    const row = list.body.records.find((r) => String(r._id) === String(m._id));
    assert.strictEqual(row.autoGeneratedFromIsolation, true);
    const upd = await call(mCtl.updateMortalityRecord, { params: { id: String(m._id) }, body: { numberOfMortality: 30, remarks: "note" } });
    assert.ok(upd.statusCode < 400, JSON.stringify(upd.body));
    const after = await MortalityRecord.findById(m._id).lean();
    assert.strictEqual(after.numberOfMortality, 4, "death quantity must not be editable");
    assert.strictEqual(after.remarks, "note");
  });

  // ------------------------------------------------------------------
  // 4. VALIDATION (backend, independent of the browser)
  // ------------------------------------------------------------------
  const rejected = [
    ["empty string", { hadDeaths: true, deceasedCount: "" }],
    ["missing", { hadDeaths: true }],
    ["null", { hadDeaths: true, deceasedCount: null }],
    ["zero", { hadDeaths: true, deceasedCount: 0 }],
    ['"0"', { hadDeaths: true, deceasedCount: "0" }],
    ["negative", { hadDeaths: true, deceasedCount: -3 }],
    ["decimal 2.5", { hadDeaths: true, deceasedCount: 2.5 }],
    ['decimal "2.5"', { hadDeaths: true, deceasedCount: "2.5" }],
    ["text", { hadDeaths: true, deceasedCount: "abc" }],
    ["exponent 1e1", { hadDeaths: true, deceasedCount: "1e1" }],
    ["boolean", { hadDeaths: true, deceasedCount: true }],
    ["array", { hadDeaths: true, deceasedCount: [3] }],
    ["object", { hadDeaths: true, deceasedCount: { $gt: 0 } }],
    ["more than the head count (101 of 100)", { hadDeaths: true, deceasedCount: 101 }],
    ["huge number", { hadDeaths: true, deceasedCount: "99999999999999999999999" }],
    ["hadDeaths missing", {}],
    ['hadDeaths "false" (string)', { hadDeaths: "false" }],
    ["hadDeaths 0 (number)", { hadDeaths: 0 }],
  ];
  for (const [label, body] of rejected) {
    await test(`Validation: rejects ${label} -> 400, nothing changes`, async () => {
      const { rec, batchId } = await makeBatch({ qty: 100 });
      const res = await release(rec._id, body);
      assert.strictEqual(res.statusCode, 400, JSON.stringify(res.body));
      const s = await state(batchId, rec._id);
      assert.strictEqual(s.rec.status, "Ongoing");
      assert.strictEqual(s.rec.releasedDate, "");
      assert.strictEqual(s.mortality.length, 0);
      assert.strictEqual(s.flock.currentQuantity, 100);
      assert.strictEqual(s.flock.status, "Quarantined");
    });
  }

  await test("Validation: deaths cannot exceed the flock's current birds (head count 100, flock now 6)", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    await Flock.updateOne({ batchId }, { $set: { currentQuantity: 6 } });
    const bad = await release(rec._id, { hadDeaths: true, deceasedCount: 7 });
    assert.strictEqual(bad.statusCode, 400);
    assert.strictEqual((await state(batchId, rec._id)).rec.status, "Ongoing");
    const ok = await release(rec._id, { hadDeaths: true, deceasedCount: 6 });
    assert.strictEqual(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.strictEqual((await state(batchId, rec._id)).flock.currentQuantity, 0);
  });

  await test("Validation: unknown id -> 404; Isolation record -> 400; archived -> 400", async () => {
    assert.strictEqual((await release(new mongoose.Types.ObjectId(), { hadDeaths: false })).statusCode, 404);
    const iso = await QuarantineIsolation.create({ recordType: "Isolation", isolationId: "ISO-901", batchId: "X", headCount: 1, remaining: 1, currentStatus: "In Isolation" });
    assert.strictEqual((await release(iso._id, { hadDeaths: false })).statusCode, 400);
    const { rec } = await makeBatch();
    await QuarantineIsolation.updateOne({ _id: rec._id }, { $set: { archived: true } });
    assert.strictEqual((await release(rec._id, { hadDeaths: false })).statusCode, 400);
  });

  await test("Validation: a batch with an ongoing Isolation cannot be released", async () => {
    const { rec, batchId } = await makeBatch();
    await QuarantineIsolation.create({ recordType: "Isolation", isolationId: "ISO-902", batchId, headCount: 2, remaining: 2, currentStatus: "In Isolation" });
    const res = await release(rec._id, { hadDeaths: false });
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual((await state(batchId, rec._id)).rec.status, "Ongoing");
  });

  // ------------------------------------------------------------------
  // 5. DUPLICATE PREVENTION
  // ------------------------------------------------------------------
  await test("Double-click: 6 simultaneous 'Confirm Release' -> exactly ONE success, ONE mortality, ONE deduction", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    const all = await Promise.all(Array.from({ length: 6 }, () => release(rec._id, { hadDeaths: true, deceasedCount: 5 })));
    const ok = all.filter((r) => r.statusCode === 200).length;
    const dup = all.filter((r) => r.statusCode === 409).length;
    assert.strictEqual(ok, 1, all.map((r) => r.statusCode).join(","));
    assert.strictEqual(dup, 5, all.map((r) => r.statusCode).join(","));
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.mortality.length, 1);
    assert.strictEqual(s.flock.currentQuantity, 95);
    assert.strictEqual(s.flock.totalMortality, 5);
    assert.strictEqual(s.rec.releaseDeaths, 5);
  });

  await test("Repeat after success -> 409, no second deduction", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    assert.strictEqual((await release(rec._id, { hadDeaths: true, deceasedCount: 3 })).statusCode, 200);
    const again = await release(rec._id, { hadDeaths: true, deceasedCount: 3 });
    assert.strictEqual(again.statusCode, 409);
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.mortality.length, 1);
    assert.strictEqual(s.flock.currentQuantity, 97);
  });

  await test("Concurrent releases of DIFFERENT batches both succeed with distinct Mortality IDs", async () => {
    const batches = await Promise.all([makeBatch({ qty: 30 }), makeBatch({ qty: 30 }), makeBatch({ qty: 30 })]);
    const all = await Promise.all(batches.map((b) => release(b.rec._id, { hadDeaths: true, deceasedCount: 2 })));
    assert.deepStrictEqual(all.map((r) => r.statusCode), [200, 200, 200], JSON.stringify(all.map((r) => r.body)));
    const ids = (await Promise.all(batches.map(async (b) => (await state(b.batchId, b.rec._id)).mortality[0].mortalityId)));
    assert.strictEqual(new Set(ids).size, 3);
  });

  await test("Database refuses a 2nd release Mortality Record for the same quarantine record (unique index)", async () => {
    const { rec, batchId } = await makeBatch({ qty: 10 });
    await release(rec._id, { hadDeaths: true, deceasedCount: 1 });
    await assert.rejects(
      MortalityRecord.create({ mortalityId: "M-DUP-1", date: phToday(), batchId, sourceQuarantineId: rec._id, numberOfMortality: 1, causeOfDeath: "x" }),
      (e) => e.code === 11000
    );
  });

  // ------------------------------------------------------------------
  // 6. CONSISTENCY: failure must leave NOTHING half-done
  // ------------------------------------------------------------------
  await test("Rollback: if the Mortality Record cannot be saved, status stays Ongoing and flock is untouched", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    const realCreate = MortalityRecord.create;
    MortalityRecord.create = async () => { throw new Error("simulated database failure"); };
    let res;
    try { res = await release(rec._id, { hadDeaths: true, deceasedCount: 5 }); }
    finally { MortalityRecord.create = realCreate; }
    assert.strictEqual(res.statusCode, 500);
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.rec.status, "Ongoing");
    assert.strictEqual(s.rec.releasedDate, "");
    assert.strictEqual(s.rec.releaseMethod, "");
    assert.strictEqual(s.rec.headCount, 100);
    assert.strictEqual(s.mortality.length, 0);
    assert.strictEqual(s.flock.currentQuantity, 100);
    assert.strictEqual(s.flock.totalMortality, 0);
    assert.strictEqual(s.flock.status, "Quarantined");
    // ...and the user can simply try again.
    assert.strictEqual((await release(rec._id, { hadDeaths: true, deceasedCount: 5 })).statusCode, 200);
    assert.strictEqual((await state(batchId, rec._id)).flock.currentQuantity, 95);
  });

  await test("Rollback: if the Flock Profile cannot be saved, no Mortality Record and no Released status remain", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    const realSave = Flock.prototype.save;
    Flock.prototype.save = async function () { throw new Error("simulated flock save failure"); };
    let res;
    try { res = await release(rec._id, { hadDeaths: true, deceasedCount: 5 }); }
    finally { Flock.prototype.save = realSave; }
    assert.strictEqual(res.statusCode, 500);
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.rec.status, "Ongoing");
    assert.strictEqual(s.mortality.length, 0, "the Mortality Record written before the failure must be rolled back");
    assert.strictEqual(s.flock.currentQuantity, 100);
  });

  await test("Rollback: a Mortality Record already linked to this release -> 409, status stays Ongoing", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    await MortalityRecord.create({ mortalityId: "M-PRE-1", date: phToday(), batchId, sourceQuarantineId: rec._id, numberOfMortality: 1, causeOfDeath: "x" });
    const res = await release(rec._id, { hadDeaths: true, deceasedCount: 5 });
    assert.strictEqual(res.statusCode, 409, JSON.stringify(res.body));
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.rec.status, "Ongoing");
    assert.strictEqual(s.mortality.length, 1);
    assert.strictEqual(s.flock.currentQuantity, 100);
  });

  // ------------------------------------------------------------------
  // 7. EXISTING BEHAVIOUR PRESERVED
  // ------------------------------------------------------------------
  await test("No automatic release: a record 20 days into quarantine stays Ongoing after the scheduled job runs", async () => {
    const { rec, batchId } = await makeBatch({ qty: 20, daysAgo: 20 });
    await runQuarantineReleaseReminders("test");
    await runQuarantineReleaseReminders("test");
    const s2 = await state(batchId, rec._id);
    assert.strictEqual(s2.rec.status, "Ongoing");
    assert.strictEqual(s2.rec.releasedDate, "");
    assert.strictEqual(s2.flock.status, "Quarantined");
    assert.strictEqual(s2.mortality.length, 0);
  });

  await test("Released records stay visible in the list API and keep their data", async () => {
    const { rec } = await makeBatch({ qty: 20 });
    await release(rec._id, { hadDeaths: true, deceasedCount: 2 });
    const res = await call(qCtl.getAllQuarantineRecords);
    const row = res.body.records.find((r) => String(r._id) === String(rec._id));
    assert.ok(row, "released record must still be listed");
    assert.strictEqual(row.status, "Released");
    assert.strictEqual(row.releasedDate, phToday());
    assert.strictEqual(typeof row.quarantineDurationDays, "number");
  });

  await test("Isolation workflow unaffected: after release, Isolation + progress with deaths works as before", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    await release(rec._id, { hadDeaths: false });
    const created = await call(qCtl.createQuarantineRecord, { body: { recordType: "Isolation", batchId, dateIsolated: phToday(), headCount: 10, symptoms: "Cough", location: "Pen" } });
    assert.strictEqual(created.statusCode, 201, JSON.stringify(created.body));
    const iso = created.body.record;
    const prog = await call(qCtl.updateIsolationProgress, { params: { id: String(iso._id) }, body: { recoveredDelta: 4, deceasedDelta: 3, date: phToday() } });
    assert.strictEqual(prog.statusCode, 200, JSON.stringify(prog.body));
    const s = await state(batchId, rec._id);
    assert.strictEqual(s.flock.currentQuantity, 97);
    const m = s.mortality.find((x) => String(x.sourceIsolationId) === String(iso._id));
    assert.ok(m && m.numberOfMortality === 3 && !m.sourceQuarantineId);
  });

  await test("Isolation can't be created while quarantine is Ongoing (existing rule), but can right after release", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100 });
    const blocked = await call(qCtl.createQuarantineRecord, { body: { recordType: "Isolation", batchId, dateIsolated: phToday(), headCount: 5, symptoms: "Cough" } });
    assert.strictEqual(blocked.statusCode, 400);
    await release(rec._id, { hadDeaths: false });
    const ok = await call(qCtl.createQuarantineRecord, { body: { recordType: "Isolation", batchId, dateIsolated: phToday(), headCount: 5, symptoms: "Cough" } });
    assert.strictEqual(ok.statusCode, 201, JSON.stringify(ok.body));
  });

  await test("Quarantine records still cannot be edited directly (existing rule kept)", async () => {
    const { rec } = await makeBatch();
    const res = await call(qCtl.updateQuarantineRecord, { params: { id: String(rec._id) }, body: { status: "Released" } });
    assert.strictEqual(res.statusCode, 400);
  });

  // ------------------------------------------------------------------
  // 8. PERMISSIONS
  // ------------------------------------------------------------------
  await test("Route guard: only the Owner may release; a Farmer (or any other role) gets 403 before the controller runs", async () => {
    const run = (role) => {
      let out = "next";
      const res = { status: (c) => ({ json: () => { out = c; } }) };
      ownerOnly({ user: { role } }, res, () => {});
      return out;
    };
    assert.strictEqual(run("Owner"), "next");
    assert.strictEqual(run("Farmer"), 403);
    assert.strictEqual(run("Visitor"), 403);
    assert.strictEqual(run(""), 403);
    const routes = require("fs").readFileSync(path.join(S, "routes/quarantineIsolationRoutes.js"), "utf8");
    assert.ok(/patch\("\/:id\/release",\s*protect,\s*ownerOnly,\s*releaseQuarantineRecord\)/.test(routes));
  });

  // ------------------------------------------------------------------
  // 9. 14-DAY ELIGIBILITY (backend, Asia/Manila dates)
  // ------------------------------------------------------------------
  await test("Eligibility: day 13 of quarantine -> 400, nothing changes (even with deaths)", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100, daysAgo: 13 });
    const res = await release(rec._id, { hadDeaths: true, deceasedCount: 5 });
    assert.strictEqual(res.statusCode, 400, JSON.stringify(res.body));
    assert.ok(/on or after/.test(res.body.message), res.body.message);
    const s2 = await state(batchId, rec._id);
    assert.strictEqual(s2.rec.status, "Ongoing");
    assert.strictEqual(s2.mortality.length, 0);
    assert.strictEqual(s2.flock.currentQuantity, 100);
  });

  await test("Eligibility: on the 14th day (expected release date) the Owner can release", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100, daysAgo: 14 });
    assert.strictEqual((await release(rec._id, { hadDeaths: false })).statusCode, 200);
    assert.strictEqual((await state(batchId, rec._id)).rec.status, "Released");
  });

  await test("Eligibility: an overdue batch (day 20) can still be released", async () => {
    const { rec, batchId } = await makeBatch({ qty: 100, daysAgo: 20 });
    assert.strictEqual((await release(rec._id, { hadDeaths: true, deceasedCount: 2 })).statusCode, 200);
    assert.strictEqual((await state(batchId, rec._id)).flock.currentQuantity, 98);
  });

  await test("Eligibility: the 14-day boundary follows Philippine midnight, not UTC", async () => {
    const realNow = Date.now;
    try {
      // Start 2026-11-01 -> expected release 2026-11-15 (Manila).
      Date.now = () => Date.parse("2026-11-14T23:59:59+08:00");
      assert.strictEqual(dateGuard.isQuarantineComplete("2026-11-01"), false);
      assert.strictEqual(dateGuard.quarantineReleaseState({ startDate: "2026-11-01", status: "Ongoing" }), "Quarantined");
      Date.now = () => Date.parse("2026-11-15T00:00:00+08:00"); // = 2026-11-14T16:00Z
      assert.strictEqual(dateGuard.isQuarantineComplete("2026-11-01"), true);
      assert.strictEqual(dateGuard.quarantineReleaseState({ startDate: "2026-11-01", status: "Ongoing" }), "Eligible for Release");
      Date.now = () => Date.parse("2026-11-16T00:00:00+08:00");
      assert.strictEqual(dateGuard.quarantineReleaseState({ startDate: "2026-11-01", status: "Ongoing" }), "Overdue");
      assert.strictEqual(dateGuard.quarantineReleaseState({ startDate: "2026-11-01", status: "Released" }), "Released");
    } finally { Date.now = realNow; }
  });

  await test("List API: expected release date, state and eligibility for every stage", async () => {
    const q = await makeBatch({ daysAgo: 5 });
    const e = await makeBatch({ daysAgo: 14 });
    const o = await makeBatch({ daysAgo: 17 });
    const r = await makeBatch({ daysAgo: 15 });
    await release(r.rec._id, { hadDeaths: false });
    const res = await call(qCtl.getAllQuarantineRecords);
    const by = (id) => res.body.records.find((x) => String(x._id) === String(id));
    assert.strictEqual(by(q.rec._id).expectedReleaseDate, addDays(phToday(), 9));
    assert.strictEqual(by(q.rec._id).releaseState, "Quarantined");
    assert.strictEqual(by(q.rec._id).releaseEligible, false);
    assert.ok(/Release is available on/.test(by(q.rec._id).releaseBlockedReason));
    assert.strictEqual(by(e.rec._id).releaseState, "Eligible for Release");
    assert.strictEqual(by(e.rec._id).releaseEligible, true);
    assert.strictEqual(by(e.rec._id).releaseBlockedReason, "");
    assert.strictEqual(by(o.rec._id).releaseState, "Overdue");
    assert.strictEqual(by(o.rec._id).releaseEligible, true);
    assert.strictEqual(by(r.rec._id).releaseState, "Released");
    assert.strictEqual(by(r.rec._id).expectedReleaseDate, addDays(phToday(), -1), "released row keeps its expected release date");
    assert.strictEqual(by(e.rec._id).currentFlockQuantity, 100);
  });

  // ------------------------------------------------------------------
  // 10. RELEASE REMINDERS (Owner + Farmer, once per event)
  // ------------------------------------------------------------------
  const remindersFor = (id) => Notification.find({ referenceId: id, category: "quarantine" }).lean();

  await test("Reminder: one day before the expected release date -> 'tomorrow' notice to Owner and Farmer, once", async () => {
    const { rec, batchId } = await makeBatch({ daysAgo: 13 });
    await runQuarantineReleaseReminders("test");
    await runQuarantineReleaseReminders("test");
    const n = await remindersFor(rec._id);
    assert.strictEqual(n.length, 1, JSON.stringify(n.map((x) => x.sourceId)));
    assert.strictEqual(n[0].sourceId, `quarantine_upcoming_${rec._id}`);
    assert.deepStrictEqual(n[0].roles.sort(), ["Farmer", "Owner"]);
    assert.strictEqual(n[0].referenceModel, "QuarantineIsolation");
    assert.ok(n[0].description.includes(`Batch ${batchId} is scheduled for quarantine release tomorrow (${addDays(phToday(), 1)})`), n[0].description);
    assert.strictEqual((await state(batchId, rec._id)).rec.status, "Ongoing", "a reminder never releases");
  });

  await test("Reminder: on the 14th day -> 'eligible, awaiting Owner action' notice, once; still Quarantined", async () => {
    const { rec, batchId } = await makeBatch({ daysAgo: 14 });
    await runQuarantineReleaseReminders("test");
    await runQuarantineReleaseReminders("test");
    const n = await remindersFor(rec._id);
    assert.strictEqual(n.length, 1);
    assert.strictEqual(n[0].sourceId, `quarantine_eligible_${rec._id}`);
    assert.deepStrictEqual(n[0].roles.sort(), ["Farmer", "Owner"]);
    assert.ok(n[0].description.includes(`Batch ${batchId} has completed its 14-day quarantine period and is now eligible for release`), n[0].description);
    assert.ok(n[0].description.includes("Awaiting Owner action"));
    assert.ok(n[0].description.includes(phToday()), "includes the expected release date");
    assert.strictEqual((await state(batchId, rec._id)).rec.status, "Ongoing");
  });

  await test("Reminder: overdue -> one notice per Philippine day to Owner and Farmer, record stays Ongoing", async () => {
    const { rec, batchId } = await makeBatch({ daysAgo: 16 });
    await runQuarantineReleaseReminders("test");
    await runQuarantineReleaseReminders("test");
    let n = await remindersFor(rec._id);
    assert.strictEqual(n.length, 1);
    assert.strictEqual(n[0].sourceId, `quarantine_overdue_${rec._id}_${phToday()}`);
    assert.ok(n[0].description.includes(`Batch ${batchId} is overdue by 2 days (expected release date ${addDays(phToday(), -2)})`), n[0].description);
    assert.deepStrictEqual(n[0].roles.sort(), ["Farmer", "Owner"]);
    // Next Philippine day: one more overdue reminder (not one per run).
    const realNow = Date.now;
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
    try {
      Date.now = () => tomorrow;
      await runQuarantineReleaseReminders("test");
      await runQuarantineReleaseReminders("test");
    } finally { Date.now = realNow; }
    n = await remindersFor(rec._id);
    assert.strictEqual(n.length, 2, JSON.stringify(n.map((x) => x.sourceId)));
    assert.ok(n.some((x) => x.description.includes("overdue by 3 days")));
    assert.strictEqual((await state(batchId, rec._id)).rec.status, "Ongoing");
  });

  await test("Reminder: nothing before the day-before, nothing for released or archived records", async () => {
    const early = await makeBatch({ daysAgo: 5 });
    const released = await makeBatch({ daysAgo: 16 });
    await release(released.rec._id, { hadDeaths: false });
    const archived = await makeBatch({ daysAgo: 16 });
    await QuarantineIsolation.updateOne({ _id: archived.rec._id }, { $set: { archived: true } });
    await runQuarantineReleaseReminders("test");
    assert.strictEqual((await remindersFor(early.rec._id)).length, 0);
    assert.strictEqual((await Notification.countDocuments({ referenceId: released.rec._id, sourceId: /^quarantine_(upcoming|eligible|overdue)_/ })), 0);
    assert.strictEqual((await remindersFor(archived.rec._id)).length, 0);
  });

  await test("Manual Mortality Records stay fully editable", async () => {
    const { batchId } = await makeBatch({ qty: 50, flockStatus: "Active", status: "Released", releasedDate: phToday() });
    const manual = await MortalityRecord.create({ mortalityId: "M-MAN-1", date: phToday(), batchId, numberOfMortality: 2, causeOfDeath: "Heat stress", currentBirds: 48 });
    const upd = await call(mCtl.updateMortalityRecord, { params: { id: String(manual._id) }, body: { numberOfMortality: 3, causeOfDeath: "Heat stress", date: phToday(), batchId, remarks: "corrected" } });
    assert.ok(upd.statusCode < 400, JSON.stringify(upd.body));
    const after = await MortalityRecord.findById(manual._id).lean();
    assert.strictEqual(after.numberOfMortality, 3, "a manual record's quantity is editable");
    assert.strictEqual(after.remarks, "corrected");
  });

  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();

  results.forEach(([s, n]) => console.log(s, n));
  const pass = results.filter((r) => r[0] === "PASS").length;
  console.log(`${pass}/${results.length} passed`);
  process.exit(results.some((r) => r[0] === "FAIL") ? 1 : 0);
})().catch((e) => { console.error("Test harness crashed:", e); process.exit(2); });