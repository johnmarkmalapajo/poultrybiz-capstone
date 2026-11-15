// Integration test: Primary Task daily recurrence, Owner activate/deactivate,
// and per-day Task History (server/controllers/personnelTaskController.js).
//
// Runs the REAL controllers and REAL Mongoose models against a REAL
// MongoDB-compatible server. Philippine calendar days are simulated by
// moving Date.now() (the backend's phToday() reads it), so "midnight" can
// be crossed without waiting.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27017/pb_primary_test" \
//     node tests/primaryTaskRecurrence.test.js
//
// The test DROPS the database named in MONGO_TEST_URI, so point it at a
// throwaway database -- never at the farm's real one.

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const URI = process.env.MONGO_TEST_URI;
if (!URI) {
  console.log("SKIP: set MONGO_TEST_URI to a throwaway database to run this test.");
  process.exit(0);
}

const S = path.join(__dirname, "..");
const Personnel = require(path.join(S, "models/Personnel"));
const PersonnelTask = require(path.join(S, "models/PersonnelTask"));
const TaskOccurrence = require(path.join(S, "models/TaskOccurrence"));
const PersonalTodo = require(path.join(S, "models/PersonalTodo"));
const User = require(path.join(S, "models/User"));
const tCtl = require(path.join(S, "controllers/personnelTaskController"));
const pCtl = require(path.join(S, "controllers/personnelController"));
const { phToday } = require(path.join(S, "utils/dateGuard"));

const realNow = Date.now;
const PH_OFFSET = 8 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
// A fixed Philippine date/time, as a real UTC instant.
const phInstant = (ymd, hhmmss = "09:00:00") => Date.parse(`${ymd}T${hhmmss}Z`) - PH_OFFSET;
const setPhTime = (ymd, hhmmss) => {
  const t = phInstant(ymd, hhmmss);
  Date.now = () => t;
};

const call = async (fn, { params = {}, body = {}, query = {}, user, file } = {}) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params, body, query, user, file }, res);
  return res;
};

// A real file on disk, like the one multer saves before the controller runs.
const uploadDir = path.join(S, "uploads", "tasks");
let fileSeq = 0;
const makeUpload = () => {
  fs.mkdirSync(uploadDir, { recursive: true });
  fileSeq += 1;
  const filename = `taskproof-test-${process.pid}-${fileSeq}.jpg`;
  const p = path.join(uploadDir, filename);
  fs.writeFileSync(p, "fake image bytes");
  return { filename, path: p };
};
const waitForUnlink = () => new Promise((r) => setTimeout(r, 100));
const createdFiles = [];

let seq = 0;
const makeUser = async (role) => {
  seq += 1;
  return User.create({
    name: `${role}-${seq}`, email: `${role.toLowerCase()}-rec${seq}@test.local`,
    password: "x", role, status: "Active",
  });
};

const results = [];
const step = (n, label) => { results.push(`  ✓ ${n}. ${label}`); };

