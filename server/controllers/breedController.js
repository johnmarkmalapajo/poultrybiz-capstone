const Breed = require("../models/Breed");

exports.listBreeds = async (req, res) => {
  try {
    const breeds = await Breed.find().sort({ name: 1 });
    return res.json({ success: true, breeds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve breeds.",
      error: error.message,
    });
  }
};

exports.createBreed = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Breed name is required.",
      });
    }

    const existing = await Breed.findOne({ name }).collation({
      locale: "en",
      strength: 2,
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Breed already exists.",
        breed: existing,
      });
    }

    const breed = await Breed.create({ name });
    return res.status(201).json({ success: true, breed });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to create breed.",
      error: error.message,
    });
  }
};

// Server-side resolution used when Add/Edit Flock submits a new breed
// name directly (not through the separate create endpoint) -- finds the
// existing breed case-insensitively, or creates it. Always returns the
// canonical stored name so callers never need to guess casing.
exports.resolveBreedName = async (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const existing = await Breed.findOne({ name: trimmed }).collation({
    locale: "en",
    strength: 2,
  });
  if (existing) return existing.name;

  const created = await Breed.create({ name: trimmed });
  return created.name;
};