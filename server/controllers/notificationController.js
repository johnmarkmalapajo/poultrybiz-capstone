const Notification = require("../models/Notification");

// Categories a Farmer is allowed to see — mirrors
// client/src/notifStore.js's FARMER_ALLOWED_CATEGORIES. Enforced here
// server-side too, since the backend must never send a Farmer a
// notification outside their role (frontend filtering alone isn't
// sufficient access control).
const FARMER_ALLOWED_CATEGORIES = [
  "egg", "feed", "health", "mortality", "quarantine", "isolation",
  "equipment", "age", "task", "todo",
];

const createNotification = async ({
  title,
  description,
  category,
  type = "alert",
  priority = "Normal",
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

    return await Notification.create({
      title,
      description,
      category,
      type,
      priority,
      roles,
      userId,
      referenceId,
      referenceModel,
      sourceId,
    });
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

    const records = notifications.map((n) => ({
      id: n._id,
      title: n.title,
      description: n.description,
      category: n.category,
      type: n.type,
      priority: String(n.priority).toLowerCase(), // Critical/Warning/Normal -> critical/warning/normal
      read: n.read,
      roles: n.roles,
      dateTime: n.createdAt,
      referenceId: n.referenceId,
      referenceModel: n.referenceModel,
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