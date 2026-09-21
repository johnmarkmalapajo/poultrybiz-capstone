const SalesRecord = require("../models/SalesRecord");
const Customer = require("../models/Customer");
const EggRecord = require("../models/EggRecord");
const ExpenseRecord = require("../models/ExpenseRecord");
const Archive = require("../models/Archive");
const { createAuditLog } = require("./auditController");
const { createArchiveEntry } = require("./archiveController");
const { createNotification } = require("./notificationController");

const SIZE_FIELD_MAP = {
  "Peewee": "peewee",
  "Small": "small",
  "Medium": "medium",
  "Large": "large",
  "Extra Large": "extraLarge",
  "Jumbo": "jumbo",
};
const EGG_SIZES = Object.keys(SIZE_FIELD_MAP);

async function getProducedBySize() {
  const rows = await EggRecord.aggregate([
    { $match: { isArchived: false } },
    {
      $group: {
        _id: null,
        peewee: { $sum: "$peewee" },
        small: { $sum: "$small" },
        medium: { $sum: "$medium" },
        large: { $sum: "$large" },
        extraLarge: { $sum: "$extraLarge" },
        jumbo: { $sum: "$jumbo" },
      },
    },
  ]);
  return rows[0] || { peewee: 0, small: 0, medium: 0, large: 0, extraLarge: 0, jumbo: 0 };
}

async function getSoldBySize(excludeSalesId = null) {
  const match = { isArchived: false };
  if (excludeSalesId) match._id = { $ne: excludeSalesId };

  const rows = await SalesRecord.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $group: { _id: "$items.eggSize", total: { $sum: "$items.eggsEquivalent" } } },
  ]);

  const map = {};
  rows.forEach((r) => { map[r._id] = r.total; });
  return map;
}

async function getAvailableEggs(excludeSalesId = null) {
  const [produced, sold] = await Promise.all([
    getProducedBySize(),
    getSoldBySize(excludeSalesId),
  ]);
  const available = {};
  for (const size of EGG_SIZES) {
    const field = SIZE_FIELD_MAP[size];
    available[size] = (produced[field] || 0) - (sold[size] || 0);
  }
  return available;
}

exports.getEggStockSummary = async (req, res) => {
  try {
    const [produced, sold] = await Promise.all([getProducedBySize(), getSoldBySize()]);
    const summary = EGG_SIZES.map((size) => {
      const field = SIZE_FIELD_MAP[size];
      const totalProduced = produced[field] || 0;
      const totalSold = sold[size] || 0;
      return {
        eggSize: size,
        totalProduced,
        totalSold,
        available: totalProduced - totalSold,
      };
    });
    return res.json({ success: true, summary });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

async function resolveCustomer(body) {
  if (body.customerId) {
    const customer = await Customer.findById(body.customerId);
    if (!customer) throw Object.assign(new Error("Selected customer was not found."), { status: 404 });
    return customer;
  }

  if (body.newCustomer && body.newCustomer.name && body.newCustomer.name.trim()) {
    const name = body.newCustomer.name.trim();
    const existing = await Customer.findOne({ name }).collation({ locale: "en", strength: 2 });
    if (existing) return existing;
    return Customer.create({ name });
  }

  throw Object.assign(new Error("Buyer/Customer is required — select an existing customer or add a new one."), { status: 400 });
}

function computeItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw Object.assign(new Error("A sale must contain at least one egg-size item."), { status: 400 });
  }

  return rawItems.map((raw, i) => {
    const label = `Egg Set ${i + 1}`;
    const eggSize = raw.eggSize;
    const unit = raw.unit;

    if (!EGG_SIZES.includes(eggSize)) {
      throw Object.assign(new Error(`${label}: please select a valid egg size.`), { status: 400 });
    }
    if (unit !== "Pieces" && unit !== "Trays") {
      throw Object.assign(new Error(`${label}: please select a valid unit (Pieces or Trays).`), { status: 400 });
    }

    const qtyRaw = String(raw.quantitySold ?? "").trim();
    if (qtyRaw === "") {
      throw Object.assign(new Error(`${label}: please enter a quantity.`), { status: 400 });
    }
    if (/^-/.test(qtyRaw)) {
      throw Object.assign(new Error(`${label}: Quantity — value cannot be negative.`), { status: 400 });
    }
    if (!/^\d+$/.test(qtyRaw)) {
      throw Object.assign(new Error(`${label}: Quantity must be a whole number.`), { status: 400 });
    }
    const quantitySold = Number(qtyRaw);
    if (quantitySold <= 0) {
      throw Object.assign(new Error(`${label}: quantity sold must be greater than zero.`), { status: 400 });
    }

    const priceRaw = String(raw.unitPrice ?? "").trim();
    if (priceRaw === "") {
      throw Object.assign(new Error(`${label}: please enter a unit price.`), { status: 400 });
    }
    if (/^-/.test(priceRaw)) {
      throw Object.assign(new Error(`${label}: Unit Price — value cannot be negative.`), { status: 400 });
    }
    if (!/^\d+(\.\d+)?$/.test(priceRaw)) {
      throw Object.assign(new Error(`${label}: Unit Price — please enter a valid number.`), { status: 400 });
    }
    const unitPrice = Number(priceRaw);

    const eggsEquivalent = unit === "Trays" ? quantitySold * 30 : quantitySold;
    const subtotal = Math.round(eggsEquivalent * unitPrice * 100) / 100;

    return { eggSize, quantitySold, unit, unitPrice, eggsEquivalent, subtotal };
  });
}

