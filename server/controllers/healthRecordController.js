const HealthRecord = require("../models/HealthRecord");
const Flock = require("../models/Flock");
const Personnel = require("../models/Personnel");
const Veterinarian = require("../models/Veterinarian");
const QuarantineIsolation = require("../models/QuarantineIsolation");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { createNotification } = require("./notificationController");
const { resolveHealthOption, resolveVeterinarian } = require("./healthOptionController");
const Archive = require("../models/Archive");

const getFlock = async (batchId) => {
  const flock = await Flock.findOne({
    batchId,
    isArchived: false,
  });

  if (!flock) {
    throw new Error("Flock not found.");
  }

  return flock;
};

const isWholeNumber = (value) => /^\d+$/.test(String(value ?? "").trim());

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const isDecimal = (value) => /^\d+(\.\d+)?$/.test(String(value ?? "").trim());

const generateMedicationCode = async () => {
  const latest = await HealthRecord.findOne({ medicationCode: { $ne: null } }).sort({
    createdAt: -1,
  });

  if (!latest || !latest.medicationCode) return "MED-001";

  const latestNumber = parseInt(latest.medicationCode.replace("MED-", ""), 10);

  return `MED-${String(latestNumber + 1).padStart(3, "0")}`;
};

const computeAgeWeeks = (dateAcquired) => {
  if (!dateAcquired) return "";
  const start = new Date(dateAcquired);
  if (isNaN(start)) return "";
  const weeksElapsed = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return `${16 + weeksElapsed} weeks`;
};

const computeTreatmentApplied = async (diagnosisId) => {
  const treatments = await HealthRecord.find({
    diagnosisId,
    archived: false,
  }).sort({ date: 1 });

  return treatments
    .map((t) => t.vaccineOrDrug)
    .filter(Boolean)
    .join(", ");
};

const enrichDiagnosis = async (record) => {
  if (record.recordType !== "Diagnosis") return record;
  const obj = record.toObject ? record.toObject() : record;
  obj.treatmentApplied = await computeTreatmentApplied(record._id);
  return obj;
};

const resolveAdministeredBy = async (body) => {
  const { administeredByType, personnelId, newVet, vetId } = body;

  if (administeredByType === "Staff") {
    if (!personnelId) throw Object.assign(new Error("Please select a staff member."), { status: 400 });
    const personnel = await Personnel.findById(personnelId).populate("user", "name");
    if (!personnel) throw Object.assign(new Error("Selected staff member was not found."), { status: 400 });
    return {
      administeredByType: "Staff",
      administeredByRef: personnel._id,
      administeredByRefModel: "Personnel",
      administeredBy: personnel.user?.name || "",
    };
  }

  if (administeredByType === "Vet") {
    let vet;
    if (newVet && newVet.trim()) {
      vet = await resolveVeterinarian(newVet);
    } else if (vetId) {
      vet = await Veterinarian.findById(vetId);
    }
    if (!vet) throw Object.assign(new Error("Please select or add a veterinarian."), { status: 400 });
    return {
      administeredByType: "Vet",
      administeredByRef: vet._id,
      administeredByRefModel: "Veterinarian",
      administeredBy: vet.name,
    };
  }

  throw Object.assign(new Error("Please select whether this was administered by Staff or Vet."), { status: 400 });
};

const soonestUpcoming = (schedules) => {
  if (!schedules || !schedules.length) return null;
  const now = new Date();
  const future = schedules.map((d) => new Date(d)).filter((d) => d >= now).sort((a, b) => a - b);
  if (future.length) return future[0];
  const past = schedules.map((d) => new Date(d)).sort((a, b) => b - a);
  return past[0];
};

const syncDiagnosisSchedule = async (diagnosisId) => {
  if (!diagnosisId) return;
  const treatments = await HealthRecord.find({ diagnosisId, archived: false });
  const allDates = treatments.flatMap((t) => t.schedules || []);
  const next = soonestUpcoming(allDates);
  await HealthRecord.findByIdAndUpdate(diagnosisId, { nextSchedule: next });
};

