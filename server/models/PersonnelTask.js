const mongoose = require("mongoose");

const personnelTaskSchema = new mongoose.Schema(
  {
    personnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Personnel",
      required: true,
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Primary = recurring daily responsibility (reappears every PH calendar
    // day until deactivated). Secondary = one-off special assignment with a
    // due date (single lifetime completion, same proof+remarks mechanism).
    // Existing records created before this field existed default to
    // "Secondary" so they are never mistaken for an infinitely-recurring
    // Primary task during migration.
    category: {
      type: String,
      enum: ["Primary", "Secondary"],
      default: "Secondary",
    },

    // Whether the Owner still wants this task definition to keep producing
    // daily/occurrence records. Deactivating a task (instead of deleting it)
    // stops new occurrences from being generated while preserving every
    // historical occurrence already recorded.
    active: {
      type: Boolean,
      default: true,
    },

    module: {
      type: String,
      default: "",
      trim: true,
    },

    work: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    assignedDate: {
      type: Date,
      default: Date.now,
    },

    // Optional calendar deadline. Never applicable to Primary tasks (they
    // are perpetually recurring, so a due date would be meaningless) --
    // the backend forces this to null whenever a task's effective category
    // is (or becomes) Primary. Optional for Secondary tasks: the Owner may
    // leave it unset. Never auto-completes or deletes a task when it
    // elapses -- completion still always requires the Farmer's own Proof
    // of Completion submission.
    dueDate: {
      type: Date,
      default: null,
    },

    // Legacy field from an earlier redesign round, where it replaced Due
    // Date entirely for Secondary tasks as a plain day-count. No longer
    // written to or read by any current form -- superseded by
    // `estimatedDuration` (a distinct concept: how long the task is
    // expected to take, not a deadline) and the restored `dueDate` above.
    // Kept (not removed) only so historical records keep whatever value
    // they already had.
    durationDays: {
      type: Number,
      default: null,
      min: 1,
    },

    // How long the task is expected to take -- a distinct concept from
    // Due Date (a deadline). Optional, and applies to ALL categories
    // including Primary (a recurring task can still have a typical
    // duration estimate). Never required, and never used to auto-complete
    // or expire a task.
    estimatedDuration: {
      value: { type: Number, default: null, min: 0.01 },
      unit: { type: String, enum: ["minutes", "hours"], default: "minutes" },
    },

    completedDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Completed",
        "Archived",
      ],
      default: "Pending",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    linkedPersonalTodo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PersonalTodo",
      default: null,
    },
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
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "PersonnelTask",
  personnelTaskSchema
);