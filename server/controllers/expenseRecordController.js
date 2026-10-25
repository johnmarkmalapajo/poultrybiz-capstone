const ExpenseRecord = require("../models/ExpenseRecord");
const { isFutureDate, FUTURE_DATE_MESSAGE } = require("../utils/dateGuard");
const FeedInventory = require("../models/FeedInventory");
const Equipment = require("../models/Equipment");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { checkNetLoss } = require("./salesRecordController");
const Archive = require("../models/Archive");
const {
  normalizeFeedKey,
  round2,
  isSackUnit,
  resolveSackWeight,
  toKg,
  toSacks,
  getFeedStockSetting,
  computeFeedStock,
  notifyLowFeedStock,
} = require("../utils/feedStock");

const mapExpenseToEquipmentFields = (record) => ({
  name: record.equipmentName,
  description: record.description,
  serialNo: record.serialNo,
  quantity: record.quantity,
  unit: record.unit,
  dateAcquired: record.date,
  cost: record.amount,
});

const createLinkedEquipment = async (record, req) => {
  const equipment = await Equipment.create({
    ...mapExpenseToEquipmentFields(record),
    expenseRecordId: record._id,
  });

  record.equipmentId = equipment._id;
  await record.save();

  await createAuditLog({
    user: req.user.name,
    role: req.user.role,
    module: "Equipment & Tools",
    action: "Added",
    description: `Added equipment '${equipment.name}' (${equipment.itemNo}) via Expense Record.`,
  });

  return equipment;
};

const syncEquipmentFromExpense = async (record) => {
  if (!record.equipmentId) return;

  await Equipment.findByIdAndUpdate(
    record.equipmentId,
    mapExpenseToEquipmentFields(record),
    { runValidators: true }
  );
};

const applyFeedSetSackWeights = async (feedSets, previousFeedSets = []) => {
  const currentWeights = new Map();

  const currentSackWeight = async (feedType) => {
    const key = normalizeFeedKey(feedType);

    if (!currentWeights.has(key)) {
      currentWeights.set(key, (await getFeedStockSetting(feedType)).sackWeightKg);
    }

    return currentWeights.get(key);
  };

  const result = [];
  const matchesById = feedSets.some((feedSet) => feedSet && feedSet._id);

  for (let index = 0; index < feedSets.length; index += 1) {
    const feedSet = feedSets[index] || {};

    const previous = feedSet._id
      ? previousFeedSets.find((item) => String(item._id) === String(feedSet._id))
      : matchesById
        ? null
        : previousFeedSets[index];

    const keepsSnapshot =
      previous &&
      normalizeFeedKey(previous.feedType) === normalizeFeedKey(feedSet.feedType);

    const sackWeightKg = keepsSnapshot
      ? resolveSackWeight(previous.sackWeightKg)
      : await currentSackWeight(feedSet.feedType);

    result.push({
      ...feedSet,
      sackWeightKg,
      equivalentKg: round2(toKg(feedSet.quantity, feedSet.unit || "Sacks", sackWeightKg)),
    });
  }

  return result;
};

const prepareFeedPurchase = async (payload, previousFeedSets = []) => {
  if (payload.category !== "Feed Purchase" || !Array.isArray(payload.feedSets)) {
    return payload;
  }

  const feedSets = await applyFeedSetSackWeights(payload.feedSets, previousFeedSets);

  return {
    ...payload,
    feedSets,
    totalQuantityKg: round2(
      feedSets.reduce((sum, feedSet) => sum + feedSet.equivalentKg, 0)
    ),
  };
};

const refreshLowStockAlerts = async (record) => {
  try {
    const feedTypes = [
      ...new Set((record.feedSets || []).map((feedSet) => feedSet.feedType).filter(Boolean)),
    ];

    for (const feedType of feedTypes) {
      await notifyLowFeedStock(await computeFeedStock(feedType));
    }
  } catch (err) {
    console.error("Low feed stock check failed:", err.message);
  }
};

const createFeedInventoryFromExpense = async (record) => {
  if (
    record.category !== "Feed Purchase" ||
    !Array.isArray(record.feedSets) ||
    record.feedSets.length === 0
  ) {
    return;
  }

  for (const feedSet of record.feedSets) {
    const quantity = Number(feedSet.quantity || 0);
    const unit = feedSet.unit || "Sacks";
    const sackWeightKg = resolveSackWeight(feedSet.sackWeightKg);

    const quantityInSacks = toSacks(quantity, unit, sackWeightKg);
    const equivalentKg = toKg(quantity, unit, sackWeightKg);

    await FeedInventory.create({
      expenseRecordId: record._id,
      date: record.date,
      feedType: feedSet.feedType,
      supplier: record.supplier || "",
      quantity,
      quantityUnit: isSackUnit(unit) ? "sacks" : "kg",
      sackWeightKg,
      quantityIn: quantityInSacks,
      quantityOut: 0,
      balance: quantityInSacks,
      equivalentKg,
      amount: Number(feedSet.amount || 0),
      receipt: feedSet.receipt || record.receipt || "",
      notes: `Feed Purchase from ${record.supplier || "supplier"}.`,
      archived: false,
      archivedAt: null,
    });
  }
};

