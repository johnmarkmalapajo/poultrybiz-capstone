const cron = require("node-cron");
const Flock = require("../models/Flock");
const EggRecord = require("../models/EggRecord");
const HealthRecord = require("../models/HealthRecord");
const QuarantineIsolation = require("../models/QuarantineIsolation");
const Equipment = require("../models/Equipment");
const PersonnelTask = require("../models/PersonnelTask");
const Personnel = require("../models/Personnel");
const User = require("../models/User");
const { createNotification } = require("../controllers/notificationController");

const ALL_ROLES = ["Owner", "Farmer"];
const todayStr = () => new Date().toISOString().slice(0, 10);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function eggProductionCheck({ stage, title, message, priority, isFinalAlert }) {
  const batches = await Flock.find({ status: "Active" }).select("batchId");
  const start = startOfToday();
  const end = endOfToday();

  for (const flock of batches) {
    const hasRecordToday = await EggRecord.exists({
      batchId: flock.batchId,
      collectionDate: { $gte: start, $lte: end },
      isArchived: false,
    });
    if (hasRecordToday) continue;

    await createNotification({
      title,
      description: message(flock.batchId),
      category: "egg",
      type: isFinalAlert ? "alert" : "reminder",
      priority,
      roles: ALL_ROLES,
      sourceId: `egg_${stage}_${flock.batchId}_${todayStr()}`,
    });
  }
}

async function vaccinationCheck() {
  const due = await HealthRecord.find({
    recordType: "Vaccination",
    archived: false,
    nextSchedule: { $lte: endOfToday() },
  });

  for (const rec of due) {
    if (!rec.nextSchedule) continue;
    const overdue = new Date(rec.nextSchedule) < startOfToday();
    await createNotification({
      title: overdue ? "Vaccination Overdue" : "Vaccination Due Today",
      description: `Vaccination due for Batch ${rec.batchId} on ${new Date(rec.nextSchedule).toLocaleDateString()}.`,
      category: "health",
      type: "reminder",
      priority: "Low",
      roles: ALL_ROLES,
      sourceId: `vax_${rec.batchId}_${new Date(rec.nextSchedule).toISOString().slice(0, 10)}`,
    });
  }
}

async function diagnosisScheduleCheck() {
  const due = await HealthRecord.find({
    recordType: "Diagnosis",
    archived: false,
    nextSchedule: { $lte: endOfToday() },
  });

  for (const rec of due) {
    if (!rec.nextSchedule) continue;
    await createNotification({
      title: "Diagnosis Follow-up Due",
      description: `Diagnosis follow-up for Batch ${rec.batchId} is due.`,
      category: "health",
      type: "reminder",
      priority: "Low",
      roles: ALL_ROLES,
      sourceId: `diag_${rec.batchId}_${new Date(rec.nextSchedule).toISOString().slice(0, 10)}`,
    });
  }
}

async function quarantineCheck() {
  const ready = await QuarantineIsolation.find({
    recordType: "Quarantine",
    status: "Ongoing",
    archived: false,
    releasedDate: { $lte: endOfToday() },
  });

  for (const rec of ready) {
    await createNotification({
      title: "Quarantine Completed",
      description: `The 7-day quarantine period for Batch ${rec.batchId} has ended. Please review the batch and change its quarantine status from Ongoing to Released.`,
      category: "quarantine",
      type: "reminder",
      priority: "Low",
      roles: ALL_ROLES,
      sourceId: `quarantine_${rec._id}`,
    });
  }
}

async function equipmentCheck() {
  const poor = await Equipment.find({ condition: "Poor", archived: false });

  for (const eq of poor) {
    await createNotification({
      title: "Equipment Maintenance Due",
      description: `${eq.name} at ${eq.location} is in Poor condition and needs maintenance.`,
      category: "equipment",
      type: "reminder",
      priority: "Normal",
      roles: ALL_ROLES,
      sourceId: `equipment_${eq._id}_poor`,
    });
  }
}

