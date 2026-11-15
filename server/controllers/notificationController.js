const Notification = require("../models/Notification");

const {
  sendNotificationEmail,
  FARMER_ALLOWED_CATEGORIES,
} = require("../utils/notificationEmail");

// FARMER_ALLOWED_CATEGORIES (shared with utils/notificationEmail.js) lists the
// categories a Farmer may see. Enforced server-side for both the in-system
// list and the email copy, since frontend filtering alone isn't sufficient
// access control.

// Task-completion notifications open Personnel -> Task History for the
// Farmer who submitted, with the exact submission highlighted:
//   /personnel-visitors/personnel/view/<personnelId>?tab=history&submission=<occurrenceId>
//   - new ones reference the completed TaskOccurrence (the submission);
//   - older ones reference the PersonnelTask; they open that task's latest
//     submission made up to the notification's time.
// Resolved with a few batched reads; nothing is stored.
const COMPLETED_TASK_TITLE = /Task Completed$/;

async function taskHistoryLinks(notifications) {
  const links = new Map();
  const isCompletion = (n) => n.category === "task" && n.referenceId && COMPLETED_TASK_TITLE.test(n.title || "");
  const completions = notifications.filter(isCompletion);
  if (!completions.length) return links;

  // Required here (not at the top) to keep this controller free of any
  // load-order coupling with the task modules.
  const TaskOccurrence = require("../models/TaskOccurrence");
  const PersonnelTask = require("../models/PersonnelTask");
  const historyLink = (personnelId, occurrenceId) =>
    `/personnel-visitors/personnel/view/${personnelId}?tab=history${occurrenceId ? `&submission=${occurrenceId}` : ""}`;

  const byOccurrence = completions.filter((n) => n.referenceModel === "TaskOccurrence");
  if (byOccurrence.length) {
    const occs = await TaskOccurrence.find({ _id: { $in: byOccurrence.map((n) => n.referenceId) } })
      .select("personnel")
      .lean();
    const personnelOf = new Map(occs.map((o) => [String(o._id), o.personnel]));
    for (const n of byOccurrence) {
      const personnelId = personnelOf.get(String(n.referenceId));
      if (personnelId) links.set(String(n._id), historyLink(personnelId, n.referenceId));
    }
  }

  const byTask = completions.filter((n) => n.referenceModel === "PersonnelTask");
  if (byTask.length) {
    const tasks = await PersonnelTask.find({ _id: { $in: byTask.map((n) => n.referenceId) } })
      .select("personnel")
      .lean();
    const personnelOf = new Map(tasks.map((t) => [String(t._id), t.personnel]));
    for (const n of byTask) {
      const personnelId = personnelOf.get(String(n.referenceId));
      if (!personnelId) continue;
      const latest = await TaskOccurrence.findOne({
        task: n.referenceId,
        status: "Completed",
        submittedAt: { $lte: n.createdAt },
      })
        .sort({ submittedAt: -1 })
        .select("_id")
        .lean();
      links.set(String(n._id), historyLink(personnelId, latest?._id));
    }
  }

  return links;
}

// ── Every notification's View destination ────────────────────────────────
//
// One place decides where View goes, for every notification category, so
// the client never guesses. Each link names the module's page plus the
// record's DATABASE id; the page finds that row (switching tab, clearing its
// search / filters and paging as needed) and highlights it -- the shared
// useRecordFocus hook, generalized from the original Quarantine behavior:
//   /records/quarantine?record=<id>     Quarantine + Isolation records
//   /records/mortality?record=<id>      /records/egg?record=<id>
//   /records/health?record=<id>         /records/flock?record=<id> (Owner)
//   /inventory/equipment?record=<id>    /personnel-visitors/visitors?record=<id>
//   /users-roles?record=<id>            /inventory/feed-inventory?feed=<type>
//   /todo?task=<id> (Farmer) | /owner/todo?task=<id> (Owner)
//   /personnel-visitors/personnel/view/<personnel>?tab=attendance&record=<id>
//   Task History (completed submissions) -- taskHistoryLinks above.
// Older notifications saved before they carried a referenceId are resolved
// from their sourceId / text where that identifies the record. Pages the
// user's role cannot open get no link (the client then uses the category's
// module page, as before, or stays put).
const RECORD_PAGES = {
  QuarantineIsolation: "/records/quarantine",
  MortalityRecord: "/records/mortality",
  EggRecord: "/records/egg",
  HealthRecord: "/records/health",
  Equipment: "/inventory/equipment",
  Visitor: "/personnel-visitors/visitors",
  User: "/users-roles",
  Flock: "/records/flock",
};
const OWNER_ONLY_PAGES = new Set([
  "/personnel-visitors/visitors",
  "/users-roles",
  "/records/flock",
  "/owner/todo",
]);

