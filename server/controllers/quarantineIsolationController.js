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
const { QUARANTINE_DAYS, phToday, quarantineDurationDays } = require("../utils/dateGuard");
const { describeAutoRelease, hasOngoingIsolation } = require("../utils/quarantineRelease");

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
  if (obj.recordType === "Quarantine") {
    // Release is automatic (utils/quarantineRelease.js); these fields are
    // read-only details for the table.
    const { autoReleaseDate, releaseBlockedReason } = await describeAutoRelease(obj, obj.dateAcquired);
    obj.quarantineDays = QUARANTINE_DAYS;
    obj.releaseEligibleDate = autoReleaseDate;
    obj.autoReleaseDate = autoReleaseDate;
    obj.releaseBlockedReason = releaseBlockedReason;
    // Whole days under quarantine, counted from the batch's real start date
    // (Flock Profile Date Acquired) to Philippine today while Ongoing, or to
    // the actual release date once Released. Computed on every request, so it
    // is never stored and never goes stale.
    obj.quarantineDurationDays = quarantineDurationDays({
      startDate: obj.dateAcquired,
      status: obj.status,
      releasedDate: obj.releasedDate,
      releasedAt: obj.updatedAt,
    });
  }
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
          message: `This batch is still under Ongoing Quarantine and is not yet eligible for Isolation. It is released automatically after completing its ${QUARANTINE_DAYS}-day quarantine.`,
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
      message: `Quarantine records cannot be edited directly. They are released automatically after completing the ${QUARANTINE_DAYS}-day quarantine period.`,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Releases an Ongoing Quarantine record from the release dialog.
//
//   body: { hadDeaths: boolean, deceasedCount?: whole number > 0 }
//
// Everything happens in ONE transaction, so it either fully applies or not at
// all:
//   1. Atomic compare-and-set Ongoing -> Released. Only one request can win,
//      so a double-click / retry gets a 409 and changes nothing.
//   2. When birds died: one Mortality Record (unique per quarantine record, so
//      the database itself refuses a second one) and the matching deduction
//      from the Flock Profile -- the same figures Isolation progress updates.
//   3. The Flock Profile goes back to Active only when it is "Quarantined"
//      (a Culled batch is never reactivated), exactly like the automatic
//      release.
// The automatic 14-day release (utils/quarantineRelease.js) is untouched; it
// still skips any record that is no longer Ongoing.
const RELEASE_CAUSE_OF_DEATH = "Died during quarantine";
const MAX_RELEASE_ATTEMPTS = 3;

const releaseError = (status, message) => Object.assign(new Error(message), { status });

const runRelease = async (req) => {
  const { hadDeaths, deceasedCount } = req.body || {};

  if (typeof hadDeaths !== "boolean") {
    throw releaseError(400, "Please choose whether any birds died during this quarantine period.");
  }

  let deaths = 0;
  if (hadDeaths) {
    // Only a real number or a numeric string is accepted; arrays, objects and
    // booleans would otherwise coerce into a valid-looking value ([3] -> "3").
    if (
      (typeof deceasedCount !== "number" && typeof deceasedCount !== "string") ||
      !isWholeNumber(deceasedCount) ||
      !Number.isSafeInteger(Number(deceasedCount)) ||
      Number(deceasedCount) <= 0
    ) {
      throw releaseError(400, "Number of Deceased Birds must be a whole number greater than zero.");
    }
    deaths = Number(deceasedCount);
  }

  const session = await mongoose.startSession();
  try {
    let outcome = null;

    await session.withTransaction(async () => {
      const record = await QuarantineIsolation.findById(req.params.id).session(session);

      if (!record) throw releaseError(404, "Record not found.");
      if (record.recordType !== "Quarantine") {
        throw releaseError(400, "Only Quarantine records can be released here.");
      }
      if (record.archived) {
        throw releaseError(400, "An archived Quarantine record cannot be released. Restore it first.");
      }
      if (record.status !== "Ongoing") {
        throw releaseError(409, "This Quarantine record has already been released.");
      }
      if (await hasOngoingIsolation(record.batchId)) {
        throw releaseError(400, "This batch has an ongoing Isolation. Complete the Isolation before releasing the quarantine.");
      }

      const flock = await Flock.findOne({ batchId: record.batchId }).session(session);
      if (!flock) throw releaseError(400, "The linked Flock Profile was not found.");

      const releasedDate = phToday();
      const birdsBefore = flock.currentQuantity || 0;
      let mortalityObjectId = null;

      if (deaths > 0) {
        const allowed = Math.min(record.headCount || 0, birdsBefore);
        if (deaths > allowed) {
          throw releaseError(
            400,
            `Number of Deceased Birds (${deaths}) cannot exceed the birds in this quarantine (${allowed}).`
          );
        }
        mortalityObjectId = new mongoose.Types.ObjectId();
      }

      // 1. Claim the release. A concurrent request that already released it
      //    makes this return null, so nothing below runs twice.
      const claimed = await QuarantineIsolation.findOneAndUpdate(
        { _id: record._id, recordType: "Quarantine", status: "Ongoing", archived: false },
        {
          $set: {
            status: "Released",
            releasedDate,
            releaseMethod: "Manual",
            releaseFinalizedAt: new Date(),
            releaseDeaths: deaths,
            releaseMortalityRecordId: mortalityObjectId,
          },
          ...(deaths > 0 ? { $inc: { headCount: -deaths } } : {}),
        },
        { returnDocument: "after", session }
      );
      if (!claimed) throw releaseError(409, "This Quarantine record has already been released.");

      // 2. Mortality Record + Flock deduction (only when birds died).
      let mortalityRecord = null;
      if (deaths > 0) {
        flock.totalMortality = (flock.totalMortality || 0) + deaths;
        flock.currentQuantity = Math.max(0, birdsBefore - deaths);
        flock.mortalityRate =
          flock.quantityPurchased > 0
            ? Number(((flock.totalMortality / flock.quantityPurchased) * 100).toFixed(2))
            : 0;

        const mortalityId = await generateMortalityId();
        const created = await MortalityRecord.create(
          [
            {
              _id: mortalityObjectId,
              mortalityId,
              date: releasedDate,
              batchId: record.batchId,
              sourceQuarantineId: record._id,
              numberOfMortality: deaths,
              causeOfDeath: RELEASE_CAUSE_OF_DEATH,
              suspectedDisease: "",
              remarks: `Recorded when the quarantine of Batch ${record.batchId} was released.`,
              currentBirds: flock.currentQuantity,
              mortalityRate: flock.mortalityRate,
            },
          ],
          { session }
        );
        mortalityRecord = created[0];
      }

      // 3. A quarantined batch becomes Active again; Culled stays Culled.
      const reactivated = flock.status === "Quarantined";
      if (reactivated) flock.status = "Active";

      if (deaths > 0 || reactivated) await flock.save({ session });

      outcome = { record: claimed, mortalityRecord, flock, deaths, birdsBefore, reactivated, releasedDate };
    });

    return outcome;
  } finally {
    session.endSession();
  }
};

