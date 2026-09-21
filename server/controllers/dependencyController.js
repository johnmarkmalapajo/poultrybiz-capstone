// controllers/dependencyController.js
//
// Global dependency-check system for Permanent Delete, per the
// "SAFE PERMANENT DELETE VALIDATION" spec. Before any record is
// permanently deleted, the backend scans every collection that could
// reference it and returns a structured summary. If anything is
// connected, Permanent Delete is blocked and Archive is recommended
// instead.
//
// NOTE ON COVERAGE: this file wires up dependency checks for the three
// record types that are actually linked to other collections in this
// schema — User, Personnel, and Flock. Sales, Expense, Feed, Mortality,
// Health, Manure, and Quarantine records don't currently store a
// "createdBy"/owner reference at all (they're farm-wide operational
// logs, not attributed to a specific person or batch beyond Flock's
// batchId), so there's nothing in the data model for those to check
// FOR THEMSELVES as delete targets. Extending this to a new record type
// is just adding one more entry to CHECKERS below, following the same
// pattern.

const Personnel = require("../models/Personnel");
const PersonnelTask = require("../models/PersonnelTask");
const Attendance = require("../models/Attendance");
const PersonalTodo = require("../models/PersonalTodo");
const Notification = require("../models/Notification");
const AuditLog = require("../models/AuditLog");
const EggRecord = require("../models/EggRecord");
const Flock = require("../models/Flock");
const FeedConsumption = require("../models/FeedConsumption");
const MortalityRecord = require("../models/MortalityRecord");
const HealthRecord = require("../models/HealthRecord");
const ManureRecord = require("../models/ManureRecord");
const QuarantineIsolation = require("../models/QuarantineIsolation");

