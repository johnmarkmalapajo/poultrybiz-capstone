const ManureRecord = require("../models/ManureRecord");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { resolveHealthOption } = require("./healthOptionController");
const Archive = require("../models/Archive");

exports.createManureRecord = async (req, res) => {
  try {
    const { methodOfHandling, newMethodOfHandling, endUse, newEndUse, ...rest } = req.body;

    const resolvedMethodOfHandling = newMethodOfHandling && newMethodOfHandling.trim()
      ? await resolveHealthOption("manureMethod", newMethodOfHandling)
      : methodOfHandling;

    const resolvedEndUse = newEndUse && newEndUse.trim()
      ? await resolveHealthOption("manureEndUse", newEndUse)
      : endUse;

    const record = await ManureRecord.create({
      ...rest,
      methodOfHandling: resolvedMethodOfHandling,
      endUse: resolvedEndUse,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Manure Record",
      action: "Added",
      description: `Added manure record for batch '${record.batchId}'.`,
    });

    return res.status(201).json({
      success: true,
      message: "Manure record created successfully.",
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

exports.getAllManureRecords = async (req, res) => {
  try {
    const records = await ManureRecord.find({
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

exports.getManureRecord = async (req, res) => {
  try {
    const record = await ManureRecord.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
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

exports.updateManureRecord = async (req, res) => {
  try {
    const { methodOfHandling, newMethodOfHandling, endUse, newEndUse, ...rest } = req.body;

    const resolvedMethodOfHandling = newMethodOfHandling && newMethodOfHandling.trim()
      ? await resolveHealthOption("manureMethod", newMethodOfHandling)
      : methodOfHandling;

    const resolvedEndUse = newEndUse && newEndUse.trim()
      ? await resolveHealthOption("manureEndUse", newEndUse)
      : endUse;

    const updatePayload = { ...rest };
    if (resolvedMethodOfHandling !== undefined) updatePayload.methodOfHandling = resolvedMethodOfHandling;
    if (resolvedEndUse !== undefined) updatePayload.endUse = resolvedEndUse;

    const record = await ManureRecord.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Manure Record",
      action: "Edited",
      description: `Updated manure record for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Record updated successfully.",
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

exports.archiveManureRecord = async (req, res) => {
  try {
    const record = await ManureRecord.findByIdAndUpdate(
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
        message: "Record not found.",
      });
    }

    await createArchiveEntry({
      module: "Manure Record",
      moduleKey: "pb_waste",
      recordId: record._id,
      recordName: `Batch ${record.batchId}`,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Manure Record",
      action: "Archived",
      description: `Archived manure record for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Record archived successfully.",
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

exports.restoreManureRecord = async (req, res) => {
  try {
    const record = await ManureRecord.findByIdAndUpdate(
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
        message: "Record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_waste",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Manure Record",
      action: "Restored",
      description: `Restored manure record for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Record restored successfully.",
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

exports.deleteManureRecord = async (req, res) => {
  try {
    const record = await ManureRecord.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_waste",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Manure Record",
      action: "Deleted",
      description: `Deleted manure record for batch '${record.batchId}'.`,
    });

    return res.json({
      success: true,
      message: "Record deleted successfully.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};