const createHealthRecord = async (req, res) => {
  try {
    const { recordType, date, batchId, diagnosisId } = req.body;

    if (recordType === "Diagnosis") {
      return res.status(400).json({
        success: false,
        message: "Diagnosis records are created automatically from Isolation and cannot be added manually.",
      });
    }

    if (!recordType || !date || !batchId) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields.",
      });
    }

    if (String(date).slice(0, 10) > localToday()) {
      return res.status(400).json({
        success: false,
        message: "Date cannot be in the future.",
      });
    }

    const flock = await getFlock(batchId);

    const ongoingQuarantine = await QuarantineIsolation.findOne({
      batchId,
      recordType: "Quarantine",
      status: "Ongoing",
    });

    if (ongoingQuarantine) {
      const existingQuarantineMedication = await HealthRecord.findOne({
        recordType: "Vaccination",
        batchId,
        diagnosisId: null,
        archived: false,
      });
      if (existingQuarantineMedication) {
        return res.status(400).json({
          success: false,
          message: `A Medication/Vaccination record already exists for this batch while it's in Quarantine (${existingQuarantineMedication.medicationCode}). Edit that record instead of creating a new one.`,
        });
      }
    }

    let diagnosis = null;
    if (!ongoingQuarantine) {
      if (!diagnosisId) {
        return res.status(400).json({
          success: false,
          message: "This batch is not in Quarantine, so a Treatment/Vaccination record must be linked to an existing Diagnosis for it.",
        });
      }
      diagnosis = await HealthRecord.findOne({ _id: diagnosisId, recordType: "Diagnosis", batchId });
      if (!diagnosis) {
        return res.status(400).json({
          success: false,
          message: "Linked Diagnosis was not found for this batch.",
        });
      }
    } else if (diagnosisId) {
      diagnosis = await HealthRecord.findOne({ _id: diagnosisId, recordType: "Diagnosis", batchId });
    }

    const {
      numberOfBirdsAdministered,
      vaccineOrDrug,
      routeOfAdmin,
      newRoute,
      dosage,
      dosageUnit,
      newUnit,
      frequency,
      newFrequency,
      nextSchedule,
      remarks,
    } = req.body;

    const effectiveBirdsAdministered = ongoingQuarantine ? ongoingQuarantine.headCount : numberOfBirdsAdministered;

    if (!isWholeNumber(effectiveBirdsAdministered) || Number(effectiveBirdsAdministered) <= 0) {
      return res.status(400).json({
        success: false,
        message: ongoingQuarantine
          ? "This batch's current Quarantine Head Count is 0 — there are no birds to record medication for."
          : "Number of Birds Administered must be a whole number greater than zero.",
      });
    }
    if (!ongoingQuarantine && Number(effectiveBirdsAdministered) > flock.currentQuantity) {
      return res.status(400).json({
        success: false,
        message: `Number of Birds Administered cannot exceed the available birds in this batch (${flock.currentQuantity}).`,
      });
    }
    if (dosage && !isDecimal(dosage)) {
      return res.status(400).json({
        success: false,
        message: "Dosage must be a valid number (one decimal point allowed).",
      });
    }

    const resolvedRoute = newRoute && newRoute.trim() ? await resolveHealthOption("route", newRoute) : routeOfAdmin;
    const resolvedUnit = newUnit && newUnit.trim() ? await resolveHealthOption("unit", newUnit) : dosageUnit;
    const resolvedFrequency = newFrequency && newFrequency.trim() ? await resolveHealthOption("frequency", newFrequency) : frequency;
    const administered = await resolveAdministeredBy(req.body);

    const schedules = nextSchedule ? [nextSchedule] : [];
    const medicationCode = await generateMedicationCode();

    const record = await HealthRecord.create({
      recordType: "Vaccination",
      medicationCode,
      date,
      batchId,
      isolationId: diagnosis ? diagnosis.isolationId : null,
      diagnosisId: diagnosis ? diagnosis._id : null,

      numberOfBirdsAdministered: effectiveBirdsAdministered,
      vaccineOrDrug,
      targetAge: computeAgeWeeks(flock.dateAcquired),
      routeOfAdmin: resolvedRoute,
      dosage,
      dosageUnit: resolvedUnit,
      frequency: resolvedFrequency,
      ...administered,

      schedules,
      nextSchedule: soonestUpcoming(schedules),
      remarks,
    });

    await syncDiagnosisSchedule(diagnosis?._id);

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Health Record",
      action: "Added",
      description: `Added Treatment/Vaccination record for Batch ${batchId}.`,
      prev: null,
      next: record,
    });

    return res.status(201).json({
      success: true,
      message: "Health record created successfully.",
      record,
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to create health record.",
      error: error.status ? undefined : error.message,
    });
  }
};