// Each checker returns an array of { module, moduleKey, count, filterKey,
// filterValue, path } — `path` is where "View Connected Records" should
// navigate, pre-filtered.
const CHECKERS = {
  // ── User & Roles ──
  user: async (userId) => {
    const results = [];

    const personnel = await Personnel.findOne({ user: userId });

    const [attendanceCount, personalTodoCount, notificationCount, eggCreatedCount, flockCreatedCount, auditLogCount] =
      await Promise.all([
        Attendance.countDocuments({ user: userId }),
        PersonalTodo.countDocuments({ user: userId }),
        Notification.countDocuments({ userId }),
        EggRecord.countDocuments({ createdBy: userId }),
        Flock.countDocuments({ createdBy: userId }),
        // AuditLog stores the actor's name as plain text, not a
        // reference — matched by name as a best effort.
        (async () => {
          const u = await require("../models/User").findById(userId).select("name");
          return u ? AuditLog.countDocuments({ user: u.name }) : 0;
        })(),
      ]);

    if (personnel) {
      const taskCount = await PersonnelTask.countDocuments({ personnel: personnel._id });
      if (taskCount > 0) {
        results.push({ module: "Tasks", moduleKey: "tasks", count: taskCount, path: `/personnel-visitors/personnel/view/${personnel._id}` });
      }
      results.push({ module: "Personnel & Manpower", moduleKey: "pb_personnel", count: 1, path: `/personnel-visitors/personnel/view/${personnel._id}` });
    }

    if (attendanceCount > 0) results.push({ module: "Attendance", moduleKey: "attendance", count: attendanceCount, path: personnel ? `/personnel-visitors/personnel/view/${personnel._id}` : null });
    if (personalTodoCount > 0) results.push({ module: "Personal To-Do", moduleKey: "personal_todo", count: personalTodoCount, path: null });
    if (notificationCount > 0) results.push({ module: "Notifications", moduleKey: "notifications", count: notificationCount, path: null });
    if (eggCreatedCount > 0) results.push({ module: "Egg Records", moduleKey: "pb_eggs", count: eggCreatedCount, path: "/egg-records" });
    if (flockCreatedCount > 0) results.push({ module: "Flock Profile", moduleKey: "pb_batches", count: flockCreatedCount, path: "/flock-profile" });
    if (auditLogCount > 0) results.push({ module: "Audit Logs", moduleKey: "audit_logs", count: auditLogCount, path: "/audit-logs" });

    return results;
  },

  // ── Personnel & Manpower ──
  personnel: async (personnelId) => {
    const results = [];
    const [attendanceCount, taskCount] = await Promise.all([
      Attendance.countDocuments({ personnel: personnelId }),
      PersonnelTask.countDocuments({ personnel: personnelId }),
    ]);

    if (attendanceCount > 0) {
      results.push({ module: "Attendance", moduleKey: "attendance", count: attendanceCount, path: `/personnel-visitors/personnel/view/${personnelId}` });
    }
    if (taskCount > 0) {
      results.push({ module: "Tasks", moduleKey: "tasks", count: taskCount, path: `/personnel-visitors/personnel/view/${personnelId}` });
    }

    return results;
  },

  // ── Flock Profile ──
  flock: async (flockId) => {
    const flock = await Flock.findById(flockId).select("batchId");
    if (!flock) return [];
    const batchId = flock.batchId;

    const [egg, feedConsumption, mortality, health, manure, quarantine] = await Promise.all([
      EggRecord.countDocuments({ flock: flockId }),
      FeedConsumption.countDocuments({ batchId }),
      MortalityRecord.countDocuments({ batchId }),
      HealthRecord.countDocuments({ batchId }),
      ManureRecord.countDocuments({ batchId }),
      QuarantineIsolation.countDocuments({ batchId }),
    ]);

    const results = [];
    if (egg > 0) results.push({ module: "Egg Records", moduleKey: "pb_eggs", count: egg, path: `/egg-records?batch=${encodeURIComponent(batchId)}` });
    if (feedConsumption > 0) results.push({ module: "Feed Consumption", moduleKey: "pb_feed_consumption", count: feedConsumption, path: `/feed-consumption?batch=${encodeURIComponent(batchId)}` });
    if (mortality > 0) results.push({ module: "Mortality Records", moduleKey: "pb_mortality", count: mortality, path: `/mortality-records?batch=${encodeURIComponent(batchId)}` });
    if (health > 0) results.push({ module: "Health Records (Vaccination/Disease)", moduleKey: "pb_health", count: health, path: `/health-records?batch=${encodeURIComponent(batchId)}` });
    if (manure > 0) results.push({ module: "Manure & Waste Records", moduleKey: "pb_waste", count: manure, path: `/manure-waste?batch=${encodeURIComponent(batchId)}` });
    if (quarantine > 0) results.push({ module: "Quarantine & Isolation", moduleKey: "pb_isolation", count: quarantine, path: `/quarantine-isolation?batch=${encodeURIComponent(batchId)}` });

    return results;
  },
};

// GET /api/v1/dependencies/:type/:id
exports.checkDependencies = async (req, res) => {
  try {
    const { type, id } = req.params;
    const checker = CHECKERS[type];

    if (!checker) {
      return res.status(400).json({
        success: false,
        message: `No dependency checker registered for "${type}".`,
      });
    }

    const connections = await checker(id);
    const totalRecords = connections.reduce((sum, c) => sum + c.count, 0);

    res.json({
      success: true,
      hasDependencies: connections.length > 0,
      totalRecords,
      connections,
    });
  } catch (err) {
    console.error("Dependency Check Error:", err);
    res.status(500).json({
      success: false,
      message: "Unable to check dependencies.",
    });
  }
};

// Reusable server-side guard — call this at the top of any permanent
// delete controller before actually deleting. Throws (via returning a
// truthy blocking response) if dependencies exist, so deletion is never
// possible to bypass by skipping the frontend preview call.
exports.assertNoDependencies = async (type, id) => {
  const checker = CHECKERS[type];
  if (!checker) return null; // no checker registered — allow (nothing to validate against)
  const connections = await checker(id);
  if (connections.length === 0) return null;
  return {
    success: false,
    message: "This record cannot be permanently deleted because it is linked to existing records. Please archive it instead.",
    hasDependencies: true,
    connections,
  };
};
