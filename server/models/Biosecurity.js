const mongoose = require("mongoose");

const biosecuritySchema = new mongoose.Schema(
  {
    visitorLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VisitorLog",
      required: true,
    },

    footbath: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    ppe: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    disinfection: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    otherFarm7d: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    otherFarmName: {
      type: String,
      default: "",
    },

    poultry48h: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    cleanClothes: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    entryDisinfection: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    fluSymptoms: {
      type: String,
      enum: ["Yes", "No"],
      required: true,
    },

    riskLevel: {
      type: String,
      enum: ["Low", "High"],
      default: "Low",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Biosecurity", biosecuritySchema);