const FeedConsumption = require("../models/FeedConsumption");
const { isFutureDate, FUTURE_DATE_MESSAGE } = require("../utils/dateGuard");
const FeedInventory = require("../models/FeedInventory");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { createNotification } = require("./notificationController");
const Archive = require("../models/Archive");
const {
  normalizeFeedKey,
  round2,
  resolveSackWeight,
  toKg,
  consumptionRecordKg,
  computeFeedStock,
  notifyLowFeedStock,
  formatNumber,
} = require("../utils/feedStock");

const QUANTITY_UNITS = ["kg", "sacks"];

const refreshLowStockAlert = async (feedType) => {
  try {
    if (!feedType) return;

    await notifyLowFeedStock(await computeFeedStock(feedType));
  } catch (err) {
    console.error("Low feed stock check failed:", err.message);
  }
};

const readQuantity = (quantityConsumed, quantityUnit) => {
  const quantity = Number(quantityConsumed);
  const unit = String(quantityUnit || "kg").trim().toLowerCase();

  if (!QUANTITY_UNITS.includes(unit)) {
    return { error: "Quantity unit must be kg or sacks." };
  }

  if (
    quantityConsumed === "" ||
    quantityConsumed === null ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return { error: "Quantity consumed must be a number greater than 0." };
  }

  return { quantity: round2(quantity), unit };
};

const stockMessage = (stock) =>
  `${formatNumber(stock.availableKg)} kg (${formatNumber(
    stock.availableSacks
  )} sacks at ${formatNumber(stock.sackWeightKg)} kg/sack)`;

exports.createFeedConsumption = async (req, res) => {
  try {
    if (isFutureDate(req.body.date)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }

    const feedType = String(req.body.feedType || "").trim();

    if (!feedType) {
      return res.status(400).json({ success: false, message: "Feed type is required." });
    }

    const { quantity, unit, error } = readQuantity(
      req.body.quantityConsumed,
      req.body.quantityUnit
    );

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const stock = await computeFeedStock(feedType);

    const requestedKg = round2(toKg(quantity, unit, stock.sackWeightKg));

    if (requestedKg > stock.availableKg) {
      await createNotification({
        title: "Feed Consumption Blocked",

        description: `An attempt to log ${quantity} ${unit} of ${feedType} (batch '${
          req.body.batchId || "—"
        }') was blocked — only ${stockMessage(stock)} of stock is available.`,

        category: "feed",
        type: "alert",
        priority: "Warning",

        roles: ["Owner", "Farmer"],
      });

      return res.status(400).json({
        success: false,
        message: `Quantity consumed exceeds available feed stock. Only ${stockMessage(
          stock
        )} of ${feedType} is available.`,
      });
    }

    const record = await FeedConsumption.create({
      ...req.body,
      feedType,
      quantityConsumed: quantity,
      quantityUnit: unit,
      sackWeightKg: stock.sackWeightKg,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Added",
      description: `Added ${record.quantityConsumed} ${record.quantityUnit || "kg"} feed consumption for batch '${record.batchId}'.`,
    });

    await refreshLowStockAlert(record.feedType);

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
    if (isFutureDate(req.body.date)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }

    const existingRecord = await FeedConsumption.findById(req.params.id);

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Feed consumption record not found.",
      });
    }

    const body = { ...req.body };
    delete body.sackWeightKg;

    const feedType =
      body.feedType !== undefined
        ? String(body.feedType || "").trim()
        : existingRecord.feedType;

    if (!feedType) {
      return res.status(400).json({ success: false, message: "Feed type is required." });
    }

    const { quantity, unit, error } = readQuantity(
      body.quantityConsumed !== undefined
        ? body.quantityConsumed
        : existingRecord.quantityConsumed,
      body.quantityUnit !== undefined
        ? body.quantityUnit
        : existingRecord.quantityUnit
    );

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const feedTypeChanged =
      normalizeFeedKey(feedType) !==
      normalizeFeedKey(existingRecord.feedType);

    const stock = await computeFeedStock(feedType, {
      excludeConsumptionId: existingRecord._id,
    });

    const sackWeightKg = feedTypeChanged
      ? stock.sackWeightKg
      : resolveSackWeight(existingRecord.sackWeightKg);

    const requestedKg = round2(toKg(quantity, unit, sackWeightKg));
    const previousKg = round2(consumptionRecordKg(existingRecord));

    if (
      (feedTypeChanged || requestedKg > previousKg) &&
      requestedKg > stock.availableKg
    ) {
      return res.status(400).json({
        success: false,
        message: `Quantity consumed exceeds available feed stock. Only ${stockMessage(
          stock
        )} of ${feedType} is available.`,
      });
    }

    const record = await FeedConsumption.findByIdAndUpdate(
      req.params.id,
      {
        ...body,
        feedType,
        quantityConsumed: quantity,
        quantityUnit: unit,
        sackWeightKg,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Consumption",
      action: "Edited",
      description: `Updated feed consumption for batch '${record.batchId}'.`,
    });

    await refreshLowStockAlert(record.feedType);

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

    await refreshLowStockAlert(record.feedType);

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