const mongoose = require("mongoose");

const healthRecordSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      enum: [
        "Diagnosis",
        "Vaccination",
        "Medication",
        "Vitamin Administration",
      ],
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    // Specific-event relationships — never Batch ID alone. A batch can
    // have multiple independent isolation/diagnosis/treatment events.
    isolationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuarantineIsolation",
      default: null,
    },

    // Set only on Treatment/Vaccination records — the specific Diagnosis
    // this intervention belongs to.
    diagnosisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthRecord",
      default: null,
    },

    // Set only on Diagnosis records — the human-readable Diagnosis ID
    // (D-001, D-002, ...), distinct from the isolationId/diagnosisId
    // ObjectId reference fields above, which link records to each other.
    diagnosisCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    // Set only on Treatment/Vaccination records — the human-readable
    // Medication ID (MED-001, MED-002, ...).
    medicationCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    /*
    |--------------------------------------------------------------------------
    | Diagnosis Fields
    |--------------------------------------------------------------------------
    */

    numberOfBirdsAffected: {
      type: Number,
      default: 0,
      min: 0,
    },

    symptomsObserved: {
      type: String,
      default: "",
      trim: true,
    },

    presumptiveDiagnosis: {
      type: String,
      default: "",
      trim: true,
    },

    vetDiagnosis: {
      type: String,
      default: "",
      trim: true,
    },

    treatmentApplied: {
      type: String,
      default: "",
      trim: true,
    },

    numberMortality: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    |--------------------------------------------------------------------------
    | Vaccination / Medication Fields
    |--------------------------------------------------------------------------
    */

    numberOfBirdsAdministered: {
      type: Number,
      default: 0,
      min: 0,
    },

    vaccineOrDrug: {
      type: String,
      default: "",
      trim: true,
    },

    targetAge: {
      type: String,
      default: "",
      trim: true,
    },

    routeOfAdmin: {
      type: String,
      default: "",
      trim: true,
    },

    dosage: {
      type: String,
      default: "",
      trim: true,
    },

    dosageUnit: {
      type: String,
      default: "",
      trim: true,
    },

    frequency: {
      type: String,
      default: "",
      trim: true,
    },

    administeredByType: {
      type: String,
      enum: ["", "Staff", "Vet"],
      default: "",
    },

    // Points to Personnel when administeredByType === "Staff", or
    // Veterinarian when administeredByType === "Vet".
    administeredByRef: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "administeredByRefModel",
      default: null,
    },

    administeredByRefModel: {
      type: String,
      enum: ["", "Personnel", "Veterinarian"],
      default: "",
    },

    administeredBy: {
      type: String,
      default: "",
      trim: true,
    },

    // Every follow-up date added for this specific treatment/vaccination
    // event. Earlier dates are never removed when a new one is added.
    schedules: {
      type: [String],
      default: [],
    },

    /*
    |--------------------------------------------------------------------------
    | Common Fields
    |--------------------------------------------------------------------------
    */

    nextSchedule: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    archived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.HealthRecord ||
  mongoose.model("HealthRecord", healthRecordSchema);