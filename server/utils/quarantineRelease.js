// Automatic 14-day quarantine release.
//
// A Quarantine record is released by the server, never by a user:
//   1. The record must be Ongoing, not archived, and its batch must have
//      completed QUARANTINE_DAYS full days counted from the Flock Profile's
//      Date Acquired (the quarantine start date). All "today" comparisons
//      use Philippine time through utils/dateGuard.
//   2. A batch with an ongoing Isolation record is not released yet; it is
//      picked up again on a later run once that Isolation is finished.
//   3. The status change is an atomic compare-and-set (Ongoing -> Released),
//      so only one run can ever release a given record.
//   4. The Flock Profile goes back to Active only when it is still
//      "Quarantined" -- a Culled batch is never reactivated.
//   5. The Owner notification uses a fixed sourceId per record, so it is
//      created once no matter how many times the job runs.
//   6. releaseFinalizedAt marks that steps 4 and 5 finished; a release that
//      was interrupted (e.g. the server stopped mid-run) is completed on the
//      next run instead of being lost.

const mongoose = require("mongoose");
const QuarantineIsolation = require("../models/QuarantineIsolation");
const Flock = require("../models/Flock");
const { createNotification } = require("../controllers/notificationController");
const { createAuditLog } = require("../controllers/auditController");
const {
  QUARANTINE_DAYS,
  phToday,
  quarantineReleaseDate,
  isQuarantineComplete,
} = require("./dateGuard");

// Same definition of "still in isolation" used elsewhere in the app
// (mortality batch options): no final status yet, or "In Isolation".
const ONGOING_ISOLATION_STATUSES = ["", "In Isolation"];

const toDay = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

const formatDay = (day) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

const quarantineStartDate = (flock) => toDay(flock?.dateAcquired);

const hasOngoingIsolation = async (batchId) =>
  !!(await QuarantineIsolation.exists({
    batchId,
    recordType: "Isolation",
    archived: false,
    currentStatus: { $in: ONGOING_ISOLATION_STATUSES },
  }));

// Why an eligible (14 days completed) record cannot be released yet,
// or "" when nothing is blocking it.
const getReleaseBlocker = async (record, flock) => {
  if (!flock) return "The linked Flock Profile was not found.";
  if (await hasOngoingIsolation(record.batchId)) {
    return "Waiting for the ongoing Isolation of this batch to be completed.";
  }
  return "";
};

const flockStatusNote = (status) => {
  if (status === "Active") return "Its Flock Profile status is now Active.";
  if (status === "Culled") return "Its Flock Profile status remains Culled.";
  if (status) return `Its Flock Profile status remains ${status}.`;
  return "No matching Flock Profile was found for this batch.";
};

// Steps that follow the status change. Every step is safe to repeat.
const finalizeRelease = async (record) => {
  const flockUpdate = await Flock.updateOne(
    { batchId: record.batchId, status: "Quarantined" },
    { $set: { status: "Active" } }
  );

  const flock = await Flock.findOne({ batchId: record.batchId }).select("status");

  if (flockUpdate.modifiedCount > 0) {
    await createAuditLog({
      module: "Flock Profile",
      action: "Edited",
      description: `Batch ${record.batchId} status changed from Quarantined to Active after automatic quarantine release.`,
    });
  }

  const releasedOn = record.releasedDate || phToday();

  await createNotification({
    title: "Quarantine Completed: Batch Released",
    description: `The ${QUARANTINE_DAYS}-day quarantine period of Batch ${record.batchId} has ended. The batch was automatically released on ${formatDay(releasedOn)}. ${flockStatusNote(flock?.status)}`,
    category: "quarantine",
    type: "alert",
    priority: "Normal",
    roles: ["Owner"],
    referenceId: record._id,
    referenceModel: "QuarantineIsolation",
    sourceId: `quarantine_released_${record._id}`,
  });

  await QuarantineIsolation.updateOne(
    { _id: record._id, releaseFinalizedAt: null },
    { $set: { releaseFinalizedAt: new Date() } }
  );
};

