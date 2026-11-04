const HealthOption = require("../models/HealthOption");
const Veterinarian = require("../models/Veterinarian");

const CATEGORIES = ["symptom", "vetDiagnosis", "route", "unit", "frequency", "observation", "causeOfDeath", "manureMethod", "manureEndUse", "wasteType", "disposalMethod"];

exports.listHealthOptions = async (req, res) => {
  try {
    const { category } = req.query;

    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid category." });
    }

    const filter = category ? { category } : {};
    const options = await HealthOption.find(filter).sort({ value: 1 });

    return res.json({ success: true, options });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveHealthOption = async (category, value) => {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  const existing = await HealthOption.findOne({ category, value: trimmed }).collation({
    locale: "en",
    strength: 2,
  });
  if (existing) return existing.value;

  try {
    const created = await HealthOption.create({ category, value: trimmed });
    return created.value;
  } catch (err) {
    // Two requests saved the same new option at once: the unique index let
    // one win. Return the stored one instead of failing or duplicating.
    if (err?.code === 11000) {
      const winner = await HealthOption.findOne({ category, value: trimmed }).collation({
        locale: "en",
        strength: 2,
      });
      if (winner) return winner.value;
    }
    throw err;
  }
};

exports.listVeterinarians = async (req, res) => {
  try {
    const vets = await Veterinarian.find({}).sort({ name: 1 });
    return res.json({ success: true, veterinarians: vets });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveVeterinarian = async (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const existing = await Veterinarian.findOne({ name: trimmed }).collation({
    locale: "en",
    strength: 2,
  });
  if (existing) return existing;

  return Veterinarian.create({ name: trimmed });
};