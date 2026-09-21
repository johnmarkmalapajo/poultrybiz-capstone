const Customer = require("../models/Customer");

// Customer is deliberately name-only per the business rules — no
// contact/address/email fields exist anywhere in this module. Do not
// add them here even if a future request seems to imply it; check
// with the Customer model comment first.

// =====================================================
// LIST — powers the Buyer/Customer dropdown
// =====================================================
exports.listCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({}).sort({ name: 1 });
    return res.json({ success: true, customers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required." });
    }

    const existing = await Customer.findOne({ name: name.trim() }).collation({ locale: "en", strength: 2 });
    if (existing) {
      return res.status(200).json({ success: true, message: "Existing customer reused.", customer: existing, reused: true });
    }

    const customer = await Customer.create({ name: name.trim() });

    return res.status(201).json({ success: true, message: "Customer created.", customer, reused: false });
  } catch (err) {
 
    if (err.code === 11000) {
      const existing = await Customer.findOne({ name: req.body.name?.trim() }).collation({ locale: "en", strength: 2 });
      if (existing) {
        return res.status(200).json({ success: true, message: "Existing customer reused.", customer: existing, reused: true });
      }
    }
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};