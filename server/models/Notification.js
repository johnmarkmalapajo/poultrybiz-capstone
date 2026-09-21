const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
    type: String,
    required: true,
    },

    category: {
    type: String,
    required: true,
    },

    type: {
     type: String,
     enum: ["alert", "reminder"],
      default: "alert",
    },

    // Broadcast to everyone with this role (used when userId is null).
    roles: {
     type: [String],
     default: [],
    },

    // When set, this notification is for this ONE person only — e.g. "a
    // task was assigned to you" — and must never be shown to anyone else,
    // even another user who shares the same role.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    read: {
     type: Boolean,
     default: false,
    },

    // Alert severity: Critical (needs immediate attention), Warning
    // (should be looked at soon), Normal (informational/routine).
    priority: {
      type: String,
      enum: ["Critical", "Warning", "Normal"],
      default: "Normal",
    },


    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    referenceModel: {
      type: String,
      default: "",
    },

    // Used by the scheduled/cron-based checks to avoid creating the same
    // notification twice for the same condition (e.g. same batch + same
    // date). Not set for real-time, event-driven notifications.
    sourceId: {
      type: String,
      default: null,
      index: true,
    },
    
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);