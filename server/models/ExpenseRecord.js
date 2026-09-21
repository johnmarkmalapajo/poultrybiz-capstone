const mongoose = require("mongoose");

const feedSetSchema = new mongoose.Schema(
  {
    feedType: {
      type: String,
      required: true,
      trim: true,
    },

    unit: {
      type: String,
      default: "Sacks",
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    equivalentKg: {
      type: Number,
      default: 0,
      min: 0,
    },

    receipt: {
      type: String,
      default: "",
    },
  },
  {
    _id: true,
  }
);

const expenseRecordSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Feed Purchase",
        "Medicine",
        "Utilities",
        "Labor",
        "Equipment",
        "Transportation",
        "Miscellaneous",
      ],
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    supplier: {
      type: String,
      default: "",
      trim: true,
    },

    feedSets: {
      type: [feedSetSchema],
      default: [],
    },

    totalQuantityKg: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Equipment-category fields ──
    // Populated only when category === "Equipment". These mirror the
    // corresponding Equipment & Tools fields and stay synchronized with them.
    equipmentName: {
      type: String,
      default: "",
      trim: true,
    },

    unit: {
      type: String,
      default: "",
      trim: true,
    },

    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    serialNo: {
      type: String,
      default: "",
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    // Link to the auto-created/connected Equipment & Tools record.
    // No `default` here on purpose: the field must be genuinely absent
    // (undefined) on non-Equipment records for the sparse unique index
    // below to skip them. Setting `default: null` would give every
    // non-Equipment record an explicit null value, and MongoDB's sparse
    // index would then reject all but the first as a duplicate key.
    equipmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Equipment",
      unique: true,
      sparse: true,
    },

    receipt: {
      type: String,
      default: "",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    isArchived: {
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
  "ExpenseRecord",
  expenseRecordSchema
);