const feedTypeFrom = (n) => {
  const text = n.description || "";
  const m = text.match(/^(.+?) stock is (?:empty|low)/) || text.match(/ of (.+?) \(batch /);
  return m ? m[1].trim() : null;
};

async function notificationLinks(notifications, role) {
  const links = await taskHistoryLinks(notifications);
  const isOwner = role === "Owner";
  const todoPage = isOwner ? "/owner/todo" : "/todo";
  const allowed = (path) => isOwner || !OWNER_ONLY_PAGES.has(path);
  const recordLink = (model, id) => {
    const page = RECORD_PAGES[model];
    return page && allowed(page) ? `${page}?record=${id}` : null;
  };

  const legacyFlockBatches = new Map(); // notification id -> batchId
  const attendanceIds = new Map(); // notification id -> attendance id

  for (const n of notifications) {
    const key = String(n._id);
    if (links.has(key)) continue;
    const ref = n.referenceId ? String(n.referenceId) : null;
    const src = n.sourceId || "";
    let link = null;

    if (ref && RECORD_PAGES[n.referenceModel]) {
      link = recordLink(n.referenceModel, ref);
    } else if (ref && (n.referenceModel === "PersonnelTask" || n.referenceModel === "PersonalTodo")) {
      link = `${todoPage}?task=${ref}`;
    } else if (ref && n.referenceModel === "Attendance") {
      if (isOwner) attendanceIds.set(key, ref);
    } else if (n.category === "feed") {
      const feedType = feedTypeFrom(n);
      link = `/inventory/feed-inventory${feedType ? `?feed=${encodeURIComponent(feedType)}` : ""}`;
    } else if (/^equipment_[0-9a-f]{24}_/.test(src)) {
      link = recordLink("Equipment", src.split("_")[1]);
    } else if (/^task_due_[0-9a-f]{24}_/.test(src)) {
      link = `${todoPage}?task=${src.split("_")[2]}`;
    } else if (/^cull_eligible_/.test(src) && isOwner) {
      legacyFlockBatches.set(key, src.replace(/^cull_eligible_/, "").replace(/_\d{4}-\d{2}-\d{2}$/, ""));
    }

    if (link) links.set(key, link);
  }

  if (legacyFlockBatches.size) {
    const Flock = require("../models/Flock");
    const flocks = await Flock.find({ batchId: { $in: [...new Set(legacyFlockBatches.values())] } })
      .select("batchId")
      .lean();
    const idOf = new Map(flocks.map((f) => [f.batchId, String(f._id)]));
    for (const [key, batchId] of legacyFlockBatches) {
      if (idOf.has(batchId)) links.set(key, recordLink("Flock", idOf.get(batchId)));
    }
  }

  if (attendanceIds.size) {
    const Attendance = require("../models/Attendance");
    const rows = await Attendance.find({ _id: { $in: [...attendanceIds.values()] } }).select("personnel").lean();
    const personnelOf = new Map(rows.map((a) => [String(a._id), a.personnel]));
    for (const [key, attendanceId] of attendanceIds) {
      const personnelId = personnelOf.get(attendanceId);
      if (personnelId) {
        links.set(key, `/personnel-visitors/personnel/view/${personnelId}?tab=attendance&record=${attendanceId}`);
      }
    }
  }

  return links;
}

const createNotification = async ({
  title,
  description,
  category,
  type = "alert",
  roles = [],
  userId = null,
  referenceId = null,
  referenceModel = "",
  sourceId = null,
}) => {
  try {
    // Dedup guard for scheduled/cron-based checks: if this exact
    // condition (same sourceId) already has a notification, don't create
    // a second one — otherwise re-running the cron daily would spam
    // duplicates for a condition that's still true.
    if (sourceId) {
      const existing = await Notification.findOne({ sourceId });
      if (existing) return existing;
    }

    const notification = await Notification.create({
      title,
      description,
      category,
      type,
      roles,
      userId,
      referenceId,
      referenceModel,
      sourceId,
    });

    // Email copy of the same notification, to the same recipients. Not awaited
    // on purpose: sending mail must never slow down or break the request/cron
    // job that triggered it (sendNotificationEmail never throws).
    sendNotificationEmail(notification);

    return notification;
  } catch (error) {
    console.error("Create Notification Error:", error);
  }
};
exports.getNotifications = async (req, res) => {
  try {
    // Personal notifications (userId set) only ever go to that exact
    // person. Broadcast notifications (userId null) go to everyone whose
    // role is in `roles`, or to everyone if `roles` is empty.
    const filter = req.user
      ? {
          $or: [
            { userId: req.user.id },
            { userId: null, roles: { $size: 0 } },
            { userId: null, roles: req.user.role },
          ],
        }
      : {};

    // A Farmer never receives a notification outside their allowed
    // categories, no matter what `roles`/`userId` say — enforced here so
    // the frontend never even receives it (not just hides it).
    if (req.user?.role === "Farmer") {
      filter.category = { $in: FARMER_ALLOWED_CATEGORIES };
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 });

    const links = await notificationLinks(notifications, req.user?.role);

    const records = notifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.description,
      category: n.category,
      type: n.type,
      read: n.read,
      roles: n.roles,
      dateTime: n.createdAt,
      referenceId: n.referenceId,
      referenceModel: n.referenceModel,
      // Where the notification's View opens, when it is more specific than
      // the category's default page (null otherwise).
      link: links.get(String(n._id)) || null,
    }));

    res.status(200).json({
      success: true,
      notifications: records,
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load notifications.",
    });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      {
        read: req.body.read ?? true,
      },
      {
        new: true,
      }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    res.status(200).json({
      success: true,
      notification,
    });

  } catch (error) {
    console.error("Mark Notification Read Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to update notification.",
    });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {},
      { $set: { read: true } }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });

  } catch (error) {
    console.error("Mark All Notifications Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to mark all notifications as read.",
    });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully.",
    });

  } catch (error) {
    console.error("Delete Notification Error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to delete notification.",
    });
  }
};

module.exports = {
  createNotification,
  getNotifications: exports.getNotifications,
  markNotificationRead: exports.markNotificationRead,
  markAllNotificationsRead: exports.markAllNotificationsRead,
  deleteNotification: exports.deleteNotification,
};