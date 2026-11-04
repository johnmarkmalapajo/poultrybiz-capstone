const WasteRecord = require("../models/WasteRecord");
const { isFutureDate, FUTURE_DATE_MESSAGE } = require("../utils/dateGuard");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { resolveHealthOption } = require("./healthOptionController");

// Predefined choices. "Other"/"Others" is only a trigger for the custom text
// box and is never stored when the user supplies a specific value.
const WASTE_TYPES = ["Dead Birds", "Plastic Waste", "Feed Bags", "Broken Eggs", "Chemical Containers"];
const DISPOSAL_METHODS = ["Burial", "Burning", "Recycling", "Composting", "Disposal"];
const CUSTOM_MAX_LENGTH = 60;

const normalizeCustom = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const isOthersWord = (value) => /^others?$/i.test(String(value ?? "").trim());

// Resolves the value to store for one of the two "Others" dropdowns.
//  - custom text given  -> validated, de-duplicated against predefined values
//    and previously saved custom values (case/space-insensitive), saved once.
//  - plain "Others" with no custom text -> rejected.
//  - anything else -> stored as selected (this keeps old records and the
//    legacy "Other" value editable).
// Returns { value } or { error }.
const resolveWasteChoice = async ({ category, label, selected, custom, predefined, existing }) => {
  const customText = normalizeCustom(custom);
  const selectedText = normalizeCustom(selected);

  // Editing an old record that still holds the legacy value (e.g. "Other")
  // and leaving it untouched must not force the user to retype it.
  if (!customText && existing && selectedText && selectedText === normalizeCustom(existing)) {
    return { value: selectedText };
  }

  if (customText || isOthersWord(selectedText)) {
    if (!customText) {
      return { error: `Please enter the specific ${label}.` };
    }
    if (isOthersWord(customText)) {
      return { error: `Please enter a specific ${label}, not the word "Others".` };
    }
    if (customText.length > CUSTOM_MAX_LENGTH) {
      return { error: `${label.charAt(0).toUpperCase() + label.slice(1)} must be ${CUSTOM_MAX_LENGTH} characters or fewer.` };
    }
    if (!/[\p{L}\p{N}]/u.test(customText)) {
      return { error: `Please enter a valid ${label}.` };
    }
    const builtIn = predefined.find((p) => p.toLowerCase() === customText.toLowerCase());
    if (builtIn) return { value: builtIn };
    return { value: await resolveHealthOption(category, customText) };
  }

  if (!selectedText) return { error: `${label.charAt(0).toUpperCase() + label.slice(1)} is required.` };
  return { value: selectedText };
};

const resolveWasteFields = async (body, existingRecord) => {
  const type = await resolveWasteChoice({
    category: "wasteType",
    label: "waste type",
    selected: body.wasteType,
    custom: body.newWasteType,
    predefined: WASTE_TYPES,
    existing: existingRecord?.wasteType,
  });
  if (type.error) return { error: type.error };

  const method = await resolveWasteChoice({
    category: "disposalMethod",
    label: "disposal method",
    selected: body.disposalMethod,
    custom: body.newDisposalMethod,
    predefined: DISPOSAL_METHODS,
    existing: existingRecord?.disposalMethod,
  });
  if (method.error) return { error: method.error };

  return { wasteType: type.value, disposalMethod: method.value };
};
// =====================================================
// CREATE
// =====================================================

exports.createWasteRecord = async (req, res) => {
  try {
    if (isFutureDate(req.body.date)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }

    const { newWasteType, newDisposalMethod, ...rest } = req.body;

    const resolved = await resolveWasteFields(req.body);
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const record = await WasteRecord.create({
      ...rest,
      wasteType: resolved.wasteType,
      disposalMethod: resolved.disposalMethod,
    });

    await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Waste Record",
        action: "Added",
        description: `Added waste record (${record.wasteType}).`,
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
    if (isFutureDate(req.body.date)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }

    const { newWasteType, newDisposalMethod, ...rest } = req.body;

    const existingRecord = await WasteRecord.findById(req.params.id);
    if (!existingRecord) {
      return res.status(404).json({ success: false, message: "Record not found." });
    }

    const resolved = await resolveWasteFields(req.body, existingRecord);
    if (resolved.error) {
      return res.status(400).json({ success: false, message: resolved.error });
    }

    const record = await WasteRecord.findByIdAndUpdate(
      req.params.id,
      { ...rest, wasteType: resolved.wasteType, disposalMethod: resolved.disposalMethod },
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