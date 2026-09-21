const express = require("express");
const router = express.Router();

const {
  getMaintenanceStatus,
  listMaintenance,
  scheduleMaintenance,
  updateMaintenance,
  cancelMaintenance,
} = require("../controllers/systemMaintenanceController");
const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/status", getMaintenanceStatus);

router.get("/", protect, ownerOnly, listMaintenance);
router.post("/", protect, ownerOnly, scheduleMaintenance);
router.put("/:id", protect, ownerOnly, updateMaintenance);
router.delete("/:id", protect, ownerOnly, cancelMaintenance);

module.exports = router;