function validateStock(items, available) {
  const requestedBySize = {};
  for (const item of items) {
    requestedBySize[item.eggSize] = (requestedBySize[item.eggSize] || 0) + item.eggsEquivalent;
  }
  for (const [size, requested] of Object.entries(requestedBySize)) {
    const avail = available[size] || 0;
    if (requested > avail) {
      throw Object.assign(
        new Error(`Insufficient ${size} egg stock. Available: ${avail} eggs. Requested: ${requested} eggs.`),
        { status: 400 }
      );
    }
  }
}

async function checkNetLoss() {
  const [salesAgg, expenseAgg] = await Promise.all([
    SalesRecord.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    ExpenseRecord.aggregate([
      { $match: { isArchived: false } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);
  const revenue = salesAgg[0]?.total || 0;
  const expenses = expenseAgg[0]?.total || 0;
  const net = revenue - expenses;

  if (net < 0) {
    await createNotification({
      title: "Net Loss Detected",
      description: `Recorded transactions currently show a net loss of PHP ${Math.abs(net).toLocaleString()}.`,
      category: "sales",
      type: "alert",
      priority: "Critical",
      roles: ["Owner"],
    });
  }
}
exports.checkNetLoss = checkNetLoss;

exports.createSalesRecord = async (req, res) => {
  try {
    const customer = await resolveCustomer(req.body);
    const items = computeItems(req.body.items);

    const available = await getAvailableEggs();
    validateStock(items, available);

    const totalEggs = items.reduce((s, i) => s + i.eggsEquivalent, 0);
    const grandTotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

    const record = await SalesRecord.create({
      dateOfSale: req.body.dateOfSale,
      customer: customer._id,
      buyer: customer.name,
      items,
      totalEggs,
      grandTotal,
      remarks: req.body.remarks || "",
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Sales Record",
      action: "Added",
      description: `Added sales record for buyer '${record.buyer}' (${items.length} egg-size set${items.length > 1 ? "s" : ""}).`,
    });

    await checkNetLoss();

    return res.status(201).json({
      success: true,
      message: "Sales record created successfully.",
      data: record,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to create sales record.",
      error: error.status ? undefined : error.message,
    });
  }
};

exports.getSalesRecords = async (req, res) => {
  try {
    const { search } = req.query;

    let filter = { isArchived: false };

    if (search) {
      filter.$or = [
        { buyer: { $regex: search, $options: "i" } },
        { "items.eggSize": { $regex: search, $options: "i" } },
      ];
    }

    const records = await SalesRecord.find(filter).sort({
      dateOfSale: -1,
      createdAt: -1,
    });

    const stats = {
      totalSalesRecords: records.length,
      totalRevenue: records.reduce((sum, r) => sum + Number(r.grandTotal || 0), 0),
      totalEggsSold: records.reduce((sum, r) => sum + Number(r.totalEggs || 0), 0),
      latestSaleDate: records.length > 0 ? records[0].dateOfSale : null,
    };

    return res.json({ success: true, data: records, stats });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales records.",
      error: error.message,
    });
  }
};

exports.getSalesRecord = async (req, res) => {
  try {
    const record = await SalesRecord.findById(req.params.id).populate("customer");

    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found." });
    }

    return res.json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales record.",
      error: error.message,
    });
  }
};

