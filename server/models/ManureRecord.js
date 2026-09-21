const mongoose = require("mongoose");

const manureRecordSchema = new mongoose.Schema(
  {
    recordType: {
      type: String,
      default: "Manure",
    },

    date: {
      type: Date,
      required: true,
    },

    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    quantityCollected: {
      type: Number,
      required: true,
      min: 0,
    },

    methodOfHandling: {
      type: String,
      required: true,
      trim: true,
    },

    storageLocation: {
      type: String,
      required: true,
      trim: true,
    },

    endUse: {
      type: String,
      required: true,
      trim: true,
    },

    personResponsible: {
      type: String,
      required: true,
      trim: true,
    },

    areaCleaned: {
      type: String,
      default: "",
      trim: true,
    },

    toolsUsed: {
      type: String,
      default: "",
      trim: true,
    },

    wasteManagement: {
      type: String,
      default: "",
      trim: true,
    },

    fertilizerHarvested: {
      type: Number,
      default: 0,
      min: 0,
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

module.exports = mongoose.model(
  "ManureRecord",
  manureRecordSchema
);