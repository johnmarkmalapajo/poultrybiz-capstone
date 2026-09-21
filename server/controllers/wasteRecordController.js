const WasteRecord = require("../models/WasteRecord");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
// =====================================================
// CREATE
// =====================================================

exports.createWasteRecord = async (req, res) => {
  try {
    const record = await WasteRecord.create(req.body);

    await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Waste Record",
        action: "Added",
        description: `Added waste record for batch '${record.batchId}'.`,
        });

    return res.status(201).json({
      success: true,
      message: "Waste record created successfully.",
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

// =====================================================
// GET ALL
// =====================================================

exports.getAllWasteRecords = async (req, res) => {
  try {
    const records = await WasteRecord.find({
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

// =====================================================
// GET ONE
// =====================================================

exports.getWasteRecord = async (req, res) => {
  try {
    const record = await WasteRecord.findById(req.params.id);

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

// =====================================================
// UPDATE
// =====================================================

exports.updateWasteRecord = async (req, res) => {
  try {
    const record = await WasteRecord.findByIdAndUpdate(
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
        message: "Record not found.",
      });
    }

    await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Waste Record",
        action: "Edited",
        description: `Updated waste record for batch '${record.batchId}'.`,
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

// =====================================================
// ARCHIVE
// =====================================================

exports.archiveWasteRecord = async (req, res) => {
  try {
    const record = await WasteRecord.findByIdAndUpdate(
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
      module: "Waste Record",
      moduleKey: "pb_waste",
      recordId: record._id,
      recordName: `Batch ${record.batchId}`,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Waste Record",
        action: "Archived",
        description: `Archived waste record for batch '${record.batchId}'.`,
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

// =====================================================
// RESTORE
// =====================================================

exports.restoreWasteRecord = async (req, res) => {
  try {
    const record = await WasteRecord.findByIdAndUpdate(
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

    await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Waste Record",
        action: "Restored",
        description: `Restored waste record for batch '${record.batchId}'.`,
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

// =====================================================
// DELETE
// =====================================================

exports.deleteWasteRecord = async (req, res) => {
  try {
    const record = await WasteRecord.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Waste Record",
        action: "Deleted",
        description: `Deleted waste record for batch '${record.batchId}'.`,
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