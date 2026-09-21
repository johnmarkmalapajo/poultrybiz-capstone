const mongoose = require("mongoose");

const visitorLogSchema = new mongoose.Schema(
  {
    visitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Visitor",
      required: true,
    },

    dateOfVisit: {
      type: Date,
      required: true,
    },

    purpose: {
      type: String,
      required: true,
      trim: true,
    },

    vehiclePlate: {
      type: String,
      default: "",
      trim: true,
    },

    timeIn: {
      type: Date,
      default: Date.now,
    },

    timeOut: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["Inside", "Exited"],
      default: "Inside",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("VisitorLog", visitorLogSchema);