const reconcileFeedInventoryFromExpense = async (record) => {
  if (record.category !== "Feed Purchase") return;

  await FeedInventory.deleteMany({
    expenseRecordId: record._id,
  });

  await createFeedInventoryFromExpense(record);
  await refreshLowStockAlerts(record);
};

exports.uploadReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    const receipt = `/uploads/receipts/${req.file.filename}`;

    return res.status(201).json({
      success: true,
      message: "Receipt uploaded successfully.",
      receipt,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to upload receipt.",
      error: error.message,
    });
  }
};

exports.createExpenseRecord = async (req, res) => {
  try {
    if (isFutureDate(req.body.date)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }

    const { equipmentId, ...body } = req.body;
    const payload = await prepareFeedPurchase(body);
    const record = await ExpenseRecord.create(payload);

    await createFeedInventoryFromExpense(record);

    if (record.category === "Equipment") {
      await createLinkedEquipment(record, req);
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Expense Record",
      action: "Added",
      description: `Added expense record under '${record.category}'.`,
    });

    await checkNetLoss();

    return res.status(201).json({
      success: true,
      message: "Expense record created successfully.",
      record,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create expense record.",
      error: error.message,
    });
  }
};

exports.getExpenseRecords = async (req, res) => {
  try {
    const { search } = req.query;

    const filter = {
      isArchived: false,
    };

    if (search) {
      filter.$or = [
        {
          category: {
            $regex: search,
            $options: "i",
          },
        },
        {
          remarks: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const records = await ExpenseRecord.find(filter).sort({
      date: -1,
      createdAt: -1,
    });

    const stats = {
      totalRecords: records.length,
      totalExpenses: records.reduce(
        (sum, r) => sum + Number(r.amount || 0),
        0
      ),
      categoriesUsed: new Set(
        records.map((r) => r.category)
      ).size,
    };

    return res.json({
      success: true,
      records,
      stats,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expense records.",
      error: error.message,
    });
  }
};

exports.getExpenseRecord = async (req, res) => {
  try {
    const record = await ExpenseRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    return res.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch expense record.",
      error: error.message,
    });
  }
};

exports.updateExpenseRecord = async (req, res) => {
  try {
    if (isFutureDate(req.body.date)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }

    const { equipmentId, ...body } = req.body;

    const existingRecord = Array.isArray(body.feedSets)
      ? await ExpenseRecord.findById(req.params.id).lean()
      : null;

    const updates = await prepareFeedPurchase(
      body,
      existingRecord?.feedSets || []
    );

    const record = await ExpenseRecord.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    if (record.category === "Equipment") {
      if (record.equipmentId) {
        await syncEquipmentFromExpense(record);
      } else {
        await createLinkedEquipment(record, req);
      }
    }

    if (record.category === "Feed Purchase") {
      await reconcileFeedInventoryFromExpense(record);
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Expense Record",
      action: "Edited",
      description: `Updated expense record under '${record.category}'.`,
    });

    return res.json({
      success: true,
      message: "Expense record updated successfully.",
      record,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to update expense record.",
      error: error.message,
    });
  }
};

exports.archiveExpenseRecord = async (req, res) => {
  try {
    const record = await ExpenseRecord.findByIdAndUpdate(
      req.params.id,
      {
        isArchived: true,
        archivedAt: new Date(),
      },
      {
        new: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    await createArchiveEntry({
      module: "Expense Records",
      moduleKey: "pb_expenses",
      recordId: record._id,
      recordName: record.category,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Expense Record",
      action: "Archived",
      description: `Archived expense record under '${record.category}'.`,
    });

    return res.json({
      success: true,
      message: "Expense record archived successfully.",
      record,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to archive expense record.",
      error: error.message,
    });
  }
};

exports.restoreExpenseRecord = async (req, res) => {
  try {
    const record = await ExpenseRecord.findByIdAndUpdate(
      req.params.id,
      {
        isArchived: false,
        archivedAt: null,
      },
      {
        new: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_expenses",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Expense Record",
      action: "Restored",
      description: `Restored expense record under '${record.category}'.`,
    });

    return res.json({
      success: true,
      message: "Expense record restored successfully.",
      record,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to restore expense record.",
      error: error.message,
    });
  }
};

exports.deleteExpenseRecord = async (req, res) => {
  try {
    const record = await ExpenseRecord.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Expense record not found.",
      });
    }

    await FeedInventory.deleteMany({
      expenseRecordId: record._id,
    });

    await refreshLowStockAlerts(record);

    await Archive.findOneAndDelete({
      moduleKey: "pb_expenses",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Expense Record",
      action: "Deleted",
      description: `Deleted expense record under '${record.category}'.`,
    });

    return res.json({
      success: true,
      message: "Expense record deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete expense record.",
      error: error.message,
    });
  }
};

exports.getArchivedExpenseRecords = async (req, res) => {
  try {
    const records = await ExpenseRecord.find({
      isArchived: true,
    }).sort({
      archivedAt: -1,
    });

    return res.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch archived expense records.",
      error: error.message,
    });
  }
};