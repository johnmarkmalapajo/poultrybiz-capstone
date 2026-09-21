const express = require("express");

const router = express.Router();

const {
  createFlock,
  getAllFlocks,
  getFlockById,
  updateFlock,
  updateFlockStatus,
  archiveFlock,
  restoreFlock,
  getArchivedFlocks,
  deleteFlockPermanently,
} = require("../controllers/flockController");

const {
  protect,
  ownerOnly,
} = require("../middleware/authMiddleware");

router.get("/", protect, getAllFlocks);

router.get("/archived", protect, ownerOnly, getArchivedFlocks);

router.get("/:id", protect, getFlockById);

router.post("/", protect, ownerOnly, createFlock);

router.put("/:id", protect, ownerOnly, updateFlock);

router.patch("/:id/status", protect, ownerOnly, updateFlockStatus);

router.patch("/:id/archive", protect, ownerOnly, archiveFlock);

router.patch("/:id/restore", protect, ownerOnly, restoreFlock);

router.delete("/:id", protect, ownerOnly, deleteFlockPermanently);

module.exports = router;