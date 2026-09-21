const express = require("express");
const router = express.Router();

const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} = require("../controllers/notificationController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getNotifications);

router.patch("/mark-all-read", protect, markAllNotificationsRead);
router.patch("/:id", protect, markNotificationRead);

router.delete("/:id", protect, deleteNotification);

module.exports = router;