const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: String,
      required: true,
      default: "System",
      trim: true,
    },

    role: {
        type: String,
        enum: ["Owner", "Farmer", "System"],
        default: "System",
    },

    module: {
      type: String,
      required: true,
      trim: true,
    },

    action: {
      type: String,
      required: true,
      enum: [
        "Added",
        "Edited",
        "Archived",
        "Restored",
        "Deleted",
        "Approved",
        "Rejected",
        "Login",
        "Logout",
        "Changed Password",
        "Uploaded Avatar",
        // Attendance QR scans. "Check In" / "Check Out" are kept so
        // older log entries stay valid; new entries use Time In / Time Out.
        "Check In",
        "Check Out",
        "Time In",
        "Time Out",
      ],
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    prev: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    next: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);