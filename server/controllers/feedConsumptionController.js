const FeedConsumption = require("../models/FeedConsumption");
const { isFutureDate, FUTURE_DATE_MESSAGE } = require("../utils/dateGuard");
const FeedInventory = require("../models/FeedInventory");
const Flock = require("../models/Flock");
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

// ── Batches ───────────────────────────────────────────────────────────────
// One Feed Consumption entry can feed several batches that received the same
// feed. The entry's quantityConsumed is the TOTAL taken from the feed stock;
// the stock is computed from the sum of all entries (utils/feedStock.js), so a
// multi-batch entry is subtracted exactly once. `allocations` only records how
// that total is shared among the batches, for per-batch views.

// Selected Batch IDs: trimmed, blanks dropped, duplicates removed (first
// occurrence kept). Accepts `batchIds` (array) or the older single `batchId`.
const readBatchIds = (body, fallback = []) => {
  let raw = body.batchIds;
  if (raw === undefined) raw = body.batchId !== undefined ? [body.batchId] : fallback;
  if (!Array.isArray(raw)) raw = [raw];
  const ids = [];
  for (const value of raw) {
    const id = String(value ?? "").trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
};

// Every batch must exist; a batch that is archived or culled cannot be newly
// selected (one that is already on the entry being edited may stay on it).
const loadEligibleFlocks = async (batchIds, alreadyOnRecord = []) => {
  const flocks = await Flock.find({ batchId: { $in: batchIds } }).lean();
  const byId = new Map(flocks.map((f) => [f.batchId, f]));

  for (const id of batchIds) {
    const flock = byId.get(id);
    if (!flock) return { error: `Batch ${id} was not found.` };
    if (!alreadyOnRecord.includes(id) && (flock.isArchived || flock.status === "Culled")) {
      return { error: `Batch ${id} is ${flock.status === "Culled" ? "culled" : "archived"} and can no longer receive feed.` };
    }
  }
  return { byId };
};

// Splits the entry's total (kg) across its batches in proportion to each
// batch's current bird count, so every bird gets the same share. If no bird
// counts are known it is split equally. Each share is rounded to 0.01 kg and
// the last batch takes the rounding remainder, so the shares always add up to
// exactly the total.
const allocateKg = (totalKg, batchIds, flocksById, batchMeta = {}) => {
  const heads = batchIds.map((id) => Math.max(0, Number(flocksById.get(id)?.currentQuantity) || 0));
  const totalHeads = heads.reduce((a, b) => a + b, 0);
  const weights = totalHeads > 0 ? heads : batchIds.map(() => 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let given = 0;
  return batchIds.map((batchId, i) => {
    const isLast = i === batchIds.length - 1;
    const quantityKg = isLast
      ? Math.max(0, round2(totalKg - given))
      : round2((totalKg * weights[i]) / totalWeight);
    given = round2(given + quantityKg);

    const meta = batchMeta && typeof batchMeta === "object" ? batchMeta[batchId] || {} : {};
    const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
    return {
      batchId,
      quantityKg,
      currentQuantity: heads[i] || null,
      currentAge: num(meta.currentAge),
      gPerHeadPerDay: num(meta.gPerHeadPerDay),
    };
  });
};

// Fields that describe one batch only make sense on a single-batch entry.
const singleBatchFields = (body, batchIds) =>
  batchIds.length === 1
    ? {}
    : { currentAge: null, currentQuantity: null, feedTransition: "", gPerHeadPerDay: null };

const batchLabel = (record) => record.batchId;

// Per-batch details already stored on an entry, so an edit that does not
// change the batches keeps them (older single-batch entries keep theirs on
// the entry itself).
const savedBatchMeta = (record) => {
  if (record.allocations?.length) {
    return Object.fromEntries(
      record.allocations.map((a) => [a.batchId, { currentAge: a.currentAge, gPerHeadPerDay: a.gPerHeadPerDay }])
    );
  }
  return { [record.batchId]: { currentAge: record.currentAge, gPerHeadPerDay: record.gPerHeadPerDay } };
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

    const batchIds = readBatchIds(req.body);
    if (!batchIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one Batch ID." });
    }

    const { quantity, unit, error } = readQuantity(
      req.body.quantityConsumed,
      req.body.quantityUnit
    );

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const eligible = await loadEligibleFlocks(batchIds);
    if (eligible.error) {
      return res.status(400).json({ success: false, message: eligible.error });
    }

    const stock = await computeFeedStock(feedType);

    const requestedKg = round2(toKg(quantity, unit, stock.sackWeightKg));

    if (requestedKg > stock.availableKg) {
      await createNotification({
        title: "Feed Consumption Blocked",

        description: `An attempt to log ${quantity} ${unit} of ${feedType} (batch '${batchIds.join(
          ", "
        )}') was blocked — only ${stockMessage(stock)} of stock is available.`,

        category: "feed",
        type: "alert",

        roles: ["Owner", "Farmer"],
      });

      return res.status(400).json({
        success: false,
        message: `Quantity consumed exceeds available feed stock. Only ${stockMessage(
          stock
        )} of ${feedType} is available.`,
      });
    }

    const { batchMeta, allocations: _ignoredAllocations, ...fields } = req.body;

    // ONE document for the whole entry (a single atomic insert): its total is
    // subtracted from the stock once, however many batches it fed.
    const record = await FeedConsumption.create({
      ...fields,
      ...singleBatchFields(fields, batchIds),
      batchId: batchIds.join(", "),
      batchIds,
      allocations: allocateKg(requestedKg, batchIds, eligible.byId, batchMeta),
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
      description: `Added ${record.quantityConsumed} ${record.quantityUnit || "kg"} feed consumption for batch${
        record.batchIds.length > 1 ? "es" : ""
      } '${batchLabel(record)}'.`,
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

    const { batchMeta, ...body } = req.body;
    delete body.sackWeightKg;
    delete body.allocations;

    const previousBatchIds = existingRecord.batchIds?.length
      ? existingRecord.batchIds
      : [existingRecord.batchId];
    const batchIds = readBatchIds(body, previousBatchIds);
    if (!batchIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one Batch ID." });
    }

    const eligible = await loadEligibleFlocks(batchIds, previousBatchIds);
    if (eligible.error) {
      return res.status(400).json({ success: false, message: eligible.error });
    }

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
        ...singleBatchFields(body, batchIds),
        batchId: batchIds.join(", "),
        batchIds,
        allocations: allocateKg(
          requestedKg,
          batchIds,
          eligible.byId,
          batchMeta !== undefined ? batchMeta : savedBatchMeta(existingRecord)
        ),
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