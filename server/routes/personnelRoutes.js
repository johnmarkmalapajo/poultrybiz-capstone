const express = require("express");
const router = express.Router();

const {
  createPersonnel,
  getAllPersonnel,
  getAllAssignedTasks,
  getPersonnel,
  updatePersonnel,
  archivePersonnel,
  restorePersonnel,
  deletePersonnel,
  getPersonnelAttendance,
} = require("../controllers/personnelController");

const { protect } = require("../middleware/authMiddleware");


// Get all personnel
router.get("/", getAllPersonnel);

router.get("/all-tasks", protect, getAllAssignedTasks);


// Get single personnel
router.get("/:id", protect, getPersonnel);

// Create personnel
router.post("/", protect, createPersonnel);

// Update personnel
router.put("/:id", protect, updatePersonnel);

// Archive personnel
router.put("/:id/archive", protect, archivePersonnel);

// Restore personnel
router.put("/:id/restore", protect, restorePersonnel);

// Delete personnel
router.delete("/:id", protect, deletePersonnel);

//Personnel Attendance
router.get("/:id/attendance", protect, getPersonnelAttendance);


module.exports = router;