const getAllHealthRecords = async (req, res) => {
  try {
    const records = await HealthRecord.find({
      archived: false,
    })
      .populate("isolationId", "isolationId")
      .sort({
        date: -1,
        createdAt: -1,
      });

    const enriched = await Promise.all(records.map(enrichDiagnosis));

    return res.status(200).json({
      success: true,
      count: enriched.length,
      records: enriched,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve health records.",
      error: error.message,
    });
  }
};

const getHealthRecordById = async (req, res) => {
  try {
    const record = await HealthRecord.findById(req.params.id).populate("isolationId", "isolationId currentStatus");

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Health record not found.",
      });
    }

    const enriched = await enrichDiagnosis(record);

    if (record.recordType === "Diagnosis") {
      enriched.treatments = await HealthRecord.find({
        diagnosisId: record._id,
        archived: false,
      }).sort({ date: 1 });
    } else if (record.diagnosisId) {
      const linkedDiagnosis = await HealthRecord.findById(record.diagnosisId).select("diagnosisCode");
      const plain = enriched.toObject ? enriched.toObject() : enriched;
      plain.diagnosisCode = linkedDiagnosis?.diagnosisCode || null;
      return res.status(200).json({ success: true, record: plain });
    }

    return res.status(200).json({
      success: true,
      record: enriched,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve health record.",
      error: error.message,
    });
  }
};

