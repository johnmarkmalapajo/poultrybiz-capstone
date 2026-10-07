// Quarantine rules in one place.
// A newly arrived batch stays in quarantine for QUARANTINE_DAYS (14 days / 2 weeks),
// counted from the date the flock was acquired (day 0). Its status can only be
// changed to "Released" once those days are complete. "Today" is Philippine time.

const QUARANTINE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// Date (or date string) -> YYYY-MM-DD as seen in the Philippines (UTC+8).
const phDateOf = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? "" : new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const phToday = () => phDateOf(new Date());

const daysBetween = (fromStr, toStr) =>
  Math.round((Date.parse(`${toStr}T00:00:00Z`) - Date.parse(`${fromStr}T00:00:00Z`)) / DAY_MS);

const addDays = (dateStr, n) =>
  new Date(Date.parse(`${dateStr}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

// start = YYYY-MM-DD the quarantine began.
const quarantineInfo = (start, today = phToday()) => {
  if (!start) {
    return {
      quarantineDays: QUARANTINE_DAYS,
      quarantineStartDate: "",
      quarantineEndDate: "",
      daysElapsed: 0,
      daysRemaining: QUARANTINE_DAYS,
      canRelease: false,
    };
  }
  const elapsed = Math.max(0, daysBetween(start, today));
  return {
    quarantineDays: QUARANTINE_DAYS,
    quarantineStartDate: start,
    quarantineEndDate: addDays(start, QUARANTINE_DAYS),
    daysElapsed: elapsed,
    daysRemaining: Math.max(0, QUARANTINE_DAYS - elapsed),
    canRelease: elapsed >= QUARANTINE_DAYS,
  };
};

// Start date for a quarantine record: the flock's acquired date, else the day the record was created.
const quarantineStartOf = (record, flockDateAcquired) => {
  if (flockDateAcquired) {
    const d = flockDateAcquired instanceof Date ? flockDateAcquired : new Date(flockDateAcquired);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  if (record && record.dateAcquired) {
    const s = String(record.dateAcquired).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  return record && record.createdAt ? phDateOf(record.createdAt) : "";
};

// Creates the "ready to release" notification for every Ongoing quarantine that has completed
// its period. Safe to call repeatedly: createNotification de-duplicates on sourceId.
// Called by the daily cron AND whenever the quarantine list / notifications are opened, so it
// still works when the (free-tier) server was asleep at the scheduled time.
const notifyReadyQuarantines = async () => {
  const QuarantineIsolation = require("../models/QuarantineIsolation");
  const Flock = require("../models/Flock");
  const { createNotification } = require("../controllers/notificationController");

  const ongoing = await QuarantineIsolation.find({
    recordType: "Quarantine",
    status: "Ongoing",
    archived: false,
  });
  if (!ongoing.length) return 0;

  const flocks = await Flock.find({ batchId: { $in: ongoing.map((r) => r.batchId) } }).select("batchId dateAcquired");
  const byBatch = new Map(flocks.map((f) => [f.batchId, f.dateAcquired]));

  let created = 0;
  for (const rec of ongoing) {
    const info = quarantineInfo(quarantineStartOf(rec, byBatch.get(rec.batchId)));
    if (!info.canRelease) continue;
    await createNotification({
      title: "Quarantine Completed - Ready for Release",
      description: `Batch ${rec.batchId} has completed its ${QUARANTINE_DAYS}-day quarantine (started ${info.quarantineStartDate}). It can now be released: open Quarantine & Isolation and change its status from Ongoing to Released.`,
      category: "quarantine",
      type: "reminder",
      priority: "Normal",
      roles: ["Owner", "Farmer"],
      sourceId: `quarantine_${rec._id}`,
    });
    created += 1;
  }
  return created;
};

module.exports = {
  QUARANTINE_DAYS,
  phDateOf,
  phToday,
  daysBetween,
  addDays,
  quarantineInfo,
  quarantineStartOf,
  notifyReadyQuarantines,
};