const mongoose = require("mongoose");

const healthOptionSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      enum: ["symptom", "vetDiagnosis", "route", "unit", "frequency", "observation", "causeOfDeath", "manureMethod", "manureEndUse"],
    },

    value: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

healthOptionSchema.index(
  { category: 1, value: 1 },
  { collation: { locale: "en", strength: 2 }, unique: true }
);

module.exports =
  mongoose.models.HealthOption ||
  mongoose.model("HealthOption", healthOptionSchema);