const HealthOption = require("../models/HealthOption");
const Veterinarian = require("../models/Veterinarian");

const CATEGORIES = ["symptom", "vetDiagnosis", "route", "unit", "frequency", "observation", "causeOfDeath", "manureMethod", "manureEndUse", "wasteType", "disposalMethod", "equipmentLocation", "personnelPosition"];

// Categories a user may add to directly (POST /health-options, e.g. the
// "+ Add New Location/Storage" modal of Add / Edit Equipment). Every other
// category is still only added through its record form (resolveHealthOption).
const CREATABLE = {
  equipmentLocation: {
    required: "Location/Storage name is required.",
    duplicate: "This Location/Storage already exists.",
  },
  // Personnel job positions ("+ Add New Position" in Edit Personnel). These
  // are job titles only -- never the account roles (Owner / Farmer) that
  // decide permissions. Only the Owner may set a position, so only the
  // Owner may add one.
  personnelPosition: {
    required: "Position name is required.",
    duplicate: "This position already exists.",
    ownerOnly: true,
    // "Owner" is the farm owner's fixed position, not one to assign.
    reserved: { owner: "\"Owner\" is reserved for the farm owner and can't be assigned." },
  },
};

// Values a category's list is seeded from: what is already saved on the
// records that use it (typed in before the list existed).
const SEED_SOURCES = {
  equipmentLocation: () => require("../models/Equipment").distinct("location"),
  personnelPosition: () => require("../models/Personnel").distinct("position"),
};

const isReserved = (category, value) =>
  Boolean(CREATABLE[category]?.reserved?.[String(value || "").trim().toLowerCase()]);

const CI = { locale: "en", strength: 2 };

// Options of a seeded category (Equipment Location/Storage, Personnel
// Position). Values typed in before the list existed live only on the
// records, so any of those not saved yet are added to the list here (once --
// the unique index makes it idempotent). After that the saved list is the
// single source, and a value stays available even when no record uses it
// any more.
async function seededOptions(category) {
  const [saved, used] = await Promise.all([
    HealthOption.find({ category }).select("value").lean(),
    SEED_SOURCES[category](),
  ]);
  const known = new Set(saved.map((o) => o.value.toLowerCase()));
  for (const raw of used) {
    const value = (raw || "").trim();
    if (value && !known.has(value.toLowerCase()) && !isReserved(category, value)) {
      await exports.resolveHealthOption(category, value);
      known.add(value.toLowerCase());
    }
  }
  const options = await HealthOption.find({ category }).lean();
  return options
    .filter((o) => !isReserved(category, o.value))
    .sort((x, y) => x.value.localeCompare(y.value, "en", { sensitivity: "base" }));
}

exports.listHealthOptions = async (req, res) => {
  try {
    const { category } = req.query;

    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ success: false, message: "Invalid category." });
    }

    if (SEED_SOURCES[category]) {
      return res.json({ success: true, options: await seededOptions(category) });
    }

    const filter = category ? { category } : {};
    const options = await HealthOption.find(filter).sort({ value: 1 });

    return res.json({ success: true, options });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Adds one option to a CREATABLE category. Rejects an empty / spaces-only
// value and a duplicate (ignoring surrounding spaces and letter case).
exports.createHealthOption = async (req, res) => {
  try {
    const { category } = req.body;
    const rules = CREATABLE[category];
    if (!rules) {
      return res.status(400).json({ success: false, message: "Invalid category." });
    }

    if (rules.ownerOnly && req.user?.role !== "Owner") {
      return res.status(403).json({ success: false, message: "Only the Owner can add a position." });
    }

    // Inner runs of spaces count as one ("Farm  Hand" = "Farm Hand").
    const value = (req.body.value == null ? "" : String(req.body.value)).trim().replace(/\s+/g, " ");
    if (!value) {
      return res.status(400).json({ success: false, message: rules.required });
    }
    if (isReserved(category, value)) {
      return res.status(400).json({ success: false, message: rules.reserved[value.toLowerCase()] });
    }

    const exists = SEED_SOURCES[category]
      ? (await seededOptions(category)).some((o) => o.value.toLowerCase() === value.toLowerCase())
      : await HealthOption.exists({ category, value }).collation(CI);
    if (exists) {
      return res.status(409).json({ success: false, message: rules.duplicate });
    }

    const option = await HealthOption.create({ category, value });
    return res.status(201).json({ success: true, option });
  } catch (err) {
    // Two requests added the same name at once: the unique index let one win.
    if (err?.code === 11000) {
      const rules = CREATABLE[req.body.category];
      return res.status(409).json({ success: false, message: rules?.duplicate || "This option already exists." });
    }
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