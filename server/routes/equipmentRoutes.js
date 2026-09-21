const express = require("express");
const router = express.Router();

const {
  createEquipment,
  getAllEquipment,
  getEquipment,
  updateEquipment,
  archiveEquipment,
  restoreEquipment,
  deleteEquipment,
} = require("../controllers/equipmentController");

const { protect, ownerOnly } = require("../middleware/authMiddleware");

router.get("/", protect, getAllEquipment);
router.get("/:id", protect, getEquipment);

router.post("/", protect, ownerOnly, createEquipment);

router.put("/:id", protect, updateEquipment);

router.put("/:id/archive", protect, ownerOnly, archiveEquipment);
router.put("/:id/restore", protect, ownerOnly, restoreEquipment);

router.delete("/:id", protect, ownerOnly, deleteEquipment);

module.exports = router;