const mongoose = require("mongoose");
const QuarantineIsolation = require("../models/QuarantineIsolation");
const HealthRecord = require("../models/HealthRecord");
const Flock = require("../models/Flock");
const MortalityRecord = require("../models/MortalityRecord");
const { generateMortalityId } = require("./mortalityRecordController");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { resolveHealthOption } = require("./healthOptionController");
const { createNotification } = require("./notificationController");
const Archive = require("../models/Archive");

const computeVitaminsGiven = async (batchId) => {
  const records = await HealthRecord.find({
    batchId,
    recordType: "Vaccination",
    isolationId: null,
    archived: false,
  }).sort({ date: 1 });

  return records.map((r) => r.vaccineOrDrug).filter(Boolean).join(", ");
};

const toDateOnly = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

const withVitaminsGiven = async (record) => {
  const obj = record.toObject ? record.toObject() : record;
  if (obj.recordType === "Quarantine") {
    obj.vitaminsGiven = await computeVitaminsGiven(obj.batchId);
  }
  const flockForDate = await Flock.findOne({ batchId: obj.batchId }).select("dateAcquired");
  obj.dateAcquired = flockForDate?.dateAcquired ? toDateOnly(flockForDate.dateAcquired) : "";
  return obj;
};

const generateIsolationId = async () => {
  const latest = await QuarantineIsolation.findOne({ isolationId: { $ne: null } }).sort({
    createdAt: -1,
  });

  if (!latest || !latest.isolationId) return "ISO-001";

  const latestNumber = parseInt(latest.isolationId.replace("ISO-", ""), 10);

  return `ISO-${String(latestNumber + 1).padStart(3, "0")}`;
};

const generateDiagnosisCode = async () => {
  const latest = await HealthRecord.findOne({ diagnosisCode: { $ne: null } }).sort({
    createdAt: -1,
  });

  if (!latest || !latest.diagnosisCode) return "D-001";

  const latestNumber = parseInt(latest.diagnosisCode.replace("D-", ""), 10);

  return `D-${String(latestNumber + 1).padStart(3, "0")}`;
};

const computeAgeWeeks = (dateAcquired) => {
  if (!dateAcquired) return "";
  const start = new Date(dateAcquired);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
};

const localToday = () => {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
};

const isFutureDate = (value) => {
  if (!value) return false;
  return String(value).slice(0, 10) > localToday();
};

const isWholeNumber = (value) => /^\d+$/.test(String(value ?? "").trim());

const resolveSymptoms = async (symptoms, newSymptom) => {
  if (newSymptom && newSymptom.trim()) {
    return resolveHealthOption("symptom", newSymptom);
  }
  return symptoms;
};

