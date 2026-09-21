const mongoose = require("mongoose");

const systemMaintenanceSchema = new mongoose.Schema(
  {
    startTime: {
      type: Date,
      required: true,
    },

    endTime: {
      type: Date,
      required: true,
    },

    message: {
      type: String,
      default: "The system is undergoing scheduled maintenance. Please check back soon.",
      trim: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancelled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemMaintenance", systemMaintenanceSchema);