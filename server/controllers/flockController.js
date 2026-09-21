const Flock = require("../models/Flock");
const Archive = require("../models/Archive");
const QuarantineIsolation = require("../models/QuarantineIsolation");
const MortalityRecord = require("../models/MortalityRecord");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { assertNoDependencies } = require("./dependencyController");
const { createNotification } = require("./notificationController");
const { resolveBreedName } = require("./breedController");
const { resolveSupplierName } = require("./supplierController");
const { generateMortalityId } = require("./mortalityRecordController");

const generateBatchId = async () => {
  const flocks = await Flock.find({ batchId: { $regex: /^F-\d+$/ } })
    .select("batchId")
    .lean();

  let maxNumber = 0;
  for (const f of flocks) {
    const n = parseInt(f.batchId.replace("F-", ""), 10);
    if (!isNaN(n) && n > maxNumber) maxNumber = n;
  }

  let candidate = `F-${String(maxNumber + 1).padStart(3, "0")}`;
  let attempt = maxNumber + 1;
  while (await Flock.exists({ batchId: candidate })) {
    attempt += 1;
    candidate = `F-${String(attempt).padStart(3, "0")}`;
  }

  return candidate;
};

const localToday = () => {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
};

const toDateOnly = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

const isFutureDate = (value) => {
  const d = toDateOnly(value);
  return !!d && d > localToday();
};

const isStrictPositiveInteger = (value) =>
  /^\d+$/.test(String(value ?? "").trim()) && Number(value) > 0;

const isStrictNonNegativeInteger = (value) =>
  /^\d+$/.test(String(value ?? "").trim());

const FLOCK_ARRIVAL_AGE_WEEKS = 16;

const computeAgeWeeks = (dateAcquired) => {
  if (!dateAcquired) return FLOCK_ARRIVAL_AGE_WEEKS;
  const acquired = new Date(toDateOnly(dateAcquired));
  const now = new Date(localToday());
  const diffDays = Math.floor((now - acquired) / (1000 * 60 * 60 * 24));
  return FLOCK_ARRIVAL_AGE_WEEKS + Math.max(0, Math.floor(diffDays / 7));
};

const ensureQuarantineRecord = async (flock, req) => {
  const existing = await QuarantineIsolation.findOne({
    batchId: flock.batchId,
    recordType: "Quarantine",
  });
  if (existing) return existing;

  const record = await QuarantineIsolation.create({
    recordType: "Quarantine",
    batchId: flock.batchId,
    source: flock.supplier,
    breed: flock.breed,
    headCount: flock.currentQuantity,
    status: "Ongoing",
  });

  await createAuditLog({
    user: req.user.name,
    role: req.user.role,
    module: "Quarantine",
    action: "Added",
    description: `Batch ${flock.batchId} automatically placed under Quarantine on arrival.`,
  });

  return record;
};

exports.createFlock = async (req, res) => {
  try {
    const {
      breed,
      newBreed,
      supplier,
      newSupplier,
      dateAcquired,
      dateAcquiredEnd,
      quantityPurchased,
    } = req.body;

    if (!dateAcquired) {
      return res.status(400).json({
        success: false,
        message: "Date Acquired is required.",
      });
    }

    if (isFutureDate(dateAcquired)) {
      return res.status(400).json({
        success: false,
        message: "Date Acquired cannot be a future date.",
      });
    }

    if (dateAcquiredEnd) {
      if (isFutureDate(dateAcquiredEnd)) {
        return res.status(400).json({
          success: false,
          message: "Date Acquired (end) cannot be a future date.",
        });
      }
      if (toDateOnly(dateAcquiredEnd) < toDateOnly(dateAcquired)) {
        return res.status(400).json({
          success: false,
          message: "Date Acquired (end) cannot be earlier than the start date.",
        });
      }
    }

    if (!isStrictPositiveInteger(quantityPurchased)) {
      return res.status(400).json({
        success: false,
        message: "Purchased Quantity must be a whole number greater than zero.",
      });
    }

    const resolvedBreed = newBreed && newBreed.trim()
      ? await resolveBreedName(newBreed)
      : breed;
    const resolvedSupplier = newSupplier && newSupplier.trim()
      ? await resolveSupplierName(newSupplier)
      : supplier;

    if (!resolvedBreed) {
      return res.status(400).json({
        success: false,
        message: "Please select or enter a Breed.",
      });
    }
    if (!resolvedSupplier) {
      return res.status(400).json({
        success: false,
        message: "Please select or enter a Supplier.",
      });
    }

    const batchId = await generateBatchId();
    const purchaseQty = Number(quantityPurchased);

    const status = toDateOnly(dateAcquired) === localToday() ? "Quarantined" : "Active";

    const flock = await Flock.create({
      batchId,
      breed: resolvedBreed,
      supplier: resolvedSupplier,
      dateAcquired,
      dateAcquiredEnd: dateAcquiredEnd || null,
      quantityPurchased: purchaseQty,
      currentQuantity: purchaseQty,
      totalMortality: 0,
      mortalityRate: 0,
      status,
      createdBy: req.user.id,
    });

    if (status === "Quarantined") {
      await ensureQuarantineRecord(flock, req);
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Flock Profile",
      action: "Added",
      description: `Added flock ${batchId}`,
      next: flock,
    });

    res.status(201).json({
      success: true,
      record: flock,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message || "Unable to create flock.",
    });
  }
};

