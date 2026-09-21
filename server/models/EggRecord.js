const mongoose = require("mongoose");

const eggRecordSchema = new mongoose.Schema(
  {

    flock: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flock",
      required: true,
    },

    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    collectionDate: {
      type: Date,
      required: true,
    },

    // Historical snapshot of the flock's population at the exact moment
    // this record was created — captured once, permanently, and never
    // recalculated afterward. Mortality, sales, transfers, or any other
    // later change to the flock's live currentQuantity must NEVER alter
    // this value. Hen-Day % is always computed from this field, never
    // from Flock.currentQuantity directly (see eggRecordController.js).
    birdsAtCollection: {
      type: Number,
      required: true,
      min: 0,
    },

    peewee: {
      type: Number,
      default: 0,
      min: 0,
    },

    small: {
      type: Number,
      default: 0,
      min: 0,
    },

    medium: {
      type: Number,
      default: 0,
      min: 0,
    },

    large: {
      type: Number,
      default: 0,
      min: 0,
    },

    extraLarge: {
      type: Number,
      default: 0,
      min: 0,
    },

    jumbo: {
      type: Number,
      default: 0,
      min: 0,
    },

    crackedEggs: {
      type: Number,
      default: 0,
      min: 0,
    },

    goodEggs: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEggs: {
      type: Number,
      default: 0,
      min: 0,
    },

    henDayPercent: {
      type: Number,
      default: 0,
      min: 0,
    },

    productionStatus: {
      type: String,
      enum: ["Excellent", "Good", "Monitor", "Critical"],
      default: "Critical",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("EggRecord", eggRecordSchema);