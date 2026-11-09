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
  getMyTasksToday,
  submitTaskOccurrence,
  getTaskOccurrenceHistory,
} = require("../controllers/personnelTaskController");

const { protect, farmerOnly } = require("../middleware/authMiddleware");
const { preventDuplicateSubmission } = require("../middleware/duplicateGuard");
const uploadTaskProof = require("../middleware/taskProofUpload");

// Converts a multer error (wrong file type, over the size limit) into a
// clean 400 JSON response for this endpoint, instead of falling through to
// the app's generic 500 error handler.
const handleTaskProofUpload = (req, res, next) => {
  uploadTaskProof.single("photo")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || "Unable to upload the photo proof. Please try a different image.",
      });
    }
    next();
  });
};

// Farmer's own Primary + Secondary tasks for today (lazily generates any
// missing daily occurrence -- must come before "/:id/tasks" so it is not
// swallowed by that param route).
router.get("/my-tasks/today", protect, farmerOnly, getMyTasksToday);

// Required Proof of Completion submission (photo + remarks). Farmer-only,
// and the controller additionally verifies the occurrence belongs to the
// authenticated Farmer's own Personnel record.
router.post(
  "/occurrences/:occurrenceId/submit",
  protect,
  farmerOnly,
  // duplicateGuard's fingerprint includes the uploaded file and body, so
  // multer must run first (per middleware/duplicateGuard.js's own doc
  // comment) -- otherwise the fingerprint would be computed before
  // multipart parsing and ignore the photo/remarks entirely.
  handleTaskProofUpload,
  preventDuplicateSubmission,
  submitTaskOccurrence
);

// Get all tasks of a personnel
router.get("/:id/tasks", protect, getPersonnelTasks);

// Owner-or-self Personnel task history (Primary + Secondary occurrences),
// filterable by date range and category. Must be registered before the
// "/:id/tasks/:taskId" route below, or Express would match "history" as a
// taskId and this route would never be reached.
router.get("/:id/tasks/history", protect, getTaskOccurrenceHistory);

router.get("/:id/tasks/:taskId", protect, getPersonnelTask);

// Create task
router.post("/:id/tasks", protect, preventDuplicateSubmission, createPersonnelTask);

// Update task
router.put("/:id/tasks/:taskId", protect, updatePersonnelTask);

// Archive task
router.put("/:id/tasks/:taskId/archive", protect, archivePersonnelTask);

// Restore task
router.put("/:id/tasks/:taskId/restore", protect, restorePersonnelTask);

// Delete task
router.delete("/:id/tasks/:taskId", protect, deletePersonnelTask);

module.exports = router;