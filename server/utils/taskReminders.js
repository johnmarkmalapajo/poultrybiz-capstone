// Daily Task Reminders: every Farmer gets ONE notification per Philippine
// calendar day for each task the Owner currently has assigned to them.
//
// "Currently assigned" is read straight from the task records, so nothing
// extra has to be stored or cleaned up when the Owner changes an assignment:
//   - the task is Owner-assigned (not a Personal To-Do mirror),
//   - not archived / deleted and not deactivated (active !== false),
//   - assigned to a Personnel whose account is an Active Farmer,
//   - and it still needs the Farmer's action: a Primary task whose occurrence
//     for today is not yet Completed, or a Secondary task whose one lifetime
//     occurrence is not Completed.
// When the Owner archives, deletes, deactivates or reassigns a task it simply
// stops matching, so reminders stop at once; restoring / reactivating /
// assigning it back makes it match again, so reminders resume. Reminders that
// were already sent are never touched (history is preserved).
//
// This job only READS tasks and occurrences -- it never creates or changes a
// TaskOccurrence, so the Primary daily recurrence and completed Secondary
// tasks are left exactly as they are.
//
// Duplicate guard: each reminder's sourceId is
//   task_daily_<taskId>_<farmerUserId>_<YYYY-MM-DD PH date>
// and createNotification() never creates a second notification with the same
// sourceId, so hourly runs, restarts and reconnects can never duplicate one.

const PersonnelTask = require("../models/PersonnelTask");
const TaskOccurrence = require("../models/TaskOccurrence");
const Notification = require("../models/Notification");
const { createNotification } = require("../controllers/notificationController");
const { phToday } = require("./dateGuard");

const REMINDER_TITLE = "Daily Task Reminder";

const reminderSourceId = (taskId, userId, day) => `task_daily_${taskId}_${userId}_${day}`;

const reminderDescription = (task, category, day) =>
  `Daily Task Reminder: ${task.work} is still assigned to you. Please check your To Do list. ` +
  `(Category: ${category} · Date: ${day})`;

let running = null;

async function sendDailyTaskReminders(day) {
  const tasks = await PersonnelTask.find({
    archived: false,
    active: { $ne: false },
    linkedPersonalTodo: null,
    status: { $ne: "Archived" },
    personnel: { $ne: null },
  })
    .populate({ path: "personnel", select: "user status", populate: { path: "user", select: "role status" } })
    .lean();

  const assigned = tasks.filter((t) => {
    const user = t.personnel?.user;
    return user && user.role === "Farmer" && user.status === "Active" && t.personnel.status !== "Inactive";
  });
  if (!assigned.length) return { day, sent: 0, skipped: 0 };

  // Which of these tasks are already done (and so need no action today)?
  // Primary: today's occurrence is Completed. Secondary: its one lifetime
  // occurrence is Completed (whatever day it was submitted).
  const ids = assigned.map((t) => t._id);
  const secondaryIds = assigned.filter((t) => (t.category || "Secondary") === "Secondary").map((t) => t._id);
  const completed = await TaskOccurrence.find({
    task: { $in: ids },
    status: "Completed",
    $or: [{ occurrenceDate: day }, { task: { $in: secondaryIds } }],
  })
    .select("task occurrenceDate")
    .lean();
  const doneToday = new Set(completed.filter((o) => o.occurrenceDate === day).map((o) => String(o.task)));
  const doneEver = new Set(completed.map((o) => String(o.task)));

  const isDone = (task) =>
    (task.category || "Secondary") === "Primary"
      ? doneToday.has(String(task._id))
      : task.status === "Completed" || doneEver.has(String(task._id));

  const pending = assigned.filter((t) => !isDone(t));
  const skipped = assigned.length - pending.length;

  // Reminders already sent today (by an earlier run, or before a restart).
  const wanted = pending.map((t) => reminderSourceId(t._id, t.personnel.user._id, day));
  const already = new Set(
    (await Notification.find({ sourceId: { $in: wanted } }).select("sourceId").lean()).map((n) => n.sourceId)
  );

  let sent = 0;
  for (const task of pending) {
    const userId = task.personnel.user._id;
    const sourceId = reminderSourceId(task._id, userId, day);
    if (already.has(sourceId)) continue;
    const created = await createNotification({
      title: REMINDER_TITLE,
      description: reminderDescription(task, task.category || "Secondary", day),
      category: "task",
      type: "reminder",
      userId,
      referenceId: task._id,
      referenceModel: "PersonnelTask",
      sourceId,
    });
    if (created) sent++;
  }
  return { day, sent, skipped };
}

// Runs at most one pass at a time (an hourly tick and a reconnect can fire
// together); a second caller just waits for the pass already in progress.
async function runDailyTaskReminders(trigger = "manual") {
  if (running) return running;
  running = (async () => {
    try {
      return await sendDailyTaskReminders(phToday());
    } finally {
      running = null;
    }
  })();
  const result = await running;
  if (trigger !== "test" && result.sent) {
    console.log(`Daily task reminders (${trigger}): ${result.sent} sent for ${result.day}.`);
  }
  return result;
}

module.exports = { runDailyTaskReminders, reminderSourceId, REMINDER_TITLE };