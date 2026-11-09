// Integration test: the To Do module redesign -- Primary/Secondary
// PersonnelTasks and their daily/lifetime TaskOccurrence completion
// records (server/controllers/personnelTaskController.js).
//
// Runs the REAL controllers and REAL Mongoose models against a REAL
// MongoDB. No transaction is required here (unlike QuarantineRelease.test.js),
// so a plain standalone mongod is enough -- it does not need to be a
// replica set.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27099/pb_task_test" \
//     node tests/PersonnelTaskOccurrence.test.js
//
// The test DROPS the database named in MONGO_TEST_URI, so point it at a
// throwaway database -- never at the farm's real one.

const assert = require("assert");
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
const User = require(path.join(S, "models/User"));
const tCtl = require(path.join(S, "controllers/personnelTaskController"));
const { phToday } = require(path.join(S, "utils/dateGuard"));

const call = async (fn, { params = {}, body = {}, query = {}, user, file } = {}) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params, body, query, user, file }, res);
  return res;
};

let seq = 0;
const makeUser = async (role) => {
  seq += 1;
  return User.create({
    name: `${role}-${seq}`, email: `${role.toLowerCase()}${seq}@test.local`,
    password: "x", role, status: "Active",
  });
};
const makePersonnel = async (user) => Personnel.create({ user: user._id, status: "Active" });

const ownerUser = { role: "Owner", name: "Owner Tester" };

const fakePhoto = { filename: "fake-123.jpg" };