// Returns "released", "not_due", "blocked" or "skipped".
const releaseIfEligible = async (record, flock) => {
  const start = quarantineStartDate(flock);

  if (!start || !isQuarantineComplete(start)) return "not_due";

  const blocker = await getReleaseBlocker(record, flock);
  if (blocker) return "blocked";

  const releasedDate = phToday();

  const claimed = await QuarantineIsolation.findOneAndUpdate(
    {
      _id: record._id,
      recordType: "Quarantine",
      status: "Ongoing",
      archived: false,
    },
    {
      $set: {
        status: "Released",
        releasedDate,
        releaseMethod: "Automatic",
        releaseFinalizedAt: null,
      },
    },
    { returnDocument: "after" }
  );

  // Another run already released it.
  if (!claimed) return "skipped";

  await createAuditLog({
    module: "Quarantine & Isolation",
    action: "Edited",
    description: `Batch ${claimed.batchId} was automatically released from quarantine after completing the ${QUARANTINE_DAYS}-day period (started ${formatDay(start)}).`,
  });

  await finalizeRelease(claimed);

  return "released";
};

let currentRun = null;

const runQuarantineAutoRelease = async (trigger = "scheduled") => {
  if (mongoose.connection.readyState !== 1) {
    return { skipped: true, reason: "database not connected" };
  }

  // Never let two runs overlap inside this server process.
  if (currentRun) return currentRun;

  currentRun = (async () => {
    const summary = { trigger, released: 0, blocked: 0, finalized: 0, failed: 0 };

    // 1. Finish releases that were interrupted before their notification.
    const unfinished = await QuarantineIsolation.find({
      recordType: "Quarantine",
      status: "Released",
      releaseMethod: "Automatic",
      releaseFinalizedAt: null,
    });

    for (const record of unfinished) {
      try {
        await finalizeRelease(record);
        summary.finalized += 1;
      } catch (err) {
        summary.failed += 1;
        console.error(`Quarantine auto-release: could not finish Batch ${record.batchId}:`, err);
      }
    }

    // 2. Release every Ongoing record that has completed its 14 days,
    //    including records that became due while the server was down.
    const ongoing = await QuarantineIsolation.find({
      recordType: "Quarantine",
      status: "Ongoing",
      archived: false,
    });

    if (ongoing.length) {
      const flocks = await Flock.find({
        batchId: { $in: [...new Set(ongoing.map((r) => r.batchId))] },
      }).select("batchId status dateAcquired");

      const flockByBatch = new Map(flocks.map((f) => [f.batchId, f]));

      for (const record of ongoing) {
        try {
          const result = await releaseIfEligible(record, flockByBatch.get(record.batchId));
          if (result === "released") summary.released += 1;
          if (result === "blocked") summary.blocked += 1;
        } catch (err) {
          summary.failed += 1;
          console.error(`Quarantine auto-release failed for Batch ${record.batchId}:`, err);
        }
      }
    }

    if (summary.released || summary.finalized || summary.failed) {
      console.log(
        `Quarantine auto-release (${trigger}): ${summary.released} released, ${summary.finalized} finished, ${summary.blocked} waiting on isolation, ${summary.failed} failed.`
      );
    }

    return summary;
  })().finally(() => {
    currentRun = null;
  });

  return currentRun;
};

// Read-only details for the Quarantine table (no side effects).
const describeAutoRelease = async (record, startDate) => {
  const autoReleaseDate = quarantineReleaseDate(startDate);
  let releaseBlockedReason = "";

  if (record.status === "Ongoing" && isQuarantineComplete(startDate)) {
    if (await hasOngoingIsolation(record.batchId)) {
      releaseBlockedReason = "Waiting for the ongoing Isolation of this batch to be completed.";
    }
  }

  return { autoReleaseDate, releaseBlockedReason };
};

module.exports = {
  runQuarantineAutoRelease,
  releaseIfEligible,
  finalizeRelease,
  describeAutoRelease,
  hasOngoingIsolation,
};