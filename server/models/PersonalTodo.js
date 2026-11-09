const mongoose = require("mongoose");

const personalTodoSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    type: {
      type: String,
      default: "Records",
    },

    dueDate: {
      type: Date,
    },

    // How long the task is expected to take -- a distinct concept from Due
    // Date (a deadline). Optional, never required, never used to
    // auto-complete a task.
    estimatedDuration: {
      value: { type: Number, default: null, min: 0.01 },
      unit: { type: String, enum: ["minutes", "hours"], default: "minutes" },
    },

    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Pending",
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

module.exports = mongoose.model("PersonalTodo", personalTodoSchema);