exports.releaseQuarantineRecord = async (req, res) => {
  try {
    let outcome = null;

    for (let attempt = 1; ; attempt += 1) {
      try {
        outcome = await runRelease(req);
        break;
      } catch (err) {
        if (err?.code === 11000) {
          // A second Mortality Record for the same release: the first one won.
          if (err.keyPattern?.sourceQuarantineId) {
            throw releaseError(409, "This Quarantine record has already been released.");
          }
          // Two requests picked the same next Mortality ID at once -- retry.
          if (err.keyPattern?.mortalityId && attempt < MAX_RELEASE_ATTEMPTS) continue;
        }
        throw err;
      }
    }

    const { record, mortalityRecord, flock, deaths, birdsBefore, reactivated, releasedDate } = outcome;

    // Everything below only reports what already committed. None of it can
    // fail the release, and the notification uses a fixed sourceId so it is
    // created once per record.
    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Quarantine & Isolation",
      action: "Edited",
      description: `Released Quarantine record for batch '${record.batchId}' on ${releasedDate}. ${
        deaths > 0 ? `${deaths} bird(s) died during quarantine.` : "No deaths during quarantine."
      }`,
    });

    if (mortalityRecord) {
      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Mortality Record",
        action: "Added",
        description: `Added mortality record for Batch ${record.batchId} from its quarantine release.`,
        prev: null,
        next: mortalityRecord,
      });

      const pct = birdsBefore > 0 ? (deaths / birdsBefore) * 100 : 0;
      if (pct >= 5 || deaths >= 5) {
        await createNotification({
          title: "High Mortality Detected",
          description: `High mortality detected in Batch ${record.batchId}. ${deaths} bird(s) recorded at quarantine release.`,
          category: "mortality",
          type: "alert",
          roles: ["Owner", "Farmer"],
        });
      }
    }

    if (reactivated) {
      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Flock Profile",
        action: "Edited",
        description: `Batch ${record.batchId} status changed from Quarantined to Active after quarantine release.`,
      });
    }

    await createNotification({
      title: "Quarantine Released",
      description: `Batch ${record.batchId} was released from quarantine on ${releasedDate}. ${
        deaths > 0 ? `${deaths} bird(s) died during quarantine and were recorded as mortality.` : "No deaths were reported."
      }`,
      category: "quarantine",
      type: "alert",
      roles: ["Owner"],
      referenceId: record._id,
      referenceModel: "QuarantineIsolation",
      sourceId: `quarantine_released_${record._id}`,
    });

    return res.json({
      success: true,
      message:
        deaths > 0
          ? `Quarantine released. ${deaths} death(s) recorded and deducted from the flock.`
          : "Quarantine released.",
      record: await withVitaminsGiven(record),
      mortalityRecord: mortalityRecord || null,
      currentQuantity: flock.currentQuantity,
    });
  } catch (err) {
    if (!err.status) console.error(err);

    return res.status(err.status || 500).json({
      success: false,
      message: err.status ? err.message : "Couldn't release this quarantine record. Nothing was changed. Please try again.",
    });
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

      const updateDate = date || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

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