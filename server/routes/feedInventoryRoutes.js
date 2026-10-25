const express = require("express");

const router = express.Router();

const {
  protect,
  ownerOnly,
} = require("../middleware/authMiddleware");

const {
  createFeedInventory,
  getAllFeedInventory,
  getFeedInventory,
  updateFeedInventory,
  deleteFeedInventory,
  archiveFeedInventory,
  restoreFeedInventory,
  getFeedStock,
  updateFeedStockSetting,
} = require("../controllers/feedInventoryController");

router.get("/", protect, getAllFeedInventory);

router.get("/stock", protect, getFeedStock);

router.put("/stock-settings", protect, ownerOnly, updateFeedStockSetting);

router.get("/:id", protect, getFeedInventory);

router.post("/", protect, ownerOnly, createFeedInventory);

router.put("/:id", protect, ownerOnly, updateFeedInventory);

router.delete("/:id", protect, ownerOnly, deleteFeedInventory);

router.put(
  "/:id/archive",
  protect,
  ownerOnly,
  archiveFeedInventory
);

router.put(
  "/:id/restore",
  protect,
  ownerOnly,
  restoreFeedInventory
);

module.exports = router;