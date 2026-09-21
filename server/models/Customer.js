const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
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

customerSchema.index(
  { name: 1 },
  { collation: { locale: "en", strength: 2 }, unique: true }
);

module.exports = mongoose.model("Customer", customerSchema);