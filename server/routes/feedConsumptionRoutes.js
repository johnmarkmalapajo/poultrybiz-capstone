const express = require("express");
const router = express.Router();

const {
  createFeedConsumption,
  getAllFeedConsumption,
  getFeedConsumption,
  updateFeedConsumption,
  archiveFeedConsumption,
  restoreFeedConsumption,
  deleteFeedConsumption,
} = require("../controllers/feedConsumptionController");

const { protect } = require("../middleware/authMiddleware");

router.get("/", protect, getAllFeedConsumption);
router.get("/:id", protect, getFeedConsumption);

router.post("/", protect, createFeedConsumption);

router.put("/:id", protect, updateFeedConsumption);

router.put("/:id/archive", protect, archiveFeedConsumption);
router.put("/:id/restore", protect, restoreFeedConsumption);

router.delete("/:id", protect, deleteFeedConsumption);

module.exports = router;