const mongoose = require("mongoose");
const Equipment = require("../models/Equipment");
const Personnel = require("../models/Personnel");
const { isFutureDate, FUTURE_DATE_MESSAGE } = require("../utils/dateGuard");
const ExpenseRecord = require("../models/ExpenseRecord");
const { resolveHealthOption } = require("./healthOptionController");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const Archive = require("../models/Archive");

const EXPENSE_OWNED_EQUIPMENT_FIELDS = [
  "name",
  "description",
  "quantity",
  "unit",
  "dateAcquired",
  "cost",
];

// ── Custodian / Assigned To (Personnel and Manpower) ─────────────────────

// The assigned Personnel record, with the account name and statuses needed
// to show it and to tell whether it can still be assigned.
const CUSTODIAN_POPULATE = {
  path: "custodianPersonnel",
  select: "user position status archived",
  populate: { path: "user", select: "name status archived" },
};

// Same rule Personnel and Manpower uses for assigning tasks: an archived
// record or an account that isn't Active can't be given new work -- plus the
// record's own Employment Status must be Active.
function custodianState(p) {
  if (!p || !p.user) return "missing";
  if (p.archived || p.user.archived) return "archived";
  if (p.status !== "Active" || (p.user.status && p.user.status !== "Active")) return "inactive";
  return "eligible";
}

// The record as sent to the client: custodianPersonnel as a plain id,
// custodian as the person's current name (the saved name if the Personnel
// record is gone, or for older records that only have a name), and
// custodianInfo describing the assignment for the forms.
function withCustodian(doc) {
  if (!doc) return doc;
  const r = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  const linked = r.custodianPersonnel;
  const p = linked && typeof linked === "object" && linked.user !== undefined ? linked : null;
  const personnelId = p ? String(p._id) : linked ? String(linked) : null;
  const name = p?.user?.name || r.custodian || "";
  r.custodianPersonnel = personnelId;
  r.custodian = name;
  r.custodianInfo = personnelId || name
    ? {
        personnelId,
        name,
        position: p?.position || "",
        // eligible | inactive | archived | missing (record deleted) |
        // unlinked (an older record with a name only)
        state: personnelId ? custodianState(p) : "unlinked",
      }
    : null;
  return r;
}

// Works out what to save for the custodian from a create / update request.
// Only custodianPersonnel (a Personnel _id) is accepted: names are never
// typed in, they always come from the Personnel record. Returns
// { set } (fields to save), {} (no change) or { status, message }.
async function custodianChange(body, existing, role) {
  const sent = Object.prototype.hasOwnProperty.call(body, "custodianPersonnel");
  const raw = body.custodianPersonnel;
  delete body.custodianPersonnel;
  delete body.custodian;
  delete body.custodianInfo;
  if (!sent) return {};

  const id = raw ? String(raw) : "";
  const currentId = existing?.custodianPersonnel ? String(existing.custodianPersonnel) : "";
  // Unchanged: the existing assignment stays exactly as it is -- even if
  // that person has since been deactivated or archived, and for older
  // records that only have a name.
  if (id === currentId) return {};

  if (role !== "Owner") {
    return { status: 403, message: "Only the Owner can assign a custodian." };
  }
  if (!id) return { set: { custodianPersonnel: null, custodian: "" } };
  if (!mongoose.isValidObjectId(id)) {
    return { status: 400, message: "Select a custodian from Personnel and Manpower." };
  }

  const personnel = await Personnel.findById(id).populate("user", "name status archived");
  const state = custodianState(personnel);
  if (state === "missing") {
    return { status: 400, message: "The selected personnel record no longer exists." };
  }
  if (state !== "eligible") {
    return {
      status: 400,
      message: `${personnel.user.name} is ${state === "archived" ? "archived" : "not active"} and can't be assigned as custodian.`,
    };
  }
  return { set: { custodianPersonnel: personnel._id, custodian: personnel.user.name } };
}

