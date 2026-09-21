const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Case-insensitive uniqueness -- "ABC Farm" and "abc farm" are the same
// supplier. Applied via a collation on the index rather than a manual
// pre-check alone, so it's enforced at the database level too.
supplierSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Supplier", supplierSchema);