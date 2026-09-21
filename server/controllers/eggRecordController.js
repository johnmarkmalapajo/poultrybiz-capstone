const EggRecord = require("../models/EggRecord");
const Flock = require("../models/Flock");
const Notification = require("../models/Notification");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { createNotification } = require("./notificationController");
const Archive = require("../models/Archive");

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const toDateOnly = (value) => (value ? String(value).slice(0, 10) : "");

const isFutureDate = (value) => {
  const d = toDateOnly(value);
  return !!d && d > localToday();
};

const isEligibleForEggRecord = (flock) => flock.status === "Active";

function computeEggStats(data, currentBirds) {
  const peewee = Number(data.peewee || 0);
  const small = Number(data.small || 0);
  const medium = Number(data.medium || 0);
  const large = Number(data.large || 0);
  const extraLarge = Number(data.extraLarge || 0);
  const jumbo = Number(data.jumbo || 0);
  const crackedEggs = Number(data.crackedEggs || 0);

  const goodEggs =
    peewee +
    small +
    medium +
    large +
    extraLarge +
    jumbo;

  const totalEggs = goodEggs + crackedEggs;

  const henDayPercent =
    currentBirds > 0
      ? Number(((totalEggs / currentBirds) * 100).toFixed(2))
      : 0;

  let productionStatus = "Critical";

  if (henDayPercent >= 95)
    productionStatus = "Excellent";
  else if (henDayPercent >= 90)
    productionStatus = "Good";
  else if (henDayPercent >= 80)
    productionStatus = "Monitor";

  return {
    peewee,
    small,
    medium,
    large,
    extraLarge,
    jumbo,
    crackedEggs,
    goodEggs,
    totalEggs,
    henDayPercent,
    productionStatus,
  };
}

async function evaluateProductionAlert(record) {
  const sourceId = `egg_lowprod_${record._id}`;
  await Notification.deleteOne({ sourceId });

  const rate = Number(record.henDayPercent) || 0;
  if (rate >= 100) return;

  let priority = "Warning";
  let title = `Egg production is below normal for Batch ${record.batchId}.`;
  if (rate === 0) {
    priority = "Critical";
    title = `No egg production detected for Batch ${record.batchId}. Immediate action is required.`;
  } else if (rate < 75) {
    priority = "Critical";
    title = `Critical egg production detected for Batch ${record.batchId}. Production Rate: ${rate}%.`;
  }

  const dateText = record.collectionDate
    ? new Date(record.collectionDate).toISOString().slice(0, 10)
    : "";

  await createNotification({
    title,
    description: `Production Rate: ${rate}%. ${record.totalEggs} eggs produced from ${record.birdsAtCollection} birds on ${dateText}.`,
    category: "egg",
    type: "alert",
    priority,
    roles: ["Owner", "Farmer"],
    referenceId: record._id,
    referenceModel: "EggRecord",
    sourceId,
  });
}

exports.createEggRecord = async (req, res) => {
  try {
    const {
      batchId,
      collectionDate,
      remarks,
    } = req.body;

    if (!batchId || !collectionDate) {
      return res.status(400).json({
        success: false,
        message: "Batch and Collection Date are required.",
      });
    }

    if (isFutureDate(collectionDate)) {
      return res.status(400).json({
        success: false,
        message: "Collection Date cannot be a future date.",
      });
    }

    const flock = await Flock.findOne({
      batchId,
      isArchived: false,
    });

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Selected batch was not found.",
      });
    }

    if (!isEligibleForEggRecord(flock)) {
      return res.status(400).json({
        success: false,
        message: flock.status === "Culled"
          ? "This batch has been Culled and is no longer eligible for Egg Record."
          : "This batch is still under Quarantine and is not yet eligible for Egg Record.",
      });
    }

    const birdsAtCollection = flock.currentQuantity;

    const computed = computeEggStats(
      req.body,
      birdsAtCollection
    );

    if (computed.totalEggs > flock.currentQuantity) {
      return res.status(400).json({
        success: false,
        message: `Total eggs: ${computed.totalEggs}. Current chickens: ${flock.currentQuantity}. Please reduce the egg quantities.`,
      });
    }

    const eggRecord = await EggRecord.create({
      flock: flock._id,

      batchId,

      collectionDate,

      birdsAtCollection,

      peewee: computed.peewee,
      small: computed.small,
      medium: computed.medium,
      large: computed.large,
      extraLarge: computed.extraLarge,
      jumbo: computed.jumbo,

      crackedEggs: computed.crackedEggs,

      goodEggs: computed.goodEggs,
      totalEggs: computed.totalEggs,

      henDayPercent: computed.henDayPercent,

      productionStatus: computed.productionStatus,

      remarks,

      createdBy: req.user.id,
    });

    await evaluateProductionAlert(eggRecord);

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Egg Record",
      action: "Added",
      description: `Added egg record for batch ${batchId}`,
      next: eggRecord,
    });

    res.status(201).json({
      success: true,
      message: "Egg record created successfully.",
      record: eggRecord,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to create egg record.",
    });
  }
};

