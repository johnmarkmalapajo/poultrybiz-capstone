const mongoose = require("mongoose");

const feedConsumptionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    // Display label of the batch(es) fed: one Batch ID, or several joined
    // with ", " for a multi-batch entry (e.g. "B-001, B-002"). Older
    // single-batch records only have this field.
    batchId: {
      type: String,
      required: true,
      trim: true,
    },

    // Every batch this ONE entry fed. Empty on older single-batch records
    // (read them as [batchId]).
    batchIds: {
      type: [String],
      default: undefined,
    },

    // How the entry's quantity is split across its batches -- for per-batch
    // views (Batch Summary, batch filter). quantityConsumed / quantityUnit
    // above stay the TOTAL that left the feed stock, counted once.
    allocations: {
      type: [
        new mongoose.Schema(
          {
            batchId: { type: String, required: true, trim: true },
            quantityKg: { type: Number, required: true, min: 0 },
            currentQuantity: { type: Number, default: null },
            currentAge: { type: Number, default: null },
            gPerHeadPerDay: { type: Number, default: null },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },

    feedType: {
      type: String,
      required: true,
      trim: true,
    },

    quantityConsumed: {
      type: Number,
      required: true,
      min: 0,
    },
    quantityUnit: {
     type: String,
    enum: ["kg", "sacks"],
    default: "kg",
    required: true,
  },

    sackWeightKg: {
      type: Number,
      min: 0.01,
      default: 50,
    },

    currentAge: {
      type: Number,
      default: null,
    },

    currentQuantity: {
      type: Number,
      default: null,
    },

    feedTransition: {
      type: String,
      default: "",
      trim: true,
    },

    gPerHeadPerDay: {
      type: Number,
      default: null,
    },

    notes: {
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

feedConsumptionSchema.index({ batchIds: 1 });

module.exports = mongoose.model(
  "FeedConsumption",
  feedConsumptionSchema
);