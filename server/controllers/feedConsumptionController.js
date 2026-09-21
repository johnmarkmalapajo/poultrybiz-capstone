const FeedConsumption = require("../models/FeedConsumption");
const FeedInventory = require("../models/FeedInventory");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { createNotification } = require("./notificationController");
const Archive = require("../models/Archive");

const FEED_SACK_WEIGHT_KG = 50;

const getQuantityInKg = (quantity, unit) => {
  const value = Number(quantity || 0);

  if (String(unit).toLowerCase() === "sacks") {
    return value * FEED_SACK_WEIGHT_KG;
  }

  return value;
};

exports.createFeedConsumption = async (req, res) => {
  try {
    const feedType = String(req.body.feedType || "")
      .trim()
      .toLowerCase();

    const inventoryRecords = await FeedInventory.find({
      archived: false,
      feedType: {
        $regex: new RegExp(`^${feedType}$`, "i"),
      },
    });

    const consumptionRecords = await FeedConsumption.find({
      archived: false,
      feedType: {
        $regex: new RegExp(`^${feedType}$`, "i"),
      },
    });

    const totalPurchasedSacks = inventoryRecords.reduce(
      (sum, item) => sum + Number(item.quantityIn || 0),
      0
    );

    const totalPurchasedKg =
      totalPurchasedSacks * FEED_SACK_WEIGHT_KG;

    const totalConsumedKg = consumptionRecords.reduce(
      (sum, item) =>
        sum +
        getQuantityInKg(
          item.quantityConsumed,
          item.quantityUnit
        ),
      0
    );

    const availableKg = Math.max(
      0,
      totalPurchasedKg - totalConsumedKg
    );

    const availableSacks =
      availableKg / FEED_SACK_WEIGHT_KG;

    const requestedKg = getQuantityInKg(
      req.body.quantityConsumed,
      req.body.quantityUnit
    );

    if (requestedKg > availableKg) {
      await createNotification({
        title: "Feed Consumption Blocked",

        description: `An attempt to log ${req.body.quantityConsumed} ${
          req.body.quantityUnit || "kg"
        } of ${req.body.feedType} (batch '${
          req.body.batchId || "—"
        }') was blocked — only ${availableKg.toFixed(
          1
        )} kg (${availableSacks.toFixed(
          2
        )} sacks) of stock is available.`,

        category: "feed",
        type: "alert",
        priority: "Warning",

        roles: ["Owner", "Farmer"],
      });

      return res.status(400).json({
        success: false,
        message: `Quantity consumed exceeds available feed stock. Only ${availableKg.toFixed(
          1
        )} kg (${availableSacks.toFixed(
          2
        )} sacks) of ${req.body.feedType} is available.`,
      });
    }

    const record = await FeedConsumption.create(req.body);

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Added",
      description: `Added ${record.quantityConsumed} ${record.quantityUnit || "kg"} feed consumption for batch '${record.batchId}'.`,
    });

    const remainingKg = Math.max(
      0,
      availableKg - requestedKg
    );

    const remainingSacks =
      remainingKg / FEED_SACK_WEIGHT_KG;

    if (remainingKg < 100) {
      const isCritical = remainingKg < 50;

      await createNotification({
        title: isCritical
          ? "Critical Feed Inventory"
          : "Low Feed Stock",

        description: `${record.feedType} stock is ${
          isCritical ? "critically low" : "low"
        }. ${Math.floor(remainingSacks)} sacks remaining.`,

        category: "feed",
        type: "alert",
        priority: isCritical ? "Critical" : "Warning",

        roles: ["Owner", "Farmer"],
      });
    }

    return res.status(201).json({
      success: true,
      message: "Feed consumption record created successfully.",
      record,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAllFeedConsumption = async (req, res) => {
  try {
    const records = await FeedConsumption.find({
      archived: false,
    }).sort({
      createdAt: -1,
    });

    return res.json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getFeedConsumption = async (req, res) => {
  try {
    const record = await FeedConsumption.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed consumption record not found.",
      });
    }

    return res.json({
      success: true,
      record,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateFeedConsumption = async (req, res) => {
  try {
    const record = await FeedConsumption.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed consumption record not found.",
      });
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Edited",
      description: `Updated feed consumption for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Feed consumption updated successfully.",
      record,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.archiveFeedConsumption = async (req, res) => {
  try {
    const record = await FeedConsumption.findByIdAndUpdate(
      req.params.id,
      {
        archived: true,
        archivedAt: new Date(),
      },
      {
        new: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed consumption record not found.",
      });
    }

    await createArchiveEntry({
      module: "Feed Consumption",
      moduleKey: "pb_feed_consumption",
      recordId: record._id,
      recordName: `Batch ${record.batchId}`,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Archived",
      description: `Archived feed consumption for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Feed consumption archived successfully.",
      record,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.restoreFeedConsumption = async (req, res) => {
  try {
    const record = await FeedConsumption.findByIdAndUpdate(
      req.params.id,
      {
        archived: false,
        archivedAt: null,
      },
      {
        new: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed consumption record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_feed_consumption",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Restored",
      description: `Restored feed consumption for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Feed consumption restored successfully.",
      record,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.deleteFeedConsumption = async (req, res) => {
  try {
    const record = await FeedConsumption.findByIdAndDelete(
      req.params.id
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed consumption record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_feed_consumption",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Deleted",
      description: `Deleted feed consumption for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Feed consumption deleted successfully.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};