exports.getAllEggRecords = async (req, res) => {
  try {

    const records = await EggRecord.find({
      isArchived: false,
    })
      .populate("flock", "batchId currentQuantity breed isArchived")
      .sort({
        collectionDate: -1,
      });

    const summary = {
      totalEggs: 0,
      marketableEggs: 0,
      crackedEggs: 0,
      avgDailyEggs: 0,
    };

    records.forEach((record) => {
      summary.totalEggs += record.totalEggs || 0;
      summary.marketableEggs += record.goodEggs || 0;
      summary.crackedEggs += record.crackedEggs || 0;
    });

    summary.avgDailyEggs =
      records.length > 0
        ? Number(
            (
              summary.totalEggs /
              records.length
            ).toFixed(2)
          )
        : 0;

    res.json({
      success: true,
      records,
      summary,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to fetch egg records.",
    });
  }
};

exports.getEggRecordById = async (req, res) => {
  try {

    const record = await EggRecord.findById(req.params.id)
      .populate("flock");

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Egg record not found.",
      });
    }

    res.json({
      success: true,
      record,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to fetch egg record.",
    });
  }
};

exports.updateEggRecord = async (req, res) => {
  try {
    const {
      batchId,
      collectionDate,
      remarks,
    } = req.body;

    const record = await EggRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Egg record not found.",
      });
    }

    if (isFutureDate(collectionDate)) {
      return res.status(400).json({
        success: false,
        message: "Collection Date cannot be a future date.",
      });
    }

    const previous = record.toObject();

    const flock = await Flock.findOne({
      batchId,
      isArchived: false,
    });

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Selected batch not found.",
      });
    }

    const batchIsChanging = record.batchId !== batchId;
    if (batchIsChanging && !isEligibleForEggRecord(flock)) {
      return res.status(400).json({
        success: false,
        message: flock.status === "Culled"
          ? "This batch has been Culled and is no longer eligible for Egg Record."
          : "This batch is still under Quarantine and is not yet eligible for Egg Record.",
      });
    }

    const birdsAtCollection = batchIsChanging
      ? flock.currentQuantity
      : record.birdsAtCollection;

    const computed = computeEggStats(
      req.body,
      birdsAtCollection
    );

    if (computed.totalEggs > flock.currentQuantity) {
      return res.status(400).json({
        success: false,
        message: `Total eggs: ${computed.totalEggs}. Current chickens: ${flock.currentQuantity}. Please reduce the egg quantities.`,
      });
    }

    record.flock = flock._id;
    record.batchId = batchId;
    record.birdsAtCollection = birdsAtCollection;

    record.collectionDate = collectionDate;

    record.peewee = computed.peewee;
    record.small = computed.small;
    record.medium = computed.medium;
    record.large = computed.large;
    record.extraLarge = computed.extraLarge;
    record.jumbo = computed.jumbo;

    record.crackedEggs = computed.crackedEggs;

    record.goodEggs = computed.goodEggs;
    record.totalEggs = computed.totalEggs;

    record.henDayPercent = computed.henDayPercent;
    record.productionStatus = computed.productionStatus;

    record.remarks = remarks;

    record.updatedBy = req.user.id;

    await record.save();

    await evaluateProductionAlert(record);

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Egg Record",
      action: "Edited",
      description: `Updated egg record for batch ${batchId}`,
      previous,
      next: record,
    });

    res.json({
      success: true,
      message: "Egg record updated successfully.",
      record,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update egg record.",
    });
  }
};

exports.deleteEggRecord = async (req, res) => {
  try {

    const record = await EggRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Egg record not found.",
      });
    }

    const previous = record.toObject();

    await EggRecord.findByIdAndDelete(req.params.id);

    await Archive.findOneAndDelete({
     moduleKey: "pb_eggs",
     recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Egg Record",
      action: "Deleted",
      description: `Deleted egg record for batch ${record.batchId}`,
      previous,
    });

    res.json({
      success: true,
      message: "Egg record deleted successfully.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to delete egg record.",
    });
  }
};

exports.archiveEggRecord = async (req, res) => {
  try {

    const record = await EggRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Egg record not found.",
      });
    }

    if (record.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Egg record is already archived.",
      });
    }

    record.isArchived = true;
    record.archivedBy = req.user.id;

    await record.save();

    await createArchiveEntry({
      module: "Egg Records",
      moduleKey: "pb_eggs",
      recordId: record._id,
      recordName: `Batch ${record.batchId}`,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Egg Record",
      action: "Archived",
      description: `Archived egg record for batch ${record.batchId}`,
      next: record,
    });

    res.json({
      success: true,
      message: "Egg record archived successfully.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to archive egg record.",
    });
  }
};

exports.restoreEggRecord = async (req, res) => {
  try {

    const record = await EggRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Egg record not found.",
      });
    }

    record.isArchived = false;
    record.archivedBy = null;

    await record.save();

    await Archive.findOneAndDelete({
      moduleKey: "pb_eggs",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Egg Record",
      action: "Restored",
      description: `Restored egg record for batch ${record.batchId}`,
      next: record,
    });

    res.json({
      success: true,
      message: "Egg record restored successfully.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to restore egg record.",
    });
  }
};