const updateHealthRecord = async (req, res) => {
  try {
    const healthRecord = await HealthRecord.findById(req.params.id);

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: "Health record not found.",
      });
    }

    const previousData = healthRecord.toObject();

    if (healthRecord.recordType === "Diagnosis") {
      const { symptomsObserved, newSymptomsObserved, presumptiveDiagnosis, newPresumptiveDiagnosis, vetDiagnosis, newVetDiagnosis, remarks, nextSchedule } = req.body;

      const presumptiveDiagnosisChanged =
        (presumptiveDiagnosis != null && presumptiveDiagnosis !== healthRecord.presumptiveDiagnosis) ||
        (newPresumptiveDiagnosis && newPresumptiveDiagnosis.trim());
      if (presumptiveDiagnosisChanged && healthRecord.isolationId) {
        const linkedIsolation = await QuarantineIsolation.findById(healthRecord.isolationId).select("currentStatus");
        if (linkedIsolation?.currentStatus === "Completed") {
          return res.status(400).json({
            success: false,
            message: "Presumptive Diagnosis can no longer be changed — the linked Isolation event is Completed.",
          });
        }
      }

      const resolvedPresumptiveDiagnosis = newPresumptiveDiagnosis && newPresumptiveDiagnosis.trim()
        ? await resolveHealthOption("symptom", newPresumptiveDiagnosis)
        : presumptiveDiagnosis;

      const resolvedVetDiagnosis = newVetDiagnosis && newVetDiagnosis.trim()
        ? await resolveHealthOption("vetDiagnosis", newVetDiagnosis)
        : vetDiagnosis;

      const resolvedSymptomsObserved = newSymptomsObserved && newSymptomsObserved.trim()
        ? await resolveHealthOption("observation", newSymptomsObserved)
        : symptomsObserved;

      healthRecord.symptomsObserved = resolvedSymptomsObserved ?? healthRecord.symptomsObserved;
      healthRecord.presumptiveDiagnosis = resolvedPresumptiveDiagnosis ?? healthRecord.presumptiveDiagnosis;
      healthRecord.vetDiagnosis = resolvedVetDiagnosis ?? healthRecord.vetDiagnosis;
      healthRecord.remarks = remarks ?? healthRecord.remarks;
      healthRecord.nextSchedule = nextSchedule ?? healthRecord.nextSchedule;

      await healthRecord.save();

      if (resolvedPresumptiveDiagnosis && resolvedPresumptiveDiagnosis.trim() && resolvedPresumptiveDiagnosis !== previousData.presumptiveDiagnosis && healthRecord.isolationId) {
        await QuarantineIsolation.findOneAndUpdate(
          { _id: healthRecord.isolationId },
          { symptoms: resolvedPresumptiveDiagnosis },
        );
      }

      await createAuditLog({
        user: req.user.name,
        role: req.user.role,
        module: "Health Record",
        action: "Edited",
        description: `Updated Diagnosis record for Batch ${healthRecord.batchId}.`,
        prev: previousData,
        next: healthRecord,
      });

      const enriched = await enrichDiagnosis(healthRecord);
      return res.status(200).json({
        success: true,
        message: "Health record updated successfully.",
        record: enriched,
      });
    }

    const flock = await getFlock(healthRecord.batchId);

    const {
      date,
      numberOfBirdsAdministered,
      vaccineOrDrug,
      routeOfAdmin,
      newRoute,
      dosage,
      dosageUnit,
      newUnit,
      frequency,
      newFrequency,
      addSchedule,
      remarks,
    } = req.body;

    if (date && String(date).slice(0, 10) > localToday()) {
      return res.status(400).json({
        success: false,
        message: "Date cannot be in the future.",
      });
    }

    const ongoingQuarantineForEdit = !healthRecord.diagnosisId
      ? await QuarantineIsolation.findOne({
          batchId: healthRecord.batchId,
          recordType: "Quarantine",
          status: "Ongoing",
        })
      : null;
    const effectiveBirdsAdministeredForEdit = ongoingQuarantineForEdit
      ? ongoingQuarantineForEdit.headCount
      : numberOfBirdsAdministered;

    if (effectiveBirdsAdministeredForEdit != null) {
      if (!isWholeNumber(effectiveBirdsAdministeredForEdit) || Number(effectiveBirdsAdministeredForEdit) <= 0) {
        return res.status(400).json({
          success: false,
          message: ongoingQuarantineForEdit
            ? "This batch's current Quarantine Head Count is 0 — there are no birds to record medication for."
            : "Number of Birds Administered must be a whole number greater than zero.",
        });
      }
      if (!ongoingQuarantineForEdit && Number(effectiveBirdsAdministeredForEdit) > flock.currentQuantity) {
        return res.status(400).json({
          success: false,
          message: `Number of Birds Administered cannot exceed the available birds in this batch (${flock.currentQuantity}).`,
        });
      }
    }
    if (dosage && !isDecimal(dosage)) {
      return res.status(400).json({
        success: false,
        message: "Dosage must be a valid number (one decimal point allowed).",
      });
    }

    const resolvedRoute = newRoute && newRoute.trim() ? await resolveHealthOption("route", newRoute) : routeOfAdmin;
    const resolvedUnit = newUnit && newUnit.trim() ? await resolveHealthOption("unit", newUnit) : dosageUnit;
    const resolvedFrequency = newFrequency && newFrequency.trim() ? await resolveHealthOption("frequency", newFrequency) : frequency;

    healthRecord.date = date ?? healthRecord.date;
    healthRecord.numberOfBirdsAdministered = effectiveBirdsAdministeredForEdit ?? healthRecord.numberOfBirdsAdministered;
    healthRecord.vaccineOrDrug = vaccineOrDrug ?? healthRecord.vaccineOrDrug;
    healthRecord.targetAge = computeAgeWeeks(flock.dateAcquired);
    healthRecord.routeOfAdmin = resolvedRoute ?? healthRecord.routeOfAdmin;
    healthRecord.dosage = dosage ?? healthRecord.dosage;
    healthRecord.dosageUnit = resolvedUnit ?? healthRecord.dosageUnit;
    healthRecord.frequency = resolvedFrequency ?? healthRecord.frequency;
    healthRecord.remarks = remarks ?? healthRecord.remarks;

    if (req.body.administeredByType) {
      Object.assign(healthRecord, await resolveAdministeredBy(req.body));
    }

    if (addSchedule) {
      healthRecord.schedules = [...(healthRecord.schedules || []), addSchedule];
      healthRecord.nextSchedule = soonestUpcoming(healthRecord.schedules);
    }

    await healthRecord.save();

    if (healthRecord.diagnosisId) {
      await syncDiagnosisSchedule(healthRecord.diagnosisId);
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Health Record",
      action: "Edited",
      description: `Updated Treatment/Vaccination record for Batch ${healthRecord.batchId}.`,
      prev: previousData,
      next: healthRecord,
    });

    return res.status(200).json({
      success: true,
      message: "Health record updated successfully.",
      record: healthRecord,
    });
  } catch (error) {
    console.error(error);

    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Unable to update health record.",
      error: error.status ? undefined : error.message,
    });
  }
};

