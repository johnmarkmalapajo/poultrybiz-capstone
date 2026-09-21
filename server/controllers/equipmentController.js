const Equipment = require("../models/Equipment");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const Archive = require("../models/Archive");

const EXPENSE_OWNED_EQUIPMENT_FIELDS = [
  "name",
  "description",
  "serialNo",
  "quantity",
  "unit",
  "dateAcquired",
  "cost",
];

exports.createEquipment = async (req, res) => {
  try {
    const { itemNo, expenseRecordId, ...payload } = req.body;
    const record = await Equipment.create(payload);

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Equipment & Tools",
      action: "Added",
      description: `Added equipment '${record.itemName}'.`,
    });

    return res.status(201).json({
      success: true,
      message: "Equipment record created successfully.",
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

exports.getAllEquipment = async (req, res) => {
  try {
    const records = await Equipment.find({
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

exports.getEquipment = async (req, res) => {
  try {
    const record = await Equipment.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Equipment record not found.",
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

exports.updateEquipment = async (req, res) => {
  try {
    const { itemNo, expenseRecordId, ...updates } = req.body;

    const existing = await Equipment.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Equipment record not found.",
      });
    }

    let finalUpdates = updates;

    if (existing.expenseRecordId) {
      finalUpdates = { ...updates };
      for (const field of EXPENSE_OWNED_EQUIPMENT_FIELDS) {
        delete finalUpdates[field];
      }
    }

    const record = await Equipment.findByIdAndUpdate(
      req.params.id,
      finalUpdates,
      {
        new: true,
        runValidators: true,
      }
    );

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Equipment & Tools",
      action: "Edited",
      description: `Updated equipment '${record.name}'.`,
    });

    return res.json({
      success: true,
      message: "Equipment updated successfully.",
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

exports.archiveEquipment = async (req, res) => {
  try {
    const record = await Equipment.findByIdAndUpdate(
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
        message: "Equipment record not found.",
      });
    }

    await createArchiveEntry({
      module: "Equipment & Tools",
      moduleKey: "pb_equipment",
      recordId: record._id,
      recordName: record.name,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Equipment & Tools",
      action: "Archived",
      description: `Archived equipment '${record.name}'.`,
    });

    return res.json({
      success: true,
      message: "Equipment archived successfully.",
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

exports.restoreEquipment = async (req, res) => {
  try {
    const record = await Equipment.findByIdAndUpdate(
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
        message: "Equipment record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_equipment",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Equipment & Tools",
      action: "Restored",
      description: `Restored equipment '${record.name}'.`,
    });

    return res.json({
      success: true,
      message: "Equipment restored successfully.",
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

exports.deleteEquipment = async (req, res) => {
  try {
    const record = await Equipment.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Equipment record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_equipment",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Equipment & Tools",
      action: "Deleted",
      description: `Deleted equipment '${record.name}'.`,
    });

    return res.json({
      success: true,
      message: "Equipment deleted successfully.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};