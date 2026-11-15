// models/QuarantineIsolation.js

const mongoose = require("mongoose");

const QuarantineIsolationSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      enum: ["Quarantine", "Isolation"],
      required: true,
      default: "Quarantine",
    },

    // Shared
    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    // -------------------------

    dateAcquired: {
      type: String,
      default: "",
    },

    source: {
      type: String,
      default: "",
      trim: true,
    },

    breed: {
      type: String,
      default: "",
      trim: true,
    },

    headCount: {
      type: Number,
      default: 0,
    },

    vitaminsGiven: {
      type: String,
      default: "",
      trim: true,
    },

    status: {
      type: String,
      enum: ["", "Ongoing", "Released"],
      default: "",
    },

    releasedDate: {
      type: String,
      default: "",
    },

    // "Manual" when the Owner released it from the Status action. Records
    // released by the former automatic 14-day job keep "Automatic"; older
    // records keep "". Quarantine is no longer released automatically.
    releaseMethod: {
      type: String,
      enum: ["", "Manual", "Automatic"],
      default: "",
    },

    // When the release was committed (the actual release date AND time).
    releaseFinalizedAt: {
      type: Date,
      default: null,
    },

    // Snapshot taken at release so the record keeps the quarantine period it
    // was released against, even if the Flock Profile's Date Acquired is
    // edited later: the quarantine start date and the expected release date
    // (start + 14 days), both Philippine calendar dates (YYYY-MM-DD).
    quarantineStartDate: {
      type: String,
      default: "",
    },

    expectedReleaseDate: {
      type: String,
      default: "",
    },

    // Who released it (Owner's name), for the record's history.
    releasedBy: {
      type: String,
      default: "",
    },

    // Set when a user releases a Quarantine record through the release
    // dialog (releaseMethod "Manual"). releaseDeaths is how many birds the
    // user reported as dead during quarantine (0 = none), and
    // releaseMortalityRecordId is the single Mortality Record that was
    // created for them (null when there were no deaths).
    releaseDeaths: {
      type: Number,
      default: 0,
      min: 0,
    },

    releaseMortalityRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MortalityRecord",
      default: null,
    },

    // -------------------------
    // ISOLATION
    // -------------------------

    isolationId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    dateIsolated: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    // Cumulative, incremented only through the progress-update endpoint
    // (updateIsolationProgress) — never replaced wholesale by a generic edit.
    recovered: {
      type: Number,
      default: 0,
      min: 0,
    },

    deceased: {
      type: Number,
      default: 0,
      min: 0,
    },

    // headCount - recovered - deceased. Always server-computed.
    remaining: {
      type: Number,
      default: 0,
      min: 0,
    },

    dateCompleted: {
      type: String,
      default: "",
    },

    // Audit trail of every progress update applied to this isolation event.
    progressUpdates: {
      type: [
        {
          date: String,
          recoveredDelta: Number,
          deceasedDelta: Number,
          // The Mortality Record this update created (if deceasedDelta
          // was > 0) -- lets a later correction adjust or remove the
          // right Mortality Record instead of creating a new one.
          mortalityRecordId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MortalityRecord",
            default: null,
          },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },

    // The Diagnosis (HealthRecord) automatically created alongside this
    // Isolation event. Never Batch ID alone — this is the specific-event
    // relationship the health workflow relies on.
    diagnosisId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HealthRecord",
      default: null,
    },

    currentStatus: {
      type: String,
      enum: ["", "In Isolation", "Recovered", "Deceased", "Completed"],
      default: "",
    },

    dateOfDeath: {
      type: String,
      default: "",
    },

    symptoms: {
      type: String,
      default: "",
      trim: true,
    },

    // -------------------------
    // CONNECTION PAYLOADS
    // -------------------------

    flockTransfer: {
      type: Object,
      default: null,
    },

    mortalityTransfer: {
      type: Object,
      default: null,
    },

    // -------------------------
    // ARCHIVE
    // -------------------------

    archived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    archivedBy: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.QuarantineIsolation ||
  mongoose.model("QuarantineIsolation", QuarantineIsolationSchema);