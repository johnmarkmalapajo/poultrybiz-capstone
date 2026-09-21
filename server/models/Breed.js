const mongoose = require("mongoose");

const breedSchema = new mongoose.Schema(
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

// Case-insensitive uniqueness -- "Broiler" and "broiler" are the same
// breed. Applied via a collation on the index rather than a manual
// pre-check alone, so it's enforced at the database level too.
breedSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

module.exports = mongoose.model("Breed", breedSchema);