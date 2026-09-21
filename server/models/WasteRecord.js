const mongoose = require("mongoose");

const wasteRecordSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      default: "Waste",
    },

    date: {
      type: Date,
      required: true,
    },

    wasteType: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unit: {
      type: String,
      required: true,
      trim: true,
    },

    disposalMethod: {
      type: String,
      required: true,
      trim: true,
    },

    personResponsible: {
      type: String,
      required: true,
      trim: true,
    },

    remarks: {
      type: String,
      default: "",
      maxlength: 255,
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

module.exports = mongoose.model("WasteRecord", wasteRecordSchema);