const mongoose = require("mongoose");

const equipmentSchema = new mongoose.Schema(
  {
    itemNo: {
      type: String,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    serialNo: {
      type: String,
      default: "",
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

    // Condition, Location, and Custodian are not collected when the record
    // is created via Equipment & Tools → Add → Add Expense Record (that flow
    // only captures the acquisition/expense fields). They are optional here
    // and get filled in later by the user through Edit Equipment.
    condition: {
      type: String,
      enum: ["In Use", "Idle", "For Repair", "For Disposal"],
      default: null,
    },

    location: {
      type: String,
      default: "",
      trim: true,
    },

    custodian: {
      type: String,
      default: "",
      trim: true,
    },

    dateAcquired: {
      type: Date,
      required: true,
    },

    cost: {
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

    // Link back to the Expense Record (category: "Equipment") that this
    // Equipment record was generated from / stays synchronized with.
    // No `default` here on purpose — see the matching note on
    // ExpenseRecord.equipmentId for why explicit null breaks the sparse
    // unique index.
    expenseRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExpenseRecord",
      unique: true,
      sparse: true,
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

// Auto-generate Item Number: EQ-001, EQ-002, EQ-003...
// Based on the highest existing numeric suffix rather than a document count,
// so Item Numbers stay sequential/unique even if older records were deleted.
equipmentSchema.pre("save", async function () {
  if (!this.isNew || this.itemNo) return;

  const Equipment = mongoose.model("Equipment");

  const last = await Equipment.findOne({
    itemNo: { $regex: /^EQ-\d+$/ },
  }).sort({ itemNo: -1 });

  let nextNumber = 1;

  if (last && last.itemNo) {
    const match = last.itemNo.match(/^EQ-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  this.itemNo = `EQ-${String(nextNumber).padStart(3, "0")}`;
});

module.exports = mongoose.model("Equipment", equipmentSchema);