exports.getAllFlocks = async (req, res) => {
  try {
    const {
      search,
      breed,
      status,
      dateFrom,
      dateTo,
    } = req.query;

    const filter = {
      isArchived: false,
    };

    if (search) {
      filter.$or = [
        { batchId: { $regex: search, $options: "i" } },
        { breed: { $regex: search, $options: "i" } },
      ];
    }

    if (breed) filter.breed = breed;
    if (status) filter.status = status;

    if (dateFrom || dateTo) {
      filter.dateAcquired = {};
      if (dateFrom && !isNaN(new Date(dateFrom))) filter.dateAcquired.$gte = new Date(dateFrom);
      if (dateTo && !isNaN(new Date(dateTo))) filter.dateAcquired.$lte = new Date(dateTo);
      if (Object.keys(filter.dateAcquired).length === 0) delete filter.dateAcquired;
    }

    const flocks = await Flock.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      records: flocks,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message || "Unable to fetch flocks.",
    });
  }
};

exports.getFlockById = async (req, res) => {
  try {
    const flock = await Flock.findById(req.params.id);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found.",
      });
    }

    res.json({
      success: true,
      record: flock,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to load flock.",
    });
  }
};

exports.updateFlock = async (req, res) => {
  try {
    const flock = await Flock.findById(req.params.id);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found.",
      });
    }

    const previous = flock.toObject();

    const {
      breed,
      newBreed,
      supplier,
      newSupplier,
      dateAcquired,
      dateAcquiredEnd,
      quantityPurchased,
      currentQuantity,
      totalMortality,
    } = req.body;

    if (dateAcquired !== undefined) {
      if (!dateAcquired) {
        return res.status(400).json({
          success: false,
          message: "Date Acquired is required.",
        });
      }
      if (isFutureDate(dateAcquired)) {
        return res.status(400).json({
          success: false,
          message: "Date Acquired cannot be a future date.",
        });
      }
    }

    const effectiveStart = dateAcquired !== undefined ? dateAcquired : flock.dateAcquired;
    const effectiveEnd = dateAcquiredEnd !== undefined ? dateAcquiredEnd : flock.dateAcquiredEnd;

    if (effectiveEnd) {
      if (isFutureDate(effectiveEnd)) {
        return res.status(400).json({
          success: false,
          message: "Date Acquired (end) cannot be a future date.",
        });
      }
      if (toDateOnly(effectiveEnd) < toDateOnly(effectiveStart)) {
        return res.status(400).json({
          success: false,
          message: "Date Acquired (end) cannot be earlier than the start date.",
        });
      }
    }

    if (quantityPurchased !== undefined && !isStrictPositiveInteger(quantityPurchased)) {
      return res.status(400).json({
        success: false,
        message: "Purchased Quantity must be a whole number greater than zero.",
      });
    }

    if (currentQuantity !== undefined && !isStrictNonNegativeInteger(currentQuantity)) {
      return res.status(400).json({
        success: false,
        message: "Current Quantity must be a whole number and cannot be negative.",
      });
    }

    if (breed !== undefined || newBreed) {
      flock.breed = newBreed && newBreed.trim()
        ? await resolveBreedName(newBreed)
        : breed;
    }
    if (supplier !== undefined || newSupplier) {
      flock.supplier = newSupplier && newSupplier.trim()
        ? await resolveSupplierName(newSupplier)
        : supplier;
    }

    if (dateAcquired !== undefined) flock.dateAcquired = dateAcquired;
    if (dateAcquiredEnd !== undefined) flock.dateAcquiredEnd = dateAcquiredEnd || null;
    if (quantityPurchased !== undefined) flock.quantityPurchased = Number(quantityPurchased);
    if (currentQuantity !== undefined) flock.currentQuantity = Number(currentQuantity);
    if (totalMortality !== undefined) flock.totalMortality = Number(totalMortality) || 0;

    flock.mortalityRate = flock.quantityPurchased > 0
      ? (flock.totalMortality / flock.quantityPurchased) * 100
      : 0;

    flock.updatedBy = req.user.id;

    await flock.save();

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Flock Profile",
      action: "Edited",
      description: `Updated flock ${flock.batchId}`,
      prev: previous,
      next: flock,
    });

    res.json({
      success: true,
      record: flock,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update flock.",
    });
  }
};

