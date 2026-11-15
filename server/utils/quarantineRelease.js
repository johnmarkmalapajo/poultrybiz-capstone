// Quarantine release eligibility and release reminders.
//
// A Quarantine record is released ONLY by the Owner, from the Status action
// on the Quarantine table (controllers/quarantineIsolationController.js ->
// releaseQuarantineRecord). Nothing here ever changes a record's status.
//
//   - The quarantine starts on the Flock Profile's Date Acquired, which is
//     DAY 1, and lasts QUARANTINE_DAYS (14) Philippine (Asia/Manila) calendar
//     days (see utils/dateGuard.js). Day 14 -- the expected release date, when
//     the Owner may release -- is start date + 13 days; Day 13 is the day
//     before it; Day 15 onward is overdue while still not released.
//   - From the expected release date onward the Owner may release the batch.
//     Before it, the backend refuses the release.
//   - Reminders go to the Owner and the Farmers (the people who look after
//     the batch), once per event:
//       * the day before the expected release date  -> "upcoming"
//       * on the expected release date               -> "eligible"
//       * every day after it while still Ongoing     -> "overdue"
//     Each one has a fixed sourceId, so running the job again (hourly, on
//     restart, after a reconnect) never creates a duplicate.

const mongoose = require("mongoose");
const QuarantineIsolation = require("../models/QuarantineIsolation");
const Flock = require("../models/Flock");
const { createNotification } = require("../controllers/notificationController");
const {
  QUARANTINE_DAYS,
  QUARANTINE_STATES,
  phToday,
  addDays,
  toDay,
  daysBetween,
  quarantineReleaseDate,
  quarantineReleaseState,
} = require("./dateGuard");

// Same definition of "still in isolation" used elsewhere in the app
// (mortality batch options): no final status yet, or "In Isolation".
const ONGOING_ISOLATION_STATUSES = ["", "In Isolation"];

// Who receives quarantine reminders. The app has no per-batch farmer
// assignment, so every Farmer account (and the Owner) gets them; Farmers
// already receive the "quarantine" notification category.
const REMINDER_ROLES = ["Owner", "Farmer"];

const hasOngoingIsolation = async (batchId) =>
  !!(await QuarantineIsolation.exists({
    batchId,
    recordType: "Isolation",
    archived: false,
    currentStatus: { $in: ONGOING_ISOLATION_STATUSES },
  }));

// Read-only release details for the Quarantine table (no side effects).
const describeRelease = async (record, startDate) => {
  const expectedReleaseDate = record.expectedReleaseDate || quarantineReleaseDate(startDate);
  const releaseState = quarantineReleaseState({ startDate, status: record.status });
  const isOngoing = record.status === "Ongoing";
  const releaseEligible = isOngoing && !!expectedReleaseDate && phToday() >= expectedReleaseDate;

  let releaseBlockedReason = "";
  if (isOngoing && !expectedReleaseDate) {
    releaseBlockedReason = "The quarantine start date is unknown. Set the Date Acquired in Flock Profile.";
  } else if (isOngoing && !releaseEligible) {
    const daysLeft = daysBetween(phToday(), expectedReleaseDate);
    releaseBlockedReason = `Release is available on ${expectedReleaseDate} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`;
  } else if (releaseEligible && (await hasOngoingIsolation(record.batchId))) {
    releaseBlockedReason = "Complete the ongoing Isolation of this batch before releasing the quarantine.";
  }

  return { expectedReleaseDate, releaseState, releaseEligible, releaseBlockedReason };
};

const reminderFor = (record, expectedReleaseDate, today) => {
  const base = {
    category: "quarantine",
    type: "reminder",
    roles: REMINDER_ROLES,
    referenceId: record._id,
    referenceModel: "QuarantineIsolation",
  };

  if (today === addDays(expectedReleaseDate, -1)) {
    return {
      ...base,
      title: "Quarantine Release Tomorrow",
      description: `Batch ${record.batchId} will complete its ${QUARANTINE_DAYS}-day quarantine period tomorrow. It will be eligible for release on ${expectedReleaseDate}. Please prepare for the quarantine release review.`,
      sourceId: `quarantine_upcoming_${record._id}`,
    };
  }

  if (today === expectedReleaseDate) {
    return {
      ...base,
      title: "Quarantine Release Eligible",
      description: `Batch ${record.batchId} has completed its ${QUARANTINE_DAYS}-day quarantine period and is now eligible for release (expected release date ${expectedReleaseDate}). The Owner must manually process the quarantine release.`,
      sourceId: `quarantine_eligible_${record._id}`,
    };
  }

  if (today > expectedReleaseDate) {
    const daysOverdue = daysBetween(expectedReleaseDate, today);
    return {
      ...base,
      type: "alert",
      title: "Quarantine Release Overdue",
      description: `Batch ${record.batchId} is overdue for quarantine release by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} (expected release date ${expectedReleaseDate}). Its ${QUARANTINE_DAYS}-day quarantine period has been completed. Please remind the Owner to review and manually process its release.`,
      // One overdue reminder per Philippine day.
      sourceId: `quarantine_overdue_${record._id}_${today}`,
    };
  }

  return null;
};

let currentRun = null;

const runQuarantineReleaseReminders = async (trigger = "scheduled") => {
  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: "database not connected" };
  }

  // Never let two runs overlap inside this server process.
  if (currentRun) return currentRun;

  currentRun = (async () => {
    const summary = { trigger, upcoming: 0, eligible: 0, overdue: 0, failed: 0 };
    const today = phToday();

    const ongoing = await QuarantineIsolation.find({
      recordType: "Quarantine",
      status: "Ongoing",
      archived: false,
    });
    if (!ongoing.length) return summary;

    const flocks = await Flock.find({
      batchId: { $in: [...new Set(ongoing.map((r) => r.batchId))] },
    }).select("batchId dateAcquired");
    const startByBatch = new Map(flocks.map((f) => [f.batchId, toDay(f.dateAcquired)]));

    for (const record of ongoing) {
      try {
        const expectedReleaseDate = quarantineReleaseDate(startByBatch.get(record.batchId));
        if (!expectedReleaseDate) continue;

        const reminder = reminderFor(record, expectedReleaseDate, today);
        if (!reminder) continue;

        await createNotification(reminder);
        if (reminder.sourceId.startsWith("quarantine_upcoming_")) summary.upcoming += 1;
        else if (reminder.sourceId.startsWith("quarantine_eligible_")) summary.eligible += 1;
        else summary.overdue += 1;
      } catch (err) {
        summary.failed += 1;
        console.error(`Quarantine release reminder failed for Batch ${record.batchId}:`, err);
      }
    }

    return summary;
  })().finally(() => {
    currentRun = null;
  });

  return currentRun;
};

module.exports = {
  REMINDER_ROLES,
  QUARANTINE_STATES,
  hasOngoingIsolation,
  describeRelease,
  runQuarantineReleaseReminders,
};