async function run() {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();

  const owner = await makeUser("Owner");
  const ownerReq = { id: owner._id, name: owner.name, role: "Owner" };

  const farmerA = await makeUser("Farmer");
  const personnelA = await makePersonnel(farmerA);
  const farmerAReq = { id: farmerA._id, name: farmerA.name, role: "Farmer" };

  const farmerB = await makeUser("Farmer");
  const personnelB = await makePersonnel(farmerB);
  const farmerBReq = { id: farmerB._id, name: farmerB.name, role: "Farmer" };

  // ---- 1. Owner creates a Primary task for Farmer A -----------------
  const createPrimary = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: { title: "Feed the flock", category: "Primary", module: "Flock Profile" },
    user: ownerReq,
  });
  assert.strictEqual(createPrimary.statusCode, 201, "Owner can create a Primary task");
  assert.strictEqual(createPrimary.body.task.category, "Primary");
  const primaryTaskId = createPrimary.body.task._id;

  // ---- 2. Owner creates a Secondary task for Farmer A, with both an
  // Estimated Duration and a Due Date -- two distinct, coexisting fields
  const createSecondary = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: {
      title: "Repair the coop fence", category: "Secondary",
      estimatedDuration: { value: 45, unit: "minutes" },
      dueDate: "2999-01-01",
    },
    user: ownerReq,
  });
  assert.strictEqual(createSecondary.statusCode, 201, "Owner can create a Secondary task");
  assert.strictEqual(createSecondary.body.task.category, "Secondary");
  assert.strictEqual(createSecondary.body.task.estimatedDuration.value, 45, "Estimated Duration is stored");
  assert.strictEqual(createSecondary.body.task.estimatedDuration.unit, "minutes");
  assert.ok(createSecondary.body.task.dueDate, "Due Date is stored independently of Estimated Duration");

  // Estimated Duration also applies to Primary tasks (a recurring task can
  // still have a typical duration estimate), but Due Date never does --
  // it is silently forced to null even if sent. Created for Farmer B (not
  // Farmer A) so it doesn't shift the Farmer-A task counts asserted below.
  const createPrimaryWithEstimate = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelB._id) },
    body: {
      title: "Morning rounds", category: "Primary",
      estimatedDuration: { value: 1, unit: "hours" },
      dueDate: "2999-01-01",
    },
    user: ownerReq,
  });
  assert.strictEqual(createPrimaryWithEstimate.statusCode, 201, "Owner can create a Primary task with an Estimated Duration");
  assert.strictEqual(createPrimaryWithEstimate.body.task.estimatedDuration.value, 1, "Estimated Duration applies to Primary tasks too");
  assert.strictEqual(createPrimaryWithEstimate.body.task.dueDate, null, "Due Date never applies to Primary tasks, even if sent");

  // An invalid Estimated Duration (not a positive number) is rejected.
  const badDuration = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: { title: "Bad duration", category: "Secondary", estimatedDuration: { value: 0, unit: "minutes" } },
    user: ownerReq,
  });
  assert.strictEqual(badDuration.statusCode, 400, "A non-positive Estimated Duration is rejected");

  const negativeDuration = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: { title: "Bad duration 2", category: "Secondary", estimatedDuration: { value: -5, unit: "minutes" } },
    user: ownerReq,
  });
  assert.strictEqual(negativeDuration.statusCode, 400, "A negative Estimated Duration is rejected");

  // Estimated Duration is genuinely optional -- omitting it entirely
  // (as every test before this change did implicitly) is never an error.
  // Created for Farmer B for the same reason as above.
  const noDuration = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelB._id) },
    body: { title: "No estimate given", category: "Secondary" },
    user: ownerReq,
  });
  assert.strictEqual(noDuration.statusCode, 201, "Estimated Duration is optional");
  assert.strictEqual(noDuration.body.task.estimatedDuration.value, null, "No Estimated Duration set means no value, not an error");

  // Date Created is backend-generated and immutable: sending createdAt in
  // an update must never change it.
  const beforeEditCreatedAt = String(createSecondary.body.task.createdAt);
  await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(createSecondary.body.task._id) },
    body: { createdAt: "2000-01-01T00:00:00.000Z", description: "Updated description" },
    user: ownerReq,
  });
  const afterEdit = await PersonnelTask.findById(createSecondary.body.task._id);
  assert.strictEqual(String(afterEdit.createdAt), beforeEditCreatedAt, "Date Created is never overwritten by an edit, even if sent in the request body");

  // Updating a task's Estimated Duration and Due Date validates both
  // independently, and changing a task's category to Primary forces its
  // Due Date back to null even if one was already set.
  const updateBoth = await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(createSecondary.body.task._id) },
    body: { estimatedDuration: { value: 90, unit: "minutes" }, dueDate: "2999-06-15" },
    user: ownerReq,
  });
  assert.strictEqual(updateBoth.statusCode, 200, "Updating Estimated Duration and Due Date together succeeds");
  assert.strictEqual(updateBoth.body.task.estimatedDuration.value, 90);
  assert.ok(updateBoth.body.task.dueDate, "Due Date update is applied");

  const updateBadEstimate = await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(createSecondary.body.task._id) },
    body: { estimatedDuration: { value: -1, unit: "minutes" } },
    user: ownerReq,
  });
  assert.strictEqual(updateBadEstimate.statusCode, 400, "An invalid Estimated Duration on update is rejected");

  const updateToPrimary = await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(createSecondary.body.task._id) },
    body: { category: "Primary" },
    user: ownerReq,
  });
  assert.strictEqual(updateToPrimary.statusCode, 200, "Changing a task's category to Primary succeeds");
  assert.strictEqual(updateToPrimary.body.task.dueDate, null, "Due Date is forced back to null when a task becomes Primary");
  // Restore it to Secondary for the rest of the test (every later section
  // assumes `createSecondary` stays a Secondary task).
  await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(createSecondary.body.task._id) },
    body: { category: "Secondary", dueDate: "2999-06-15" },
    user: ownerReq,
  });

  // Invalid category is rejected.
  const badCategory = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelA._id) },
    body: { title: "Bad", category: "Tertiary" },
    user: ownerReq,
  });
  assert.strictEqual(badCategory.statusCode, 400, "Invalid category is rejected");

  // A Farmer cannot create a task for themselves or another Farmer.
  const farmerCreateAttempt = await call(tCtl.createPersonnelTask, {
    params: { id: String(personnelB._id) },
    body: { title: "Snuck in", category: "Primary" },
    user: farmerAReq,
  });
  assert.strictEqual(farmerCreateAttempt.statusCode, 403, "Farmers cannot create/assign tasks to anyone, including themselves");

  // ---- 3. Farmer A's "today" view generates occurrences lazily -------
  const myTasksA1 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(myTasksA1.statusCode, 200);
  assert.strictEqual(myTasksA1.body.primary.length, 1, "Farmer A sees their one Primary task");
  assert.strictEqual(myTasksA1.body.secondary.length, 1, "Farmer A sees their one Secondary task");
  assert.strictEqual(myTasksA1.body.primary[0].occurrence.status, "Pending");
  const primaryOccId = myTasksA1.body.primary[0].occurrence._id;
  const secondaryOccId = myTasksA1.body.secondary[0].occurrence._id;

  // Calling again the same day must return the SAME occurrence, not a
  // second one -- no daily reassignment and no duplicates.
  const myTasksA2 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(String(myTasksA2.body.primary[0].occurrence._id), String(primaryOccId), "Same-day call reuses the existing Primary occurrence");
  const occurrenceCountToday = await TaskOccurrence.countDocuments({ task: primaryTaskId });
  assert.strictEqual(occurrenceCountToday, 1, "No duplicate occurrence was created for the same day");

  // ---- 4. Farmer B must never see Farmer A's tasks -------------------
  // (Farmer B has their own Primary + Secondary tasks from the Estimated
  // Duration coverage above -- the point here is that none of Farmer A's
  // tasks leak into Farmer B's list.)
  const myTasksB = await call(tCtl.getMyTasksToday, { user: farmerBReq });
  assert.strictEqual(myTasksB.body.primary.length, 1, "Farmer B sees only their own Primary task, not Farmer A's");
  assert.strictEqual(myTasksB.body.secondary.length, 1, "Farmer B sees only their own Secondary task, not Farmer A's");
  assert.strictEqual(myTasksB.body.primary[0].estimatedDuration.value, 1, "Farmer B's Primary task carries its Estimated Duration");
  assert.strictEqual(myTasksB.body.primary[0].dueDate, null, "Farmer B's Primary task has no Due Date");

  // ---- 5. Submission validation (blocked without photo/remarks) -----
  const noRemarks = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(primaryOccId) }, body: { remarks: "   " }, file: fakePhoto, user: farmerAReq,
  });
  assert.strictEqual(noRemarks.statusCode, 400, "Whitespace-only remarks are rejected");

  const noPhoto = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(primaryOccId) }, body: { remarks: "Fed the flock this morning." }, user: farmerAReq,
  });
  assert.strictEqual(noPhoto.statusCode, 400, "Missing photo is rejected");

  // Farmer B cannot submit proof for Farmer A's occurrence.
  const crossFarmer = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(primaryOccId) }, body: { remarks: "Not mine." }, file: fakePhoto, user: farmerBReq,
  });
  assert.strictEqual(crossFarmer.statusCode, 403, "A Farmer cannot submit proof for another Farmer's occurrence");

  // ---- 6. A valid submission succeeds and updates immediately -------
  const validSubmit = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(primaryOccId) }, body: { remarks: "Fed the flock this morning." }, file: fakePhoto, user: farmerAReq,
  });
  assert.strictEqual(validSubmit.statusCode, 200, "Valid photo + remarks submission succeeds");
  assert.strictEqual(validSubmit.body.occurrence.status, "Completed");
  assert.strictEqual(validSubmit.body.occurrence.photoProofUrl, "/uploads/tasks/fake-123.jpg");

  const afterSubmit = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(afterSubmit.body.primary[0].occurrence.status, "Completed", "Completion reflects immediately");

  // Re-submitting the same (already Completed) occurrence is blocked, and
  // never overwrites the first submission's remarks/photo.
  const duplicateSubmit = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(primaryOccId) }, body: { remarks: "trying again" }, file: fakePhoto, user: farmerAReq,
  });
  assert.strictEqual(duplicateSubmit.statusCode, 409, "A second submission for the same occurrence is rejected");
  const unchanged = await TaskOccurrence.findById(primaryOccId);
  assert.strictEqual(unchanged.remarks, "Fed the flock this morning.", "The first submission's remarks were not overwritten");

  // ---- 6b. Task History preserves the task's title/description exactly
  // as they read at the moment of completion, even if the Owner edits the
  // task definition afterward --------------------------------------------
  const secondarySubmit = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(secondaryOccId) }, body: { remarks: "Fence repaired." }, file: fakePhoto, user: farmerAReq,
  });
  assert.strictEqual(secondarySubmit.statusCode, 200, "Secondary task submission succeeds");

  await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(createSecondary.body.task._id) },
    body: { work: "Renamed after completion" },
    user: ownerReq,
  });

  const historyAfterRename = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: { category: "Secondary" }, user: ownerReq,
  });
  assert.strictEqual(historyAfterRename.body.records[0].taskName, "Repair the coop fence", "Task History keeps showing the task's title exactly as it read at completion, not the renamed live task");

  // ---- 7. Secondary task: exactly one lifetime occurrence -----------
  // Simulate "yesterday" already existing for the Secondary task, then
  // confirm a fresh "today" call reuses it rather than creating a new one
  // (Secondary tasks are one-off, unlike Primary's daily reset).
  const addDays = (day, n) => {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  await TaskOccurrence.updateOne({ _id: secondaryOccId }, { $set: { occurrenceDate: addDays(phToday(), -1) } });
  const myTasksA3 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(String(myTasksA3.body.secondary[0].occurrence._id), String(secondaryOccId), "Secondary task reuses its single lifetime occurrence, not a new one for today");
  const secondaryOccCount = await TaskOccurrence.countDocuments({ task: createSecondary.body.task._id });
  assert.strictEqual(secondaryOccCount, 1, "A Secondary task never accumulates more than one occurrence");

  // ---- 8. Deactivating a task definition stops new occurrences but
  // keeps history ------------------------------------------------------
  await call(tCtl.updatePersonnelTask, {
    params: { taskId: String(primaryTaskId) }, body: { active: false }, user: ownerReq,
  });
  const myTasksA4 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(myTasksA4.body.primary.length, 0, "A deactivated Primary task no longer appears in today's list");
  const historyStillThere = await TaskOccurrence.findById(primaryOccId);
  assert.ok(historyStillThere, "The deactivated task's past occurrence is preserved, not deleted");

  // ---- 9. Owner-or-self task history, with cross-Farmer access blocked
  // Both the Primary and Secondary occurrences were completed above, so
  // Task History (completed submissions only) now holds exactly two
  // records for Farmer A.
  const historyForOwner = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: {}, user: ownerReq,
  });
  assert.strictEqual(historyForOwner.statusCode, 200);
  assert.strictEqual(historyForOwner.body.records.length, 2, "History shows both completed occurrences");
  assert.ok(historyForOwner.body.records.every((r) => r.photoProofUrl === "/uploads/tasks/fake-123.jpg"));
  assert.ok(historyForOwner.body.records.every((r) => r.farmerName === farmerA.name), "Every history record carries the Farmer's own name, from the Personnel record this history belongs to");

  const historyForSelf = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: {}, user: farmerAReq,
  });
  assert.strictEqual(historyForSelf.statusCode, 200, "Farmer A can view their own history");

  const historyForOtherFarmer = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: {}, user: farmerBReq,
  });
  assert.strictEqual(historyForOtherFarmer.statusCode, 403, "Farmer B cannot view Farmer A's task history");

  // Category filter: Primary and Secondary histories are distinguishable.
  const historySecondaryOnly = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: { category: "Secondary" }, user: ownerReq,
  });
  assert.strictEqual(historySecondaryOnly.body.records.length, 1, "Category filter returns only the Secondary occurrence when filtering for Secondary");
  assert.strictEqual(historySecondaryOnly.body.records[0].category, "Secondary");

  const historyPrimaryOnly = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: { category: "Primary" }, user: ownerReq,
  });
  assert.strictEqual(historyPrimaryOnly.body.records.length, 1, "Category filter returns only the Primary occurrence when filtering for Primary");
  assert.strictEqual(historyPrimaryOnly.body.records[0].category, "Primary");

  // ---- 9b. Date Completed filtering is against `submittedAt`, not
  // `occurrenceDate` ----------------------------------------------------
  // Step 7 above deliberately rewrote the Secondary occurrence's
  // `occurrenceDate` to "yesterday" to simulate daily reuse -- but its
  // `submittedAt` (the actual completion instant, set by submitTaskOccurrence
  // and never touched since) is still "now". Filtering history for today's
  // Philippine date must therefore still return BOTH occurrences; if the
  // filter were still keyed on `occurrenceDate`, the Secondary occurrence
  // would be wrongly excluded.
  const todayPH = phToday();
  const historyDateToday = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: { from: todayPH, to: todayPH }, user: ownerReq,
  });
  assert.strictEqual(historyDateToday.body.records.length, 2, "A from/to range covering today returns both occurrences by their real submittedAt completion time, unaffected by the Secondary occurrence's rewritten occurrenceDate");

  const yesterdayPH = addDays(todayPH, -1);
  const historyDateYesterday = await call(tCtl.getTaskOccurrenceHistory, {
    params: { id: String(personnelA._id) }, query: { from: yesterdayPH, to: yesterdayPH }, user: ownerReq,
  });
  assert.strictEqual(historyDateYesterday.body.records.length, 0, "A from/to range for a day with no real completions returns none, even though the Secondary occurrence's occurrenceDate was rewritten to look like yesterday");

  // ---- 10. No manual release/complete route exists for these tasks --
  // (Completion only ever happens through submitTaskOccurrence.)
  assert.strictEqual(typeof tCtl.getMyTasksToday, "function");
  assert.strictEqual(typeof tCtl.submitTaskOccurrence, "function");

  console.log("All PersonnelTaskOccurrence assertions passed.");
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("TEST FAILED:", err);
  try { await mongoose.connection.close(); } catch { /* ignore */ }
  process.exit(1);
});