// One-time, on startup: older Equipment records saved the custodian as a
// typed name only. Where that name belongs to exactly one Personnel record,
// the record is linked to it (the name itself is kept). Names with no match,
// or more than one, are left exactly as they are.
exports.linkLegacyCustodians = async () => {
  const unlinked = await Equipment.find({
    custodianPersonnel: null,
    custodian: { $nin: ["", null] },
  }).select("custodian");
  if (!unlinked.length) return { linked: 0, unmatched: 0 };

  const personnel = await Personnel.find({}).populate("user", "name").select("user").lean();
  const byName = new Map();
  for (const p of personnel) {
    const key = (p.user?.name || "").trim().toLowerCase();
    if (!key) continue;
    byName.set(key, byName.has(key) ? null : p._id); // null = ambiguous
  }

  let linked = 0;
  for (const eq of unlinked) {
    const match = byName.get(eq.custodian.trim().toLowerCase());
    if (match) {
      await Equipment.updateOne({ _id: eq._id }, { $set: { custodianPersonnel: match } });
      linked += 1;
    }
  }
  const unmatched = unlinked.length - linked;
  console.log(`Equipment custodians: ${linked} linked to Personnel records, ${unmatched} kept as name only.`);
  return { linked, unmatched };
};

exports.createEquipment = async (req, res) => {
  try {
    if (isFutureDate(req.body.dateAcquired)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }
    const { itemNo, expenseRecordId, ...payload } = req.body;

    const serialNo = Equipment.cleanSerialNo(payload.serialNo);
    if (!serialNo) {
      return res.status(400).json({ success: false, message: Equipment.SERIAL_ID_REQUIRED_MESSAGE });
    }

    const custodian = await custodianChange(payload, null, req.user.role);
    if (custodian.message) {
      return res.status(custodian.status).json({ success: false, message: custodian.message });
    }

    const created = await Equipment.create({ ...payload, ...custodian.set, serialNo });
    const record = withCustodian(await created.populate(CUSTODIAN_POPULATE));

    // Keep the shared Location/Storage list complete (no-op if it's there).
    await resolveHealthOption("equipmentLocation", record.location);

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
    const found = await Equipment.find({
      archived: false,
    })
      .populate(CUSTODIAN_POPULATE)
      .sort({
        createdAt: -1,
      });
    const records = found.map(withCustodian);

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
    const found = await Equipment.findById(req.params.id).populate(CUSTODIAN_POPULATE);

    if (!found) {
      return res.status(404).json({
        success: false,
        message: "Equipment record not found.",
      });
    }

    return res.json({
      success: true,
      record: withCustodian(found),
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
    if (isFutureDate(req.body.dateAcquired)) {
      return res.status(400).json({ success: false, message: FUTURE_DATE_MESSAGE });
    }
    const { itemNo, expenseRecordId, ...updates } = req.body;

    const existing = await Equipment.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Equipment record not found.",
      });
    }

    const custodian = await custodianChange(updates, existing, req.user.role);
    if (custodian.message) {
      return res.status(custodian.status).json({ success: false, message: custodian.message });
    }

    let finalUpdates = { ...updates, ...custodian.set };

    if (existing.expenseRecordId) {
      finalUpdates = { ...finalUpdates };
      for (const field of EXPENSE_OWNED_EQUIPMENT_FIELDS) {
        delete finalUpdates[field];
      }
    }

    // Serial ID can be updated here (also on a record created through an
    // Expense Record) but can never be cleared.
    if (Object.prototype.hasOwnProperty.call(finalUpdates, "serialNo")) {
      const serialNo = Equipment.cleanSerialNo(finalUpdates.serialNo);
      if (!serialNo) {
        return res.status(400).json({ success: false, message: Equipment.SERIAL_ID_REQUIRED_MESSAGE });
      }
      finalUpdates = { ...finalUpdates, serialNo };
    }

    const updated = await Equipment.findByIdAndUpdate(
      req.params.id,
      finalUpdates,
      {
        new: true,
        runValidators: true,
      }
    ).populate(CUSTODIAN_POPULATE);
    const record = withCustodian(updated);

    if (finalUpdates.location !== undefined) {
      await resolveHealthOption("equipmentLocation", record?.location);
    }

    // Keep the linked Expense Record's copy of the Serial ID the same, so
    // Edit Expense loads the updated value (and does not sync the old one
    // back).
    if (existing.expenseRecordId && finalUpdates.serialNo !== undefined) {
      await ExpenseRecord.updateOne(
        { _id: existing.expenseRecordId },
        { $set: { serialNo: finalUpdates.serialNo } }
      );
    }

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