const mongoose = require("mongoose");

const veterinarianSchema = new mongoose.Schema(
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

veterinarianSchema.index(
  { name: 1 },
  { collation: { locale: "en", strength: 2 }, unique: true }
);

module.exports =
  mongoose.models.Veterinarian ||
  mongoose.model("Veterinarian", veterinarianSchema);