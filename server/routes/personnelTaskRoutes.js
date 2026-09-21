const express = require("express");
const router = express.Router();

const {
  getPersonnelTasks,
  getPersonnelTask,
  createPersonnelTask,
  updatePersonnelTask,
  archivePersonnelTask,
  restorePersonnelTask,
  deletePersonnelTask,
} = require("../controllers/personnelTaskController");

const { protect } = require("../middleware/authMiddleware");

// Get all tasks of a personnel
router.get("/:id/tasks", protect, getPersonnelTasks);

router.get("/:id/tasks/:taskId", protect, getPersonnelTask);

// Create task
router.post("/:id/tasks", protect, createPersonnelTask);

// Update task
router.put("/:id/tasks/:taskId", protect, updatePersonnelTask);

// Archive task
router.put("/:id/tasks/:taskId/archive", protect, archivePersonnelTask);

// Restore task
router.put("/:id/tasks/:taskId/restore", protect, restorePersonnelTask);

// Delete task
router.delete("/:id/tasks/:taskId", protect, deletePersonnelTask);

module.exports = router;