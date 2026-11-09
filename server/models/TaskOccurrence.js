const mongoose = require("mongoose");

// A single day's completion record for a PersonnelTask (Primary or
// Secondary). Task DEFINITIONS and ASSIGNMENTS live on PersonnelTask and are
// never deleted/recreated daily; this model only holds the daily occurrence
// / completion-submission data so that history (photo proof + remarks) is
// permanently preserved even after "today's" occurrence resets.
//
// Primary tasks get a fresh occurrence upserted for every Philippine
// calendar day the task is viewed/acted on (occurrenceDate changes daily).
// Secondary tasks get exactly one lifetime occurrence (occurrenceDate is
// just the day it was first generated) since they are one-off assignments,
// not daily-recurring ones — see personnelTaskController.getOrCreateOccurrence.
const taskOccurrenceSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PersonnelTask",
      required: true,
    },

    // Denormalized so a Farmer's own occurrences (and an Owner's permission
    // checks / history queries) never require an extra populate+filter pass.
    personnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Personnel",
      required: true,
    },

    // Snapshot of the task's category at the moment this occurrence was
    // generated, so history stays correctly labeled even if a task's
    // category could ever change.
    category: {
      type: String,
      enum: ["Primary", "Secondary"],
      required: true,
    },

    // Philippine calendar day (YYYY-MM-DD) this occurrence belongs to.
    occurrenceDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
    },

    photoProofUrl: {
      type: String,
      default: "",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Snapshot of the task's title/description taken at the moment this
    // occurrence was completed (not at creation time), so Task History
    // always shows the task exactly as it was when the Farmer submitted
    // proof -- even if the Owner edits or deletes the task definition
    // afterward. Empty until the occurrence is completed; history falls
    // back to a live lookup of the task for any occurrence recorded before
    // this field existed.
    taskTitle: {
      type: String,
      default: "",
    },

    taskDescription: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Duplicate-safety net: guarantees at most one occurrence per task per PH
// day, independent of any application-level locking, so concurrent
// requests/retries can never create two occurrences for the same day.
taskOccurrenceSchema.index({ task: 1, occurrenceDate: 1 }, { unique: true });

// Speeds up the Farmer's "my tasks today" lookups and the Owner's
// per-personnel history queries/filters.
taskOccurrenceSchema.index({ personnel: 1, occurrenceDate: -1 });
taskOccurrenceSchema.index({ personnel: 1, category: 1, occurrenceDate: -1 });

module.exports = mongoose.model("TaskOccurrence", taskOccurrenceSchema);