async function run() {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const owner = await makeUser("Owner");
  const ownerReq = { id: owner._id, _id: owner._id, name: owner.name, role: "Owner" };
  const farmerA = await makeUser("Farmer");
  const personnelA = await Personnel.create({ user: farmerA._id, status: "Active" });
  const farmerAReq = { id: farmerA._id, _id: farmerA._id, name: farmerA.name, role: "Farmer" };
  const farmerB = await makeUser("Farmer");
  await Personnel.create({ user: farmerB._id, status: "Active" });
  const farmerBReq = { id: farmerB._id, _id: farmerB._id, name: farmerB.name, role: "Farmer" };

  const D1 = "2026-11-12", D2 = "2026-11-13", D3 = "2026-11-14", D4 = "2026-11-15";
  setPhTime(D1, "08:00:00");
  assert.strictEqual(phToday(), D1);

  // 1. Owner creates and assigns a Primary Task once.
  const created = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: { title: "Collect eggs", description: "Morning collection", category: "Primary", module: "Flock Profile", dueDate: "2026-12-01" },
    user: ownerReq,
  });
  assert.strictEqual(created.statusCode, 201);
  const taskId = String(created.body.task._id);
  const createdAtMs = new Date(created.body.task.createdAt).getTime();
  assert.strictEqual(created.body.task.dueDate, null, "Primary tasks never get a Due Date");
  step(1, "Owner creates the Primary Task once (no Due Date)");

  // 2. Farmer sees it as Need to Do (Pending occurrence for today).
  let mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mine.body.today, D1);
  assert.strictEqual(mine.body.primary.length, 1);
  const occD1 = mine.body.primary[0].occurrence;
  assert.strictEqual(occD1.occurrenceDate, D1);
  assert.strictEqual(occD1.status, "Pending");
  step(2, "Farmer sees it as Need to Do for the current PH day");

  // Invalid submissions never complete it and never leave the photo behind.
  const blankFile = makeUpload();
  const blank = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD1._id) }, body: { remarks: "   " }, file: blankFile, user: farmerAReq,
  });
  assert.strictEqual(blank.statusCode, 400, "Whitespace-only remarks rejected");
  const noPhoto = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD1._id) }, body: { remarks: "Done" }, user: farmerAReq,
  });
  assert.strictEqual(noPhoto.statusCode, 400, "Photo is required");
  const tooLongFile = makeUpload();
  const tooLong = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD1._id) }, body: { remarks: "x".repeat(501) }, file: tooLongFile, user: farmerAReq,
  });
  assert.strictEqual(tooLong.statusCode, 400, "Remarks over 500 characters rejected");
  const otherFile = makeUpload();
  const otherFarmer = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD1._id) }, body: { remarks: "Not mine" }, file: otherFile, user: farmerBReq,
  });
  assert.strictEqual(otherFarmer.statusCode, 403, "Another Farmer cannot submit");
  await waitForUnlink();
  for (const f of [blankFile, tooLongFile, otherFile]) assert.ok(!fs.existsSync(f.path), "Rejected upload is deleted");
  assert.strictEqual((await TaskOccurrence.findById(occD1._id)).status, "Pending", "Still Need to Do after failed attempts");

  // 3-4. Valid Photo Proof + Remarks -> Done.
  setPhTime(D1, "10:15:00");
  const goodD1 = makeUpload(); createdFiles.push(goodD1);
  const submitD1 = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD1._id) }, body: { remarks: "Collected 120 eggs" }, file: goodD1, user: farmerAReq,
  });
  assert.strictEqual(submitD1.statusCode, 200);
  assert.strictEqual(submitD1.body.occurrence.status, "Completed");
  assert.strictEqual(submitD1.body.occurrence.photoProofUrl, `/uploads/tasks/${goodD1.filename}`);
  assert.strictEqual(String(submitD1.body.occurrence.submittedBy), String(farmerA._id));
  step(3, "Farmer submits valid Photo Proof + Remarks");
  step(4, "The task becomes Done");

  // 16. Retry / double submit for the same day -> rejected, no duplicate.
  const dupFile = makeUpload();
  const dup = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD1._id) }, body: { remarks: "Again" }, file: dupFile, user: farmerAReq,
  });
  assert.strictEqual(dup.statusCode, 409, "Second submission for the same day rejected");
  await waitForUnlink();
  assert.ok(!fs.existsSync(dupFile.path), "Duplicate upload is deleted");
  assert.ok(fs.existsSync(goodD1.path), "The accepted photo is kept");
  const afterDup = await TaskOccurrence.findById(occD1._id);
  assert.strictEqual(afterDup.remarks, "Collected 120 eggs", "Original submission not overwritten");

  // 5. Still Done for the rest of the PH day (and repeated loads add nothing).
  for (const t of ["13:00:00", "23:59:59"]) {
    setPhTime(D1, t);
    mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
    assert.strictEqual(mine.body.primary[0].occurrence.status, "Completed");
    assert.strictEqual(String(mine.body.primary[0].occurrence._id), String(occD1._id));
  }
  assert.strictEqual(await TaskOccurrence.countDocuments({ task: taskId }), 1, "Reloads create no extra occurrences");
  step(5, "Stays Done for the rest of the same PH day (checked 1:00 PM and 11:59:59 PM)");

  // 6. Next PH midnight -> Need to Do again; definition untouched.
  setPhTime(D2, "00:00:01");
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mine.body.today, D2);
  const occD2 = mine.body.primary[0].occurrence;
  assert.strictEqual(occD2.occurrenceDate, D2);
  assert.strictEqual(occD2.status, "Pending");
  assert.notStrictEqual(String(occD2._id), String(occD1._id));
  let def = await PersonnelTask.findById(taskId);
  assert.strictEqual(def.createdAt.getTime(), createdAtMs, "Date Created unchanged");
  assert.strictEqual(def.work, "Collect eggs");
  assert.strictEqual(await PersonnelTask.countDocuments({ personnel: personnelA._id, category: "Primary" }), 1, "No new task definition");
  step(6, "At 12:00 AM Asia/Manila the same task is Need to Do again (definition unchanged)");

  // Page left open past midnight: yesterday's still-open occurrence is closed.
  setPhTime(D3, "00:00:30");
  const staleFile = makeUpload();
  const stale = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD2._id) }, body: { remarks: "Late" }, file: staleFile, user: farmerAReq,
  });
  assert.strictEqual(stale.statusCode, 409, "Yesterday's occurrence cannot be submitted after midnight");
  await waitForUnlink();
  assert.ok(!fs.existsSync(staleFile.path));
  assert.strictEqual((await TaskOccurrence.findById(occD2._id)).status, "Pending");

  // 7. New Photo Proof + Remarks for the new day.
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  const occD3 = mine.body.primary[0].occurrence;
  assert.strictEqual(occD3.occurrenceDate, D3);
  setPhTime(D3, "07:30:00");
  const goodD3 = makeUpload(); createdFiles.push(goodD3);
  const submitD3 = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD3._id) }, body: { remarks: "Collected 118 eggs" }, file: goodD3, user: farmerAReq,
  });
  assert.strictEqual(submitD3.statusCode, 200);
  step(7, "Farmer submits a new Photo Proof + Remarks on a later day");

  // Owner edits the task definition: history snapshots must not change.
  const edit = await call(tCtl.updatePersonnelTask, {
    params: { taskId }, body: { title: "Collect and sort eggs", work: "Collect and sort eggs" }, user: ownerReq,
  });
  assert.strictEqual(edit.statusCode, 200);

  // 8. Every day's submission is its own history record.
  let hist = await call(tCtl.getTaskOccurrenceHistory, { params: { id: String(personnelA._id) }, user: ownerReq });
  const rows = hist.body.records.filter((r) => String(r.taskId) === taskId);
  assert.deepStrictEqual(rows.map((r) => r.occurrenceDate).sort(), [D1, D3]);
  const rowD1 = rows.find((r) => r.occurrenceDate === D1);
  assert.strictEqual(rowD1.taskName, "Collect eggs", "Snapshot keeps the name at submission time");
  assert.strictEqual(rowD1.remarks, "Collected 120 eggs");
  assert.strictEqual(rowD1.photoProofUrl, `/uploads/tasks/${goodD1.filename}`);
  assert.strictEqual(rowD1.category, "Primary");
  assert.ok(rowD1.farmerName && rowD1.submittedAt);
  const forbidden = await call(tCtl.getTaskOccurrenceHistory, { params: { id: String(personnelA._id) }, user: farmerBReq });
  assert.strictEqual(forbidden.statusCode, 403, "Another Farmer cannot read these submissions");
  const ownHistory = await call(tCtl.getTaskOccurrenceHistory, { params: { id: String(personnelA._id) }, user: farmerAReq });
  assert.strictEqual(ownHistory.statusCode, 200, "Farmer can read their own Completion Details");
  step(8, "Each day's submission is a separate Task History record (edit did not change snapshots)");

  // 9. Reload shows today's state from the backend.
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mine.body.primary[0].occurrence.status, "Completed");
  assert.strictEqual(mine.body.primary[0].title, "Collect and sort eggs", "Edited definition shows going forward");
  step(9, "Reloading returns the correct current-day status");

  // Farmers can never activate/deactivate, archive, restore or delete it.
  const farmerToggle = await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: false }, user: farmerAReq });
  assert.strictEqual(farmerToggle.statusCode, 403, "Farmer cannot deactivate");
  const farmerArchive = await call(tCtl.archivePersonnelTask, { params: { taskId }, user: farmerAReq });
  assert.strictEqual(farmerArchive.statusCode, 403, "Farmer cannot archive");
  const farmerDelete = await call(tCtl.deletePersonnelTask, { params: { taskId }, user: farmerAReq });
  assert.strictEqual(farmerDelete.statusCode, 403, "Farmer cannot delete");
  const farmerRestore = await call(tCtl.restorePersonnelTask, { params: { taskId }, user: farmerAReq });
  assert.strictEqual(farmerRestore.statusCode, 403, "Farmer cannot restore");
  assert.strictEqual((await PersonnelTask.findById(taskId)).active, true);

  // 11. Owner deactivates -> gone from the Farmer's active list immediately.
  const deact = await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: false }, user: ownerReq });
  assert.strictEqual(deact.statusCode, 200);
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mine.body.primary.length, 0, "Not shown as Need to Do or Done");
  const all = await call(pCtl.getAllAssignedTasks, { user: ownerReq });
  const ownerRow = all.body.find((t) => String(t._id) === taskId);
  assert.strictEqual(ownerRow.category, "Primary", "Owner To Do receives the category");
  assert.strictEqual(ownerRow.active, false, "Owner To Do receives the inactive state (can reactivate)");
  step(11, "Owner deactivates; it disappears from the Farmer's active list at once");

  // 12. No new occurrences while inactive (next day, several loads).
  setPhTime(D4, "06:00:00");
  for (let i = 0; i < 3; i++) await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(await TaskOccurrence.countDocuments({ task: taskId, occurrenceDate: D4 }), 0);
  step(12, "No new daily occurrence is generated while inactive");

  // 13. History still available to the Owner while inactive.
  hist = await call(tCtl.getTaskOccurrenceHistory, { params: { id: String(personnelA._id) }, user: ownerReq });
  assert.strictEqual(hist.body.records.filter((r) => String(r.taskId) === taskId).length, 2);
  step(13, "Previous completion records remain in Task History while inactive");

  // 14-15. Reactivate (twice, same day) -> back, today's single occurrence.
  for (let i = 0; i < 2; i++) {
    const re = await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: true }, user: ownerReq });
    assert.strictEqual(re.statusCode, 200);
    mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
    assert.strictEqual(mine.body.primary.length, 1);
    assert.strictEqual(mine.body.primary[0].occurrence.occurrenceDate, D4);
    assert.strictEqual(mine.body.primary[0].occurrence.status, "Pending");
    await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: false }, user: ownerReq });
  }
  await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: true }, user: ownerReq });
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(await TaskOccurrence.countDocuments({ task: taskId, occurrenceDate: D4 }), 1, "One occurrence for the day");
  assert.strictEqual(await PersonnelTask.countDocuments({ personnel: personnelA._id, category: "Primary" }), 1, "No duplicate definition");
  step(14, "Owner reactivates; the task is back in the Farmer's active list");

  // Completed today, then deactivated + reactivated the same day -> still Done.
  const goodD4 = makeUpload(); createdFiles.push(goodD4);
  const occD4 = mine.body.primary[0].occurrence;
  assert.strictEqual((await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD4._id) }, body: { remarks: "Day 4" }, file: goodD4, user: farmerAReq,
  })).statusCode, 200);
  await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: false }, user: ownerReq });
  // A submission attempt while inactive is refused.
  await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: true }, user: ownerReq });
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mine.body.primary[0].occurrence.status, "Completed", "Same-day completion is kept after reactivation");
  setPhTime("2026-11-16", "00:00:05");
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mine.body.primary[0].occurrence.status, "Pending", "Recurrence resumes the next day");
  assert.deepStrictEqual(
    (await TaskOccurrence.find({ task: taskId }).sort({ occurrenceDate: 1 })).map((o) => `${o.occurrenceDate}:${o.status}`),
    [`${D1}:Completed`, `${D2}:Pending`, `${D3}:Completed`, `${D4}:Completed`, "2026-11-16:Pending"],
    "Exactly one occurrence per active day"
  );
  step(15, "Daily recurrence resumes without duplicate definitions or occurrences");

  // Inactive task refuses a submission even if the page still shows it.
  const occD5 = mine.body.primary[0].occurrence;
  await call(tCtl.updatePersonnelTask, { params: { taskId }, body: { active: false }, user: ownerReq });
  const inactiveFile = makeUpload();
  const inactiveSubmit = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(occD5._id) }, body: { remarks: "Too late" }, file: inactiveFile, user: farmerAReq,
  });
  assert.strictEqual(inactiveSubmit.statusCode, 409, "Deactivated task refuses new completions");
  await waitForUnlink();
  assert.ok(!fs.existsSync(inactiveFile.path));
  step(16, "Repeated / stale / inactive submissions never create duplicate completion records");

  // 17. Secondary and Personal tasks do not reset daily.
  setPhTime("2026-11-16", "09:00:00");
  const sec = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: { title: "Fix fence", category: "Secondary", dueDate: "2026-12-31" },
    user: ownerReq,
  });
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  const secOcc = mine.body.secondary.find((t) => String(t._id) === String(sec.body.task._id)).occurrence;
  const secFile = makeUpload(); createdFiles.push(secFile);
  assert.strictEqual((await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(secOcc._id) }, body: { remarks: "Fixed" }, file: secFile, user: farmerAReq,
  })).statusCode, 200);
  const personal = await PersonalTodo.create({ user: farmerA._id, title: "Buy gloves", type: "Records", status: "Completed" });
  setPhTime("2026-11-18", "09:00:00");
  mine = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  const secNow = mine.body.secondary.find((t) => String(t._id) === String(sec.body.task._id));
  assert.strictEqual(secNow.occurrence.status, "Completed", "Secondary stays completed across days");
  assert.strictEqual(await TaskOccurrence.countDocuments({ task: sec.body.task._id }), 1, "Secondary keeps one lifetime occurrence");
  assert.strictEqual((await PersonalTodo.findById(personal._id)).status, "Completed", "Personal task unaffected");
  step(17, "Secondary and Personal tasks are not reset");

  console.log("Primary Task recurrence scenarios:");
  for (const r of results) console.log(r);
  console.log("All Primary Task recurrence assertions passed.");
}

run()
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    Date.now = realNow;
    for (const f of createdFiles) { try { fs.unlinkSync(f.path); } catch { /* already gone */ } }
    await mongoose.disconnect();
  });