const deleteHealthRecord = async (req, res) => {
  try {
    const healthRecord = await HealthRecord.findById(req.params.id);

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: "Health record not found.",
      });
    }

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Health Record",
      action: "Deleted",
      description: `Deleted ${healthRecord.recordType} record for Batch ${healthRecord.batchId}.`,
      prev: healthRecord,
      next: null,
    });

    await healthRecord.deleteOne();

    await Archive.findOneAndDelete({
      moduleKey: "pb_health",
      recordId: healthRecord._id,
    });

    return res.status(200).json({
      success: true,
      message: "Health record deleted successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete health record.",
      error: error.message,
    });
  }
};

const archiveHealthRecord = async (req, res) => {
  try {
    const healthRecord = await HealthRecord.findById(req.params.id);

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: "Health record not found.",
      });
    }

    healthRecord.archived = true;
    healthRecord.archivedAt = new Date();

    await healthRecord.save();

    await createArchiveEntry({
      module: "Health Records",
      moduleKey: "pb_health",
      recordId: healthRecord._id,
      recordName: `${healthRecord.recordType} — Batch ${healthRecord.batchId}`,
      archivedBy: req.user.name,
      payload: healthRecord.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Health Record",
      action: "Archived",
      description: `Archived ${healthRecord.recordType} record for Batch ${healthRecord.batchId}.`,
      prev: null,
      next: healthRecord,
    });

    return res.status(200).json({
      success: true,
      message: "Health record archived successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to archive health record.",
      error: error.message,
    });
  }
};

const restoreHealthRecord = async (req, res) => {
  try {
    const healthRecord = await HealthRecord.findById(req.params.id);

    if (!healthRecord) {
      return res.status(404).json({
        success: false,
        message: "Health record not found.",
      });
    }

    healthRecord.archived = false;
    healthRecord.archivedAt = null;

    await healthRecord.save();

    await Archive.findOneAndDelete({
      moduleKey: "pb_health",
      recordId: healthRecord._id,
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Health Record",
      action: "Restored",
      description: `Restored ${healthRecord.recordType} record for Batch ${healthRecord.batchId}.`,
      prev: null,
      next: healthRecord,
    });

    return res.status(200).json({
      success: true,
      message: "Health record restored successfully.",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to restore health record.",
      error: error.message,
    });
  }
};

const getArchivedHealthRecords = async (req, res) => {
  try {
    const records = await HealthRecord.find({
      archived: true,
    }).sort({
      archivedAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve archived health records.",
      error: error.message,
    });
  }
};

module.exports = {
  createHealthRecord,
  getAllHealthRecords,
  getHealthRecordById,
  updateHealthRecord,
  deleteHealthRecord,
  archiveHealthRecord,
  restoreHealthRecord,
  getArchivedHealthRecords,
};