async function taskDueCheck() {
  const tasks = await PersonnelTask.find({
    status: "Pending",
    dueDate: { $lte: endOfToday() },
  }).populate({ path: "personnel", populate: { path: "user", select: "name" } });

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const overdue = new Date(task.dueDate) < startOfToday();
    const farmerUserId = task.personnel?.user?._id;

    await createNotification({
      title: overdue ? "Task Overdue" : "Task Due Today",
      description: `"${task.work}" is ${overdue ? "overdue" : "due today"} (${new Date(task.dueDate).toLocaleDateString()}).`,
      category: "todo",
      type: "reminder",
      priority: overdue ? "High" : "Normal",
      userId: farmerUserId || null,
      sourceId: `task_due_${task._id}_farmer_${todayStr()}`,
    });

    await createNotification({
      title: overdue ? "Task Overdue" : "Task Due Today",
      description: `"${task.work}" (assigned to ${task.personnel?.user?.name || "a Farmer"}) is ${overdue ? "overdue" : "due today"} (${new Date(task.dueDate).toLocaleDateString()}).`,
      category: "todo",
      type: "reminder",
      priority: overdue ? "High" : "Normal",
      roles: ["Owner"],
      sourceId: `task_due_${task._id}_mgmt_${todayStr()}`,
    });
  }
}

async function cullingEligibilityCheck() {
  const LIFECYCLE_MONTHS = 24;
  const PR_CULL_THRESHOLD = 60;

  const batches = await Flock.find({ status: "Active" });

  for (const flock of batches) {
    const ageMonths = flock.dateAcquired
      ? Math.floor((Date.now() - new Date(flock.dateAcquired)) / (1000 * 60 * 60 * 24 * 30))
      : 0;

    const latestEgg = await EggRecord.findOne({ batchId: flock.batchId, isArchived: false })
      .sort({ collectionDate: -1 })
      .select("totalEggs");
    const pr = flock.currentQuantity > 0 && latestEgg
      ? (latestEgg.totalEggs / flock.currentQuantity) * 100
      : 100;

    const reasons = [];
    if (ageMonths >= LIFECYCLE_MONTHS) reasons.push(`Reached ${LIFECYCLE_MONTHS}-month lifecycle`);
    if (pr < PR_CULL_THRESHOLD) reasons.push(`Productivity Rate below ${PR_CULL_THRESHOLD}%`);

    if (reasons.length > 0) {
      await createNotification({
        title: "Batch Eligible for Culling",
        description: `Batch ${flock.batchId} is eligible for culling: ${reasons.join(", ")}.`,
        category: "age",
        type: "reminder",
        priority: "Normal",
        roles: ALL_ROLES,
        sourceId: `cull_eligible_${flock.batchId}_${todayStr()}`,
      });
    }
  }
}

async function pendingApprovalCheck() {
  const count = await User.countDocuments({ status: "Pending" });
  if (count > 0) {
    await createNotification({
      title: "Pending Farmer Approval",
      description: `${count} new Farmer account(s) waiting for Owner approval.`,
      category: "users",
      type: "alert",
      priority: "Normal",
      roles: ["Owner"],
      sourceId: `pending_approval_${todayStr()}`,
    });
  }
}

function registerNotificationCronJobs() {
  cron.schedule("0 10 * * *", () =>
    eggProductionCheck({
      stage: "reminder1",
      title: "Egg Production Reminder",
      message: (batchId) => `Egg production has not yet been recorded today for Batch ${batchId}.`,
      priority: "Low",
    }).catch((e) => console.error("Egg reminder (10AM) failed:", e))
  );

  cron.schedule("0 14 * * *", () =>
    eggProductionCheck({
      stage: "reminder2",
      title: "Egg Production Reminder",
      message: (batchId) => `Reminder: egg production for Batch ${batchId} has not yet been recorded today.`,
      priority: "Low",
    }).catch((e) => console.error("Egg reminder (2PM) failed:", e))
  );

  cron.schedule("0 18 * * *", () =>
    eggProductionCheck({
      stage: "reminder3",
      title: "Final Egg Production Reminder",
      message: (batchId) => `Final reminder: please record today's egg production for Batch ${batchId}.`,
      priority: "Normal",
    }).catch((e) => console.error("Egg reminder (6PM) failed:", e))
  );

  cron.schedule("59 23 * * *", () =>
    eggProductionCheck({
      stage: "alert",
      title: "Egg Production Not Recorded",
      message: (batchId) => `Egg production has not been recorded today for Batch ${batchId}.`,
      priority: "Normal",
      isFinalAlert: true,
    }).catch((e) => console.error("Egg alert (11:59PM) failed:", e))
  );

  cron.schedule("0 1 * * *", async () => {
    const jobs = [
      pendingApprovalCheck,
      vaccinationCheck,
      diagnosisScheduleCheck,
      quarantineCheck,
      equipmentCheck,
      taskDueCheck,
      cullingEligibilityCheck,
    ];
    for (const job of jobs) {
      try {
        await job();
      } catch (e) {
        console.error(`Notification cron job "${job.name}" failed:`, e);
      }
    }
  });

  console.log("Notification cron jobs registered.");
}

module.exports = { registerNotificationCronJobs };