exports.createQuarantineRecord = async (req, res) => {
  try {
    const { recordType, batchId } = req.body;

    if (recordType === "Isolation") {
      const { dateIsolated, headCount, symptoms, newSymptom, location, remarks } = req.body;

      if (!batchId || !dateIsolated) {
        return res.status(400).json({
          success: false,
          message: "Batch and Date Isolated are required.",
        });
      }
      if (isFutureDate(dateIsolated)) {
        return res.status(400).json({
          success: false,
          message: "Date Isolated cannot be in the future.",
        });
      }
      if (!isWholeNumber(headCount) || Number(headCount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "Number of Birds Isolated must be a whole number greater than zero.",
        });
      }

      const flockForIsolation = await Flock.findOne({ batchId });
      if (!flockForIsolation) {
        return res.status(400).json({
          success: false,
          message: "Selected Batch ID was not found.",
        });
      }

      const ongoingQuarantineForBatch = await QuarantineIsolation.findOne({
        batchId,
        recordType: "Quarantine",
        status: "Ongoing",
      });
      if (ongoingQuarantineForBatch) {
        return res.status(400).json({
          success: false,
          message: "This batch is still under Ongoing Quarantine and is not yet eligible for Isolation. Release it from Quarantine first.",
        });
      }

      if (Number(headCount) > flockForIsolation.currentQuantity) {
        return res.status(400).json({
          success: false,
          message: `Number of Birds Isolated cannot exceed the available birds in this batch (${flockForIsolation.currentQuantity}).`,
        });
      }

      const resolvedSymptoms = await resolveSymptoms(symptoms, newSymptom);
      if (!resolvedSymptoms) {
        return res.status(400).json({
          success: false,
          message: "Symptoms/Reasons is required.",
        });
      }

      const isolationId = await generateIsolationId();
      const count = Number(headCount);

      const record = await QuarantineIsolation.create({
        recordType: "Isolation",
        isolationId,
        batchId,
        dateIsolated,
        headCount: count,
        symptoms: resolvedSymptoms,
        location: location || "",
        remarks: remarks || "",
        recovered: 0,
        deceased: 0,
        remaining: count,
        dateCompleted: "",
        currentStatus: "In Isolation",
      });

      const diagnosisCode = await generateDiagnosisCode();

      const diagnosis = await HealthRecord.create({
        recordType: "Diagnosis",
        diagnosisCode,
        date: dateIsolated,
        batchId,
        isolationId: record._id,
        numberOfBirdsAffected: count,
        presumptiveDiagnosis: resolvedSymptoms,
        numberMortality: 0,
        targetAge: computeAgeWeeks(flockForIsolation.dateAcquired),
      });

      record.diagnosisId = diagnosis._id;
      await record.save();

      if (/sick|disease/i.test(resolvedSymptoms)) {
        await createNotification({
          title: "Disease Detected",
          description: `Health issue detected in Batch ${batchId}: ${resolvedSymptoms}. Reported ${new Date(dateIsolated).toLocaleDateString()} at ${new Date().toLocaleTimeString()}.`,
          category: "health",
          type: "alert",
          priority: "High",
          roles: ["Owner", "Farmer"],
        });
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Quarantine & Isolation",
        action: "Added",
        description: `Added Isolation record ${isolationId} for batch '${batchId}'.`,
      });

      return res.status(201).json({
        success: true,
        message: "Record created successfully.",
        record,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Quarantine records are created automatically from Flock Profile and cannot be added manually.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getAllQuarantineRecords = async (req, res) => {
  try {
    const records = await QuarantineIsolation.find({
      archived: false,
    }).sort({
      createdAt: -1,
    });

    const enriched = await Promise.all(records.map(withVitaminsGiven));

    return res.json({
      success: true,
      count: enriched.length,
      records: enriched,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.getQuarantineRecord = async (req, res) => {
  try {
    const record = await QuarantineIsolation.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    return res.json({
      success: true,
      record: await withVitaminsGiven(record),
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateQuarantineRecord = async (req, res) => {
  try {
    const existing = await QuarantineIsolation.findById(req.params.id);

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    if (existing.recordType === "Isolation") {
      const { batchId, dateIsolated, headCount, symptoms, newSymptom, location, remarks } = req.body;

      if (dateIsolated && isFutureDate(dateIsolated)) {
        return res.status(400).json({
          success: false,
          message: "Date Isolated cannot be in the future.",
        });
      }
      if (headCount != null && (!isWholeNumber(headCount) || Number(headCount) <= 0)) {
        return res.status(400).json({
          success: false,
          message: "Number of Birds Isolated must be a whole number greater than zero.",
        });
      }
      if (headCount != null && Number(headCount) < existing.recovered + existing.deceased) {
        return res.status(400).json({
          success: false,
          message: "Number of Birds Isolated cannot be less than birds already recovered/deceased.",
        });
      }

      const flockForIsolation = await Flock.findOne({ batchId: batchId ?? existing.batchId });
      if (!flockForIsolation) {
        return res.status(400).json({
          success: false,
          message: "Selected Batch ID was not found.",
        });
      }
      if (headCount != null && Number(headCount) > flockForIsolation.currentQuantity) {
        return res.status(400).json({
          success: false,
          message: `Number of Birds Isolated cannot exceed the available birds in this batch (${flockForIsolation.currentQuantity}).`,
        });
      }

      const resolvedSymptoms = newSymptom && newSymptom.trim()
        ? await resolveSymptoms(symptoms, newSymptom)
        : (symptoms ?? existing.symptoms);

      const symptomsChanged = resolvedSymptoms !== existing.symptoms;

      const newCount = headCount != null ? Number(headCount) : existing.headCount;

      const batchIdChanged = batchId != null && batchId !== existing.batchId;
      existing.batchId = batchId ?? existing.batchId;
      existing.dateIsolated = dateIsolated ?? existing.dateIsolated;
      existing.headCount = newCount;
      existing.symptoms = resolvedSymptoms;
      existing.location = location ?? existing.location;
      existing.remarks = remarks ?? existing.remarks;
      existing.remaining = Math.max(0, newCount - existing.recovered - existing.deceased);

      await existing.save();

      if (existing.diagnosisId) {
        await HealthRecord.findByIdAndUpdate(existing.diagnosisId, {
          batchId: existing.batchId,
          numberOfBirdsAffected: existing.headCount,
          ...(symptomsChanged && resolvedSymptoms ? { presumptiveDiagnosis: resolvedSymptoms } : {}),
        });
      }

      if (batchIdChanged) {
        const linkedMortalityIds = existing.progressUpdates
          .map((u) => u.mortalityRecordId)
          .filter(Boolean);
        if (linkedMortalityIds.length > 0) {
          await MortalityRecord.updateMany(
            { _id: { $in: linkedMortalityIds } },
            { batchId: existing.batchId },
          );
        }
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Quarantine & Isolation",
        action: "Edited",
        description: `Updated Isolation record ${existing.isolationId} for batch '${existing.batchId}'.`,
      });

      return res.json({
        success: true,
        message: "Record updated successfully.",
        record: existing,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Quarantine records cannot be edited directly. Use the Status control to release from quarantine.",
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

exports.updateQuarantineStatus = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responseRecord = null;

    await session.withTransaction(async () => {
      const record = await QuarantineIsolation.findById(req.params.id).session(session);

      if (!record) {
        throw Object.assign(new Error("Record not found."), { status: 404 });
      }
      if (record.recordType !== "Quarantine") {
        throw Object.assign(new Error("This record is not a Quarantine event."), { status: 400 });
      }

      const { status } = req.body;

      if (status !== "Released") {
        throw Object.assign(new Error("Status can only be changed to Released."), { status: 400 });
      }
      if (record.status !== "Ongoing") {
        throw Object.assign(new Error(`Cannot release -- current status is ${record.status || "unset"}, not Ongoing.`), { status: 400 });
      }

      const flock = await Flock.findOne({ batchId: record.batchId }).session(session);
      if (!flock) {
        throw Object.assign(new Error("Linked Flock Profile was not found."), { status: 400 });
      }

      record.status = "Released";
      const now = new Date();
      record.releasedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      await record.save({ session });

      flock.status = "Active";
      flock.updatedBy = req.user.id;
      await flock.save({ session });

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Quarantine & Isolation",
        action: "Edited",
        description: `Released Batch ${record.batchId} from quarantine.`,
      });

      responseRecord = record;
    });

    return res.json({
      success: true,
      message: "Quarantine released successfully.",
      record: await withVitaminsGiven(responseRecord),
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.status ? err.message : "Unable to update quarantine status.",
    });
  } finally {
    session.endSession();
  }
};

exports.updateIsolationProgress = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responseRecord = null;

    await session.withTransaction(async () => {
      const record = await QuarantineIsolation.findById(req.params.id).session(session);

      if (!record) {
        throw Object.assign(new Error("Record not found."), { status: 404 });
      }
      if (record.recordType !== "Isolation") {
        throw Object.assign(new Error("This record is not an Isolation event."), { status: 400 });
      }

      const { recoveredDelta, deceasedDelta, date } = req.body;
      const recDelta = recoveredDelta === undefined || recoveredDelta === "" ? 0 : recoveredDelta;
      const decDelta = deceasedDelta === undefined || deceasedDelta === "" ? 0 : deceasedDelta;

      if (!isWholeNumber(recDelta) || !isWholeNumber(decDelta)) {
        throw Object.assign(new Error("Recovered and Deceased must be whole numbers."), { status: 400 });
      }

      const recoveredNum = Number(recDelta);
      const deceasedNum = Number(decDelta);

      if (recoveredNum < 0 || deceasedNum < 0) {
        throw Object.assign(new Error("Values cannot be negative."), { status: 400 });
      }
      if (recoveredNum === 0 && deceasedNum === 0) {
        throw Object.assign(new Error("Enter at least one Recovered or Deceased update."), { status: 400 });
      }
      if (recoveredNum + deceasedNum > record.remaining) {
        throw Object.assign(
          new Error(`Recovered + Deceased (${recoveredNum + deceasedNum}) exceeds Remaining (${record.remaining}).`),
          { status: 400 },
        );
      }

      const updateDate = date || new Date().toISOString().slice(0, 10);

      record.recovered += recoveredNum;
      record.deceased += deceasedNum;
      record.remaining = Math.max(0, record.headCount - record.recovered - record.deceased);

      if (record.remaining === 0) {
        record.dateCompleted = updateDate;
        record.currentStatus =
          record.deceased === 0 ? "Recovered" : record.recovered === 0 ? "Deceased" : "Completed";
      } else {
        record.currentStatus = "In Isolation";
      }

      let mortalityRecordId = null;
      if (deceasedNum > 0) {
        const linkedDiagnosis = record.diagnosisId
          ? await HealthRecord.findById(record.diagnosisId).session(session)
          : null;
        const causeOfDeath = linkedDiagnosis?.vetDiagnosis || record.symptoms;
        const mortalityId = await generateMortalityId();

        const mortalityRecord = await MortalityRecord.create(
          [
            {
              mortalityId,
              date: updateDate,
              batchId: record.batchId,
              sourceIsolationId: record._id,
              numberOfMortality: deceasedNum,
              causeOfDeath,
              suspectedDisease: "",
              remarks: "",
            },
          ],
          { session },
        );
        mortalityRecordId = mortalityRecord[0]._id;

        const flock = await Flock.findOne({ batchId: record.batchId }).session(session);
        if (flock) {
          flock.totalMortality = (flock.totalMortality || 0) + deceasedNum;
          flock.currentQuantity = Math.max(0, (flock.currentQuantity || 0) - deceasedNum);
          flock.mortalityRate =
            flock.quantityPurchased > 0
              ? (flock.totalMortality / flock.quantityPurchased) * 100
              : 0;
          await flock.save({ session });
        }
      }

      record.progressUpdates.push({
        date: updateDate,
        recoveredDelta: recoveredNum,
        deceasedDelta: deceasedNum,
        mortalityRecordId,
      });

      await record.save({ session });

      if (record.diagnosisId) {
        await HealthRecord.findByIdAndUpdate(
          record.diagnosisId,
          { numberMortality: record.deceased },
          { session },
        );
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Quarantine & Isolation",
        action: "Edited",
        description: `Updated Isolation progress for ${record.isolationId}: +${recoveredNum} recovered, +${deceasedNum} deceased.`,
      });

      responseRecord = record;
    });

    return res.json({
      success: true,
      message: "Isolation progress updated successfully.",
      record: responseRecord,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.status ? err.message : err.message,
    });
  } finally {
    session.endSession();
  }
};

exports.correctIsolationProgress = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let responseRecord = null;

    await session.withTransaction(async () => {
      const record = await QuarantineIsolation.findById(req.params.id).session(session);

      if (!record) {
        throw Object.assign(new Error("Record not found."), { status: 404 });
      }
      if (record.recordType !== "Isolation") {
        throw Object.assign(new Error("This record is not an Isolation event."), { status: 400 });
      }

      const entry = record.progressUpdates.id(req.params.updateId);
      if (!entry) {
        throw Object.assign(new Error("Progress update not found."), { status: 404 });
      }

      const { recoveredDelta, deceasedDelta, date } = req.body;
      const recDelta = recoveredDelta === undefined || recoveredDelta === "" ? 0 : recoveredDelta;
      const decDelta = deceasedDelta === undefined || deceasedDelta === "" ? 0 : deceasedDelta;

      if (!isWholeNumber(recDelta) || !isWholeNumber(decDelta)) {
        throw Object.assign(new Error("Recovered and Deceased must be whole numbers."), { status: 400 });
      }

      const newRecovered = Number(recDelta);
      const newDeceased = Number(decDelta);

      if (newRecovered < 0 || newDeceased < 0) {
        throw Object.assign(new Error("Values cannot be negative."), { status: 400 });
      }

      const oldRecovered = entry.recoveredDelta || 0;
      const oldDeceased = entry.deceasedDelta || 0;

      const recoveredWithoutThis = record.recovered - oldRecovered;
      const deceasedWithoutThis = record.deceased - oldDeceased;
      const newTotalRecovered = recoveredWithoutThis + newRecovered;
      const newTotalDeceased = deceasedWithoutThis + newDeceased;

      if (newTotalRecovered + newTotalDeceased > record.headCount) {
        throw Object.assign(
          new Error(`Corrected totals (${newTotalRecovered + newTotalDeceased}) exceed Number of Birds Isolated (${record.headCount}).`),
          { status: 400 },
        );
      }

      const updateDate = date || entry.date;

      entry.recoveredDelta = newRecovered;
      entry.deceasedDelta = newDeceased;
      entry.date = updateDate;

      record.recovered = newTotalRecovered;
      record.deceased = newTotalDeceased;
      record.remaining = Math.max(0, record.headCount - record.recovered - record.deceased);

      if (record.remaining === 0) {
        record.dateCompleted = updateDate;
        record.currentStatus =
          record.deceased === 0 ? "Recovered" : record.recovered === 0 ? "Deceased" : "Completed";
      } else {
        record.dateCompleted = "";
        record.currentStatus = "In Isolation";
      }

      const deceasedDiff = newDeceased - oldDeceased;

      if (entry.mortalityRecordId && newDeceased > 0) {
        await MortalityRecord.findByIdAndUpdate(
          entry.mortalityRecordId,
          { numberOfMortality: newDeceased, date: updateDate },
          { session },
        );
      } else if (entry.mortalityRecordId && newDeceased === 0) {
        await MortalityRecord.findByIdAndDelete(entry.mortalityRecordId, { session });
        entry.mortalityRecordId = null;
      } else if (!entry.mortalityRecordId && newDeceased > 0) {
        const linkedDiagnosisForCorrection = record.diagnosisId
          ? await HealthRecord.findById(record.diagnosisId).session(session)
          : null;
        const causeOfDeath = linkedDiagnosisForCorrection?.vetDiagnosis || record.symptoms;
        const mortalityId = await generateMortalityId();

        const mortalityRecord = await MortalityRecord.create(
          [
            {
              mortalityId,
              date: updateDate,
              batchId: record.batchId,
              sourceIsolationId: record._id,
              numberOfMortality: newDeceased,
              causeOfDeath,
              suspectedDisease: "",
              remarks: "",
            },
          ],
          { session },
        );
        entry.mortalityRecordId = mortalityRecord[0]._id;
      }

      if (deceasedDiff !== 0) {
        const flock = await Flock.findOne({ batchId: record.batchId }).session(session);
        if (flock) {
          flock.totalMortality = Math.max(0, (flock.totalMortality || 0) + deceasedDiff);
          flock.currentQuantity = Math.max(0, (flock.currentQuantity || 0) - deceasedDiff);
          flock.mortalityRate =
            flock.quantityPurchased > 0
              ? (flock.totalMortality / flock.quantityPurchased) * 100
              : 0;
          await flock.save({ session });
        }
      }

      await record.save({ session });

      if (record.diagnosisId) {
        await HealthRecord.findByIdAndUpdate(
          record.diagnosisId,
          { numberMortality: record.deceased },
          { session },
        );
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Quarantine & Isolation",
        action: "Edited",
        description: `Corrected an Isolation progress update for ${record.isolationId}.`,
      });

      responseRecord = record;
    });

    return res.json({
      success: true,
      message: "Progress update corrected successfully.",
      record: responseRecord,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({
      success: false,
      message: err.status ? err.message : err.message,
    });
  } finally {
    session.endSession();
  }
};

exports.archiveQuarantineRecord = async (req, res) => {
  try {
    const record = await QuarantineIsolation.findByIdAndUpdate(
      req.params.id,
      {
        archived: true,
        archivedAt: new Date(),
      },
      {
        new: true,
      },
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await createArchiveEntry({
      module: "Quarantine & Isolation",
      moduleKey: "pb_isolation",
      recordId: record._id,
      recordName: `Batch ${record.batchId}`,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Quarantine & Isolation",
      action: "Archived",
      description: `Archived ${record.recordType} record for batch '${record.batchId}'.`,
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

exports.restoreQuarantineRecord = async (req, res) => {
  try {
    const record = await QuarantineIsolation.findByIdAndUpdate(
      req.params.id,
      {
        archived: false,
        archivedAt: null,
      },
      {
        new: true,
      },
    );

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_isolation",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Quarantine & Isolation",
      action: "Restored",
      description: `Restored ${record.recordType} record for batch '${record.batchId}'.`,
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

exports.deleteQuarantineRecord = async (req, res) => {
  try {
    const record = await QuarantineIsolation.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Record not found.",
      });
    }

    await Archive.findOneAndDelete({
      moduleKey: "pb_isolation",
      recordId: record._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Quarantine & Isolation",
      action: "Deleted",
      description: `Deleted ${record.recordType} record for batch '${record.batchId}'.`,
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