exports.updateFlockStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["Active", "Culled"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either Active or Culled.",
      });
    }

    const flock = await Flock.findById(req.params.id);
    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found.",
      });
    }

    if (flock.status === "Quarantined") {
      return res.status(400).json({
        success: false,
        message: "This batch is still under Quarantine. Its status can only change through the Quarantine Release workflow.",
      });
    }

    if (flock.status === status) {
      return res.json({ success: true, record: flock });
    }

    if (flock.status === "Culled") {
      return res.status(400).json({
        success: false,
        message: "A Culled batch cannot be reactivated.",
      });
    }

    const previous = flock.toObject();

    if (status === "Culled") {
      const birdsBeforeCulling = flock.currentQuantity;
      const cullDate = new Date();
      const cullDateStr = toDateOnly(cullDate);
      const mortalityId = await generateMortalityId();

      const mortalityRecord = await MortalityRecord.create({
        mortalityId,
        date: cullDate,
        batchId: flock.batchId,
        numberOfMortality: Math.max(1, birdsBeforeCulling),
        causeOfDeath: "Culled",
        suspectedDisease: "",
        remarks: "",
        autoGeneratedFromCulling: true,
      });

      const remainingIsolationRecords = await QuarantineIsolation.find({
        recordType: "Isolation",
        batchId: flock.batchId,
        remaining: { $gt: 0 },
      });

      for (const isolationRecord of remainingIsolationRecords) {
        isolationRecord.deceased = (isolationRecord.deceased || 0) + isolationRecord.remaining;
        isolationRecord.remaining = 0;
        isolationRecord.currentStatus =
          isolationRecord.recovered === 0 ? "Deceased" : "Completed";
        isolationRecord.dateCompleted = cullDateStr;
        await isolationRecord.save();
      }

      flock.totalMortality = (flock.totalMortality || 0) + birdsBeforeCulling;
      flock.currentQuantity = 0;
      flock.mortalityRate = flock.quantityPurchased > 0
        ? (flock.totalMortality / flock.quantityPurchased) * 100
        : 0;
      flock.status = "Culled";

      await flock.save();

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Mortality Record",
        action: "Added",
        description: `Auto-recorded ${birdsBeforeCulling} mortality for Culled batch ${flock.batchId}.`,
        next: mortalityRecord,
      });

      await createNotification({
        title: "Batch Culled",
        description: `Batch ${flock.batchId} has been marked as Culled — ${birdsBeforeCulling} birds affected as of ${cullDate.toLocaleDateString()}.`,
        category: "age",
        type: "alert",
        priority: "High",
        roles: ["Owner", "Farmer"],
      });
    } else {
      flock.status = "Active";
      await flock.save();
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Flock Profile",
      action: "Edited",
      description: `Changed flock ${flock.batchId} status to ${status}.`,
      prev: previous,
      next: flock,
    });

    res.json({
      success: true,
      record: flock,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to update flock status.",
    });
  }
};

exports.archiveFlock = async (req, res) => {
  try {
    const flock = await Flock.findById(req.params.id);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found.",
      });
    }

    flock.isArchived = true;
    flock.archivedAt = new Date();
    flock.archivedBy = req.user.id;

    await flock.save();

    await createArchiveEntry({
      module: "Flock Profile",
      moduleKey: "pb_batches",
      recordId: flock._id,
      recordName: flock.batchId,
      archivedBy: req.user.name,
      payload: flock.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Flock Profile",
      action: "Archived",
      description: `Archived flock ${flock.batchId}`,
      prev: flock,
    });

    res.json({
      success: true,
      message: "Flock archived successfully.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to archive flock.",
    });
  }
};

exports.restoreFlock = async (req, res) => {
  try {
    const flock = await Flock.findById(req.params.id);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found.",
      });
    }

    flock.isArchived = false;
    flock.archivedAt = null;
    flock.archivedBy = null;

    await flock.save();

    await Archive.findOneAndDelete({
      moduleKey: "pb_batches",
      recordId: flock._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Flock Profile",
      action: "Restored",
      description: `Restored flock ${flock.batchId}`,
      next: flock,
    });

    res.json({
      success: true,
      message: "Flock restored successfully.",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to restore flock.",
    });
  }
};

exports.getArchivedFlocks = async (req, res) => {
  try {
    const flocks = await Flock.find({
      isArchived: true,
    }).sort({ updatedAt: -1 });

    res.json({
      success: true,
      records: flocks,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Unable to load archived flocks.",
    });
  }
};

exports.deleteFlockPermanently = async (req, res) => {
  try {
    const flock = await Flock.findById(req.params.id);

    if (!flock) {
      return res.status(404).json({
        success: false,
        message: "Flock not found.",
      });
    }

    if (!flock.isArchived) {
      return res.status(400).json({
        success: false,
        message: "Only archived flocks can be permanently deleted.",
      });
    }

    const block = await assertNoDependencies("flock", flock._id);
    if (block) {
      return res.status(409).json(block);
    }

    await Flock.findByIdAndDelete(flock._id);

    await Archive.findOneAndDelete({
      moduleKey: "pb_batches",
      recordId: flock._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Flock Profile",
      action: "Deleted",
      description: `Permanently deleted flock batch '${flock.batchId}'.`,
    });

    res.json({
      success: true,
      message: "Flock permanently deleted.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Unable to delete flock.",
    });
  }
};