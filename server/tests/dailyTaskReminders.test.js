// Integration test: Daily Task Reminders for Farmers (utils/taskReminders.js).
//
// Runs the REAL reminder job, controllers and Mongoose models against a REAL
// MongoDB. Philippine calendar days are simulated by moving Date.now() (the
// backend's phToday() reads it), so several days pass in one run.
//
//   MONGO_TEST_URI="mongodb://127.0.0.1:27099/pb_reminder_test?directConnection=true" \
//     node tests/dailyTaskReminders.test.js
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
const Notification = require(path.join(S, "models/Notification"));
const User = require(path.join(S, "models/User"));
const tCtl = require(path.join(S, "controllers/personnelTaskController"));
const nCtl = require(path.join(S, "controllers/notificationController"));
const REMINDERS = path.join(S, "utils/taskReminders");
let { runDailyTaskReminders, REMINDER_TITLE } = require(REMINDERS);
const { phToday } = require(path.join(S, "utils/dateGuard"));

const PH_OFFSET = 8 * 60 * 60 * 1000;
const setPhTime = (ymd, hhmmss = "00:00:30") => {
  const t = Date.parse(`${ymd}T${hhmmss}Z`) - PH_OFFSET;
  Date.now = () => t;
};

const call = async (fn, { params = {}, body = {}, query = {}, user, file } = {}) => {
  const res = { statusCode: 200, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  await fn({ params, body, query, user, file }, res);
  return res;
};

const uploadDir = path.join(S, "uploads", "tasks");
const createdFiles = [];
const makeUpload = () => {
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `taskproof-remindertest-${process.pid}-${createdFiles.length}.jpg`;
  const p = path.join(uploadDir, filename);
  fs.writeFileSync(p, "fake image bytes");
  createdFiles.push(p);
  return { filename, path: p };
};

let seq = 0;
const makeUser = async (role) => {
  seq += 1;
  return User.create({
    name: `${role}-${seq}`, email: `${role.toLowerCase()}-rem${seq}@test.local`,
    password: "x", role, status: "Active",
  });
};
const asReq = (u) => ({ id: u._id, _id: u._id, name: u.name, role: u.role });

const reminders = (filter = {}) =>
  Notification.find({ title: REMINDER_TITLE, ...filter }).sort({ createdAt: 1 }).lean();
const remindersFor = (user, day) =>
  reminders({ userId: user._id, ...(day ? { sourceId: new RegExp(`_${day}$`) } : {}) });

const results = [];
const step = (n, label) => results.push(`  ✓ ${n}. ${label}`);

async function run() {
  await mongoose.connect(URI);
  await mongoose.connection.dropDatabase();
  await Notification.syncIndexes();
  await TaskOccurrence.syncIndexes();

  const owner = await makeUser("Owner");
  const ownerReq = asReq(owner);
  const farmerA = await makeUser("Farmer");
  const pA = await Personnel.create({ user: farmerA._id, status: "Active" });
  const farmerAReq = asReq(farmerA);
  const farmerB = await makeUser("Farmer");
  const pB = await Personnel.create({ user: farmerB._id, status: "Active" });
  const farmerBReq = asReq(farmerB);

  const D1 = "2026-11-12", D2 = "2026-11-13", D3 = "2026-11-14", D4 = "2026-11-15", D5 = "2026-11-16", D6 = "2026-11-17";

  setPhTime(D1, "08:00:00");
  const mk = async (personnel, body) => {
    const r = await call(tCtl.createPersonnelTask, { params: { id: String(personnel._id) }, body, user: ownerReq });
    assert.strictEqual(r.statusCode, 201, JSON.stringify(r.body));
    return String(r.body.task._id);
  };
  const primaryId = await mk(pA, { title: "Collect eggs", category: "Primary", module: "Flock Profile" });
  const secondaryId = await mk(pA, { title: "Fix feeder", category: "Secondary", module: "Flock Profile" });
  // A Personal task (the Farmer's own To-Do mirror, not Owner-assigned).
  const personal = await PersonnelTask.create({
    personnel: pA._id, assignedBy: farmerA._id, work: "My own note", category: "Secondary",
    linkedPersonalTodo: new mongoose.Types.ObjectId(),
  });

  // ---- 1 & 2. One reminder per assigned task, per Farmer, per day --------
  setPhTime(D1, "00:00:30"); // right after 12:00 AM PH time
  assert.strictEqual(phToday(), D1);
  const r1 = await runDailyTaskReminders("test");
  assert.strictEqual(r1.sent, 2);
  let aD1 = await remindersFor(farmerA, D1);
  assert.strictEqual(aD1.length, 2, "Primary + Secondary each get their own reminder");
  const byTask = new Map(aD1.map((n) => [String(n.referenceId), n]));
  const pr = byTask.get(primaryId);
  const se = byTask.get(secondaryId);
  assert.ok(pr && se);
  assert.strictEqual(pr.description,
    `Daily Task Reminder: Collect eggs is still assigned to you. Please check your To Do list. (Category: Primary · Date: ${D1})`);
  assert.ok(se.description.includes("Fix feeder") && se.description.includes("Category: Secondary") && se.description.includes(D1));
  for (const n of aD1) {
    assert.strictEqual(n.category, "task");
    assert.strictEqual(n.type, "reminder");
    assert.strictEqual(n.referenceModel, "PersonnelTask");
    assert.strictEqual(String(n.userId), String(farmerA._id));
  }
  assert.strictEqual((await reminders({ referenceId: personal._id })).length, 0, "Personal tasks never get reminders");
  assert.strictEqual((await remindersFor(farmerB)).length, 0, "Farmer B has no tasks, so no reminders");
  assert.strictEqual((await remindersFor(owner)).length, 0, "The Owner never gets these reminders");
  step(1, "Farmer receives the daily reminder (Task Name, Category, Date, required message)");
  step(2, "Primary and Secondary tasks each get a separate reminder; Personal tasks get none");

  // Each Farmer only sees their own reminders.
  const listB = await call(nCtl.getNotifications, { user: farmerBReq });
  assert.ok(!listB.body.notifications.some((n) => n.title === REMINDER_TITLE), "Farmer B never sees Farmer A's reminders");
  const listA = await call(nCtl.getNotifications, { user: farmerAReq });
  const listedA = listA.body.notifications.filter((n) => n.title === REMINDER_TITLE);
  assert.strictEqual(listedA.length, 2);
  // View opens the Farmer's To Do list on that exact task (not Task History).
  assert.ok(
    listedA.every((n) => n.link === `/todo?task=${n.referenceId}`),
    "Reminder View opens /todo?task=<task id>"
  );

  // ---- 3. No duplicates on the same day (hourly reruns / concurrent runs) --
  setPhTime(D1, "09:00:00");
  await runDailyTaskReminders("test");
  setPhTime(D1, "23:59:00");
  await Promise.all([runDailyTaskReminders("test"), runDailyTaskReminders("test"), runDailyTaskReminders("test")]);
  assert.strictEqual((await remindersFor(farmerA, D1)).length, 2);
  step(3, "Re-running the job (hourly / concurrently) the same day creates no duplicates");

  // ---- 4. Continues after a server restart ---------------------------------
  delete require.cache[require.resolve(REMINDERS)];
  ({ runDailyTaskReminders } = require(REMINDERS));
  await runDailyTaskReminders("startup");
  assert.strictEqual((await remindersFor(farmerA, D1)).length, 2, "Restart on the same day sends nothing new");
  setPhTime(D2, "00:00:10");
  await runDailyTaskReminders("hourly");
  assert.strictEqual((await remindersFor(farmerA, D2)).length, 2, "Next PH day: a fresh reminder per task");
  assert.strictEqual((await remindersFor(farmerA)).length, 4);
  step(4, "Reminders continue after a restart and on the next PH day, without duplicates");

  // ---- 5. Owner removes the assignment -> reminders stop ------------------
  setPhTime(D3, "00:00:05");
  // A Farmer can never remove / deactivate an Owner-assigned task.
  const fArchive = await call(tCtl.archivePersonnelTask, { params: { id: String(pA._id), taskId: secondaryId }, user: farmerAReq });
  assert.strictEqual(fArchive.statusCode, 403);
  const fDeact = await call(tCtl.updatePersonnelTask, { params: { id: String(pA._id), taskId: primaryId }, body: { active: false }, user: farmerAReq });
  assert.strictEqual(fDeact.statusCode, 403);
  const fReassign = await call(tCtl.updatePersonnelTask, { params: { id: String(pA._id), taskId: primaryId }, body: { personnelId: String(pB._id) }, user: farmerAReq });
  assert.strictEqual(fReassign.statusCode, 403);

  const oArchive = await call(tCtl.archivePersonnelTask, { params: { id: String(pA._id), taskId: secondaryId }, user: ownerReq });
  assert.strictEqual(oArchive.statusCode, 200, JSON.stringify(oArchive.body));
  const oDeact = await call(tCtl.updatePersonnelTask, { params: { id: String(pA._id), taskId: primaryId }, body: { active: false }, user: ownerReq });
  assert.strictEqual(oDeact.statusCode, 200, JSON.stringify(oDeact.body));
  await runDailyTaskReminders("test");
  assert.strictEqual((await remindersFor(farmerA, D3)).length, 0, "No reminders once the Owner removed the assignment");
  assert.strictEqual((await remindersFor(farmerA)).length, 4, "Earlier reminders (history) are kept");
  step(5, "Owner archive / deactivate stops reminders at once; Farmers get 403; history preserved");

  // ---- 6. Owner assigns again -> reminders resume (no duplicated history) --
  setPhTime(D4, "00:00:05");
  const oRestore = await call(tCtl.restorePersonnelTask, { params: { id: String(pA._id), taskId: secondaryId }, user: ownerReq });
  assert.strictEqual(oRestore.statusCode, 200, JSON.stringify(oRestore.body));
  const oReact = await call(tCtl.updatePersonnelTask, { params: { id: String(pA._id), taskId: primaryId }, body: { active: true }, user: ownerReq });
  assert.strictEqual(oReact.statusCode, 200);
  await runDailyTaskReminders("test");
  await runDailyTaskReminders("test");
  assert.strictEqual((await remindersFor(farmerA, D4)).length, 2);
  assert.strictEqual((await remindersFor(farmerA)).length, 6);

  // Reassigning to another Farmer moves the reminder; assigning it back the
  // same day does not duplicate the one Farmer A already received.
  const toB = await call(tCtl.updatePersonnelTask, { params: { id: String(pA._id), taskId: primaryId }, body: { personnelId: String(pB._id) }, user: ownerReq });
  assert.strictEqual(toB.statusCode, 200, JSON.stringify(toB.body));
  await runDailyTaskReminders("test");
  const bD4 = await remindersFor(farmerB, D4);
  assert.strictEqual(bD4.length, 1);
  assert.strictEqual(String(bD4[0].referenceId), primaryId);
  const backToA = await call(tCtl.updatePersonnelTask, { params: { id: String(pB._id), taskId: primaryId }, body: { personnelId: String(pA._id) }, user: ownerReq });
  assert.strictEqual(backToA.statusCode, 200);
  await runDailyTaskReminders("test");
  assert.strictEqual((await remindersFor(farmerA, D4)).length, 2, "Re-assigned back the same day: no duplicate");
  assert.strictEqual((await remindersFor(farmerA)).length, 6);
  step(6, "Restore / reactivate / reassign resumes reminders without duplicating history");

  // ---- 7. Primary daily recurrence unchanged --------------------------------
  const occBefore = await TaskOccurrence.countDocuments();
  await runDailyTaskReminders("test");
  assert.strictEqual(await TaskOccurrence.countDocuments(), occBefore, "The reminder job never creates occurrences");
  const mineD4 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  assert.strictEqual(mineD4.body.today, D4);
  const prD4 = mineD4.body.primary.find((t) => String(t._id) === primaryId);
  assert.strictEqual(prD4.occurrence.occurrenceDate, D4);
  assert.strictEqual(prD4.occurrence.status, "Pending");
  // Farmer completes today's Primary occurrence; later runs today skip it,
  // and tomorrow it is due (and reminded) again.
  setPhTime(D4, "10:00:00");
  const doneP = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(prD4.occurrence._id) }, body: { remarks: "Collected" }, file: makeUpload(), user: farmerAReq,
  });
  assert.strictEqual(doneP.statusCode, 200, JSON.stringify(doneP.body));
  await runDailyTaskReminders("test");
  assert.strictEqual((await remindersFor(farmerA, D4)).length, 2);
  setPhTime(D5, "00:00:05");
  const mineD5 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  const prD5 = mineD5.body.primary.find((t) => String(t._id) === primaryId);
  assert.strictEqual(prD5.occurrence.occurrenceDate, D5);
  assert.strictEqual(prD5.occurrence.status, "Pending", "Primary resets to Pending on the new day as before");
  step(7, "Primary Task recurrence unchanged (new Pending occurrence each PH day)");

  // ---- 8. Completed Secondary task is not reset -----------------------------
  const seD5 = mineD5.body.secondary.find((t) => String(t._id) === secondaryId);
  const doneS = await call(tCtl.submitTaskOccurrence, {
    params: { occurrenceId: String(seD5.occurrence._id) }, body: { remarks: "Feeder fixed" }, file: makeUpload(), user: farmerAReq,
  });
  assert.strictEqual(doneS.statusCode, 200, JSON.stringify(doneS.body));
  await runDailyTaskReminders("test");
  const aD5 = await remindersFor(farmerA, D5);
  assert.deepStrictEqual(aD5.map((n) => String(n.referenceId)), [primaryId], "Completed Secondary gets no reminder");
  setPhTime(D6, "00:00:05");
  await runDailyTaskReminders("test");
  const aD6 = await remindersFor(farmerA, D6);
  assert.deepStrictEqual(aD6.map((n) => String(n.referenceId)), [primaryId]);
  const mineD6 = await call(tCtl.getMyTasksToday, { user: farmerAReq });
  const seD6 = mineD6.body.secondary.find((t) => String(t._id) === secondaryId);
  assert.strictEqual(seD6.occurrence.status, "Completed", "Completed Secondary stays Completed");
  assert.strictEqual(await TaskOccurrence.countDocuments({ task: secondaryId }), 1, "Still one lifetime occurrence");
  step(8, "Completed Secondary tasks are not reset and are no longer reminded");

  // ---- 9. Completion notifications still open Task History -----------------
  const ownerList = await call(nCtl.getNotifications, { user: ownerReq });
  const completedS = ownerList.body.notifications.find((n) => n.title === "Secondary Task Completed");
  assert.ok(completedS, "Owner got the completion notification");
  assert.strictEqual(completedS.referenceModel, "TaskOccurrence");
  assert.strictEqual(completedS.link,
    `/personnel-visitors/personnel/view/${pA._id}?tab=history&submission=${seD5.occurrence._id}`);
  assert.ok(!ownerList.body.notifications.some((n) => n.title === REMINDER_TITLE), "Owner never sees Farmer reminders");
  step(9, "Completion notifications still open Personnel → Task History (exact submission)");

  console.log("Daily Task Reminders — all checks passed:");
  for (const r of results) console.log(r);
}

run()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => {
    for (const f of createdFiles) { try { fs.unlinkSync(f); } catch { /* moved / removed */ } }
    // Photos the controller kept for the two accepted submissions.
    try {
      for (const f of fs.readdirSync(uploadDir)) if (f.includes("remindertest")) fs.unlinkSync(path.join(uploadDir, f));
    } catch { /* none */ }
    await mongoose.disconnect();
  });