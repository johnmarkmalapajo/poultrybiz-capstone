const Supplier = require("../models/Supplier");

exports.listSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ name: 1 });
    return res.json({ success: true, suppliers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to retrieve suppliers.",
      error: error.message,
    });
  }
};

exports.createSupplier = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Supplier name is required.",
      });
    }

    const existing = await Supplier.findOne({ name }).collation({
      locale: "en",
      strength: 2,
    });
    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Supplier already exists.",
        supplier: existing,
      });
    }

    const supplier = await Supplier.create({ name });
    return res.status(201).json({ success: true, supplier });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to create supplier.",
      error: error.message,
    });
  }
};

// Server-side resolution used when Add/Edit Flock submits a new supplier
// name directly -- finds the existing supplier case-insensitively, or
// creates it. Always returns the canonical stored name.
exports.resolveSupplierName = async (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const existing = await Supplier.findOne({ name: trimmed }).collation({
    locale: "en",
    strength: 2,
  });
  if (existing) return existing.name;

  const created = await Supplier.create({ name: trimmed });
  return created.name;
};