const FeedInventory = require("../models/FeedInventory");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const Archive = require("../models/Archive");

const FEED_SACK_WEIGHT_KG = 50;

const EXPENSE_OWNED_FEED_INVENTORY_FIELDS = [
  "date",
  "feedType",
  "supplier",
  "quantity",
  "quantityUnit",
  "quantityIn",
  "equivalentKg",
  "amount",
];

const convertToKg = (quantity, unit) => {
  const value = Number(quantity || 0);

  if (String(unit).toLowerCase() === "sacks") {
    return value * FEED_SACK_WEIGHT_KG;
  }

  return value;
};

const convertToSacks = (quantity, unit) => {
  const value = Number(quantity || 0);

  if (String(unit).toLowerCase() === "kg") {
    return value / FEED_SACK_WEIGHT_KG;
  }

  return value;
};

exports.createFeedInventory = async (req, res) => {
  try {
    const {
      date,
      feedType,
      supplier,
      quantity,
      quantityUnit,
      amount,
      receipt,
      notes,
    } = req.body;

    const unit = quantityUnit || "sacks";
    const originalQuantity = Number(quantity || 0);

    const quantityIn = convertToSacks(originalQuantity, unit);
    const equivalentKg = convertToKg(originalQuantity, unit);

    const record = await FeedInventory.create({
      date,
      feedType,
      supplier: supplier || "",
      quantity: originalQuantity,
      quantityUnit: unit,
      quantityIn,
      quantityOut: 0,
      balance: quantityIn,
      equivalentKg,
      amount: Number(amount || 0),
      receipt: receipt || "",
      notes: notes || "",
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Inventory",
      action: "Added",
      description: `Added feed inventory '${record.feedType}' (${record.quantity} ${record.quantityUnit}).`,
    });

    return res.status(201).json({
      success: true,
      message: "Feed inventory record created successfully.",
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

exports.getAllFeedInventory = async (req, res) => {
  try {
    const records = await FeedInventory.find({
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

exports.getFeedInventory = async (req, res) => {
  try {
    const record = await FeedInventory.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed inventory record not found.",
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

exports.updateFeedInventory = async (req, res) => {
  try {
    const existingRecord = await FeedInventory.findById(req.params.id);

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        message: "Feed inventory record not found.",
      });
    }

    const isLinked = Boolean(existingRecord.expenseRecordId);

    const body = { ...req.body };
    delete body.expenseRecordId;

    if (isLinked) {
      for (const field of EXPENSE_OWNED_FEED_INVENTORY_FIELDS) {
        delete body[field];
      }
    }

    const {
      date,
      feedType,
      supplier,
      quantity,
      quantityUnit,
      amount,
      receipt,
      notes,
    } = body;

    const unit = quantityUnit || existingRecord.quantityUnit || "sacks";

    const originalQuantity =
      quantity !== undefined
        ? Number(quantity)
        : Number(existingRecord.quantity || 0);

    const quantityIn = convertToSacks(originalQuantity, unit);

    const oldQuantityOut = Number(existingRecord.quantityOut || 0);

    const balance = Math.max(0, quantityIn - oldQuantityOut);

    const equivalentKg = balance * FEED_SACK_WEIGHT_KG;

    const updateData = {
      date: date !== undefined ? date : existingRecord.date,
      feedType: feedType !== undefined ? feedType : existingRecord.feedType,
      supplier:
        supplier !== undefined ? supplier : existingRecord.supplier || "",
      quantity: originalQuantity,
      quantityUnit: unit,
      quantityIn,
      quantityOut: oldQuantityOut,
      balance,
      equivalentKg,
      amount:
        amount !== undefined
          ? Number(amount)
          : Number(existingRecord.amount || 0),
      receipt:
        receipt !== undefined ? receipt : existingRecord.receipt || "",
      notes: notes !== undefined ? notes : existingRecord.notes || "",
    };

    const record = await FeedInventory.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Inventory",
      action: "Edited",
      description: `Updated feed inventory '${record.feedType}' (${record.quantity} ${record.quantityUnit}).`,
    });

    return res.json({
      success: true,
      message: "Feed inventory updated successfully.",
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

exports.archiveFeedInventory = async (req, res) => {
  try {
    const record = await FeedInventory.findByIdAndUpdate(
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
        message: "Feed inventory record not found.",
      });
    }

    await createArchiveEntry({
      module: "Feed Inventory",
      moduleKey: "pb_feed_inventory",
      recordId: record._id,
      recordName: record.feedType,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Inventory",
      action: "Archived",
      description: `Archived feed inventory '${record.feedType}'.`,
    });

    return res.json({
      success: true,
      message: "Feed inventory archived successfully.",
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

exports.restoreFeedInventory = async (req, res) => {
  try {
    const record = await FeedInventory.findByIdAndUpdate(
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
        message: "Feed inventory record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_feed_inventory",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Inventory",
      action: "Restored",
      description: `Restored feed inventory '${record.feedType}'.`,
    });

    return res.json({
      success: true,
      message: "Feed inventory restored successfully.",
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

exports.deleteFeedInventory = async (req, res) => {
  try {
    const record = await FeedInventory.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Feed inventory record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_feed_inventory",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Feed Inventory",
      action: "Deleted",
      description: `Deleted feed inventory '${record.feedType}'.`,
    });

    return res.json({
      success: true,
      message: "Feed inventory deleted successfully.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};