exports.updateSalesRecord = async (req, res) => {
  try {
    const existing = await SalesRecord.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Sales record not found." });
    }
    const previous = existing.toObject();

    const customer = await resolveCustomer(req.body);
    const items = computeItems(req.body.items);

    const available = await getAvailableEggs(existing._id);
    validateStock(items, available);

    const totalEggs = items.reduce((s, i) => s + i.eggsEquivalent, 0);
    const grandTotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100;

    existing.dateOfSale = req.body.dateOfSale;
    existing.customer = customer._id;
    existing.buyer = customer.name;
    existing.items = items;
    existing.totalEggs = totalEggs;
    existing.grandTotal = grandTotal;
    existing.remarks = req.body.remarks || "";

    await existing.save();

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Sales Record",
      action: "Edited",
      description: `Updated sales record for buyer '${existing.buyer}'.`,
      previous,
      next: existing,
    });

    await checkNetLoss();

    return res.json({
      success: true,
      message: "Sales record updated successfully.",
      data: existing,
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      success: false,
      message: error.status ? error.message : "Failed to update sales record.",
      error: error.status ? undefined : error.message,
    });
  }
};

exports.archiveSalesRecord = async (req, res) => {
  try {
    const record = await SalesRecord.findByIdAndUpdate(
      req.params.id,
      { isArchived: true, archivedAt: new Date() },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found." });
    }

    await createArchiveEntry({
      module: "Sales Record",
      moduleKey: "pb_sales",
      recordId: record._id,
      recordName: `Sale to ${record.buyer}`,
      archivedBy: req.user.name,
      payload: record.toObject(),
    });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Sales Record",
      action: "Archived",
      description: `Archived sales record for buyer '${record.buyer}'.`,
    });

    return res.json({
      success: true,
      message: "Sales record archived successfully.",
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to archive sales record.",
      error: error.message,
    });
  }
};

exports.restoreSalesRecord = async (req, res) => {
  try {
    const record = await SalesRecord.findByIdAndUpdate(
      req.params.id,
      { isArchived: false, archivedAt: null },
      { new: true }
    );

    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found." });
    }

    await Archive.findOneAndDelete({ moduleKey: "pb_sales", recordId: record._id });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Sales Record",
      action: "Restored",
      description: `Restored sales record for buyer '${record.buyer}'.`,
    });

    return res.json({
      success: true,
      message: "Sales record restored successfully.",
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to restore sales record.",
      error: error.message,
    });
  }
};

exports.deleteSalesRecord = async (req, res) => {
  try {
    const record = await SalesRecord.findByIdAndDelete(req.params.id);

    if (!record) {
      return res.status(404).json({ success: false, message: "Sales record not found." });
    }

    await Archive.findOneAndDelete({ moduleKey: "pb_sales", recordId: record._id });

    await createAuditLog({
      user: req.user.name,
      role: req.user.role,
      module: "Sales Record",
      action: "Deleted",
      description: `Deleted sales record for buyer '${record.buyer}'.`,
    });

    return res.json({ success: true, message: "Sales record deleted successfully." });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete sales record.",
      error: error.message,
    });
  }
};