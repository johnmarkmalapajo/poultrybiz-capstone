const FeedInventory = require("../models/FeedInventory");
const FeedConsumption = require("../models/FeedConsumption");
const FeedStockSetting = require("../models/FeedStockSetting");

const LEGACY_SACK_WEIGHT_KG = 50;
const DEFAULT_LOW_STOCK_THRESHOLD = 100;
const DEFAULT_THRESHOLD_UNIT = "kg";
const MAX_SACK_WEIGHT_KG = 1000;
const MAX_LOW_STOCK_THRESHOLD = 1000000;
const THRESHOLD_UNITS = ["kg", "sacks"];
const DEFAULT_FEED_TYPES = ["Grower Feed", "Layer Feed"];
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

const normalizeFeedKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Same matching rule as normalizeFeedKey (used by getFeedStockSummary):
// case-insensitive and ignoring surrounding spaces, so computeFeedStock and
// the summary always group the same records under a feed type.
const feedTypeMatcher = (feedType) =>
  new RegExp(`^\\s*${escapeRegex(String(feedType || "").trim())}\\s*$`, "i");

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const isSackUnit = (unit) =>
  normalizeFeedKey(unit).startsWith("sack");

const resolveSackWeight = (value, fallback = LEGACY_SACK_WEIGHT_KG) => {
  const weight = Number(value);

  return Number.isFinite(weight) && weight > 0 ? weight : fallback;
};

const toKg = (quantity, unit, sackWeightKg) => {
  const value = Number(quantity || 0);

  if (!Number.isFinite(value)) return 0;

  return isSackUnit(unit) ? value * resolveSackWeight(sackWeightKg) : value;
};

const toSacks = (quantity, unit, sackWeightKg) => {
  const value = Number(quantity || 0);

  if (!Number.isFinite(value)) return 0;

  return isSackUnit(unit) ? value : value / resolveSackWeight(sackWeightKg);
};

const inventoryRecordKg = (record) => {
  const sackWeightKg = resolveSackWeight(record?.sackWeightKg);
  const quantity = Number(record?.quantity);

  if (Number.isFinite(quantity) && quantity > 0) {
    return toKg(quantity, record?.quantityUnit || "sacks", sackWeightKg);
  }

  return Number(record?.quantityIn || 0) * sackWeightKg;
};

const consumptionRecordKg = (record) =>
  toKg(
    record?.quantityConsumed,
    record?.quantityUnit || "kg",
    record?.sackWeightKg
  );

const defaultSetting = (feedType) => ({
  feedType: String(feedType || "").trim(),
  feedKey: normalizeFeedKey(feedType),
  sackWeightKg: LEGACY_SACK_WEIGHT_KG,
  lowStockThreshold: DEFAULT_LOW_STOCK_THRESHOLD,
  thresholdUnit: DEFAULT_THRESHOLD_UNIT,
  updatedBy: "",
  updatedAt: null,
  isDefault: true,
});

const toSetting = (doc, feedType) => {
  if (!doc) return defaultSetting(feedType);

  return {
    feedType: doc.feedType || String(feedType || "").trim(),
    feedKey: doc.feedKey,
    sackWeightKg: resolveSackWeight(doc.sackWeightKg),
    lowStockThreshold: Math.max(0, Number(doc.lowStockThreshold) || 0),
    thresholdUnit: THRESHOLD_UNITS.includes(doc.thresholdUnit)
      ? doc.thresholdUnit
      : DEFAULT_THRESHOLD_UNIT,
    updatedBy: doc.updatedBy || "",
    updatedAt: doc.updatedAt || null,
    isDefault: false,
  };
};

const getFeedStockSetting = async (feedType) => {
  const doc = await FeedStockSetting.findOne({
    feedKey: normalizeFeedKey(feedType),
  }).lean();

  return toSetting(doc, feedType);
};

const thresholdToKg = (setting) =>
  setting.thresholdUnit === "sacks"
    ? setting.lowStockThreshold * setting.sackWeightKg
    : setting.lowStockThreshold;

const latestRecordId = (records) => {
  const latest = records.reduce((current, record) => {
    if (!current) return record;

    const currentTime = new Date(current.createdAt || current.date || 0).getTime();
    const recordTime = new Date(record.createdAt || record.date || 0).getTime();

    return recordTime > currentTime ? record : current;
  }, null);

  return latest?._id ? String(latest._id) : "";
};

const buildFeedStock = (setting, inventoryRecords, consumptionRecords) => {
  const purchasedKg = inventoryRecords.reduce(
    (sum, record) => sum + inventoryRecordKg(record),
    0
  );

  const consumedKg = consumptionRecords.reduce(
    (sum, record) => sum + consumptionRecordKg(record),
    0
  );

  const availableKg = Math.max(0, purchasedKg - consumedKg);
  const thresholdKg = thresholdToKg(setting);

  return {
    feedType: setting.feedType,
    feedKey: setting.feedKey,
    sackWeightKg: round2(setting.sackWeightKg),
    lowStockThreshold: round2(setting.lowStockThreshold),
    thresholdUnit: setting.thresholdUnit,
    thresholdKg: round2(thresholdKg),
    purchasedKg: round2(purchasedKg),
    consumedKg: round2(consumedKg),
    availableKg: round2(availableKg),
    availableSacks: round2(availableKg / setting.sackWeightKg),
    isLow: round2(availableKg) <= round2(thresholdKg),
    isOut: round2(availableKg) <= 0,
    latestRestockId: latestRecordId(inventoryRecords),
    isDefault: setting.isDefault,
    updatedBy: setting.updatedBy,
    updatedAt: setting.updatedAt,
  };
};

const computeFeedStock = async (feedType, { excludeConsumptionId = null } = {}) => {
  const matcher = feedTypeMatcher(feedType);

  const consumptionQuery = {
    archived: false,
    feedType: { $regex: matcher },
  };

  if (excludeConsumptionId) {
    consumptionQuery._id = { $ne: excludeConsumptionId };
  }

  const [setting, inventoryRecords, consumptionRecords] = await Promise.all([
    getFeedStockSetting(feedType),
    FeedInventory.find({
      archived: false,
      feedType: { $regex: matcher },
    }).lean(),
    FeedConsumption.find(consumptionQuery).lean(),
  ]);

  return buildFeedStock(setting, inventoryRecords, consumptionRecords);
};

const getFeedStockSummary = async () => {
  const [settingDocs, inventoryRecords, consumptionRecords] = await Promise.all([
    FeedStockSetting.find().lean(),
    FeedInventory.find({ archived: false }).lean(),
    FeedConsumption.find({ archived: false }).lean(),
  ]);

  const feedTypes = new Map();

  const addFeedType = (feedType) => {
    const key = normalizeFeedKey(feedType);

    if (key && !feedTypes.has(key)) {
      feedTypes.set(key, String(feedType).trim());
    }
  };

  DEFAULT_FEED_TYPES.forEach(addFeedType);
  settingDocs.forEach((doc) => addFeedType(doc.feedType));
  inventoryRecords.forEach((record) => addFeedType(record.feedType));

  const settingsByKey = new Map(settingDocs.map((doc) => [doc.feedKey, doc]));

  return [...feedTypes.entries()]
    .map(([key, feedType]) =>
      buildFeedStock(
        toSetting(settingsByKey.get(key), feedType),
        inventoryRecords.filter((record) => normalizeFeedKey(record.feedType) === key),
        consumptionRecords.filter((record) => normalizeFeedKey(record.feedType) === key)
      )
    )
    .sort((a, b) => a.feedType.localeCompare(b.feedType));
};

const validateFeedStockSetting = (input = {}) => {
  const errors = {};
  const feedType = String(input.feedType || "").trim();
  const sackWeightText = String(input.sackWeightKg ?? "").trim();
  const thresholdText = String(input.lowStockThreshold ?? "").trim();
  const thresholdUnit = String(input.thresholdUnit || "").trim().toLowerCase();

  if (!feedType) {
    errors.feedType = "Feed type is required.";
  } else if (feedType.length > 60) {
    errors.feedType = "Feed type must be 60 characters or fewer.";
  }

  const sackWeightKg = Number(sackWeightText);

  if (
    !DECIMAL_PATTERN.test(sackWeightText) ||
    sackWeightKg <= 0 ||
    sackWeightKg > MAX_SACK_WEIGHT_KG
  ) {
    errors.sackWeightKg = `Weight per sack must be greater than 0 and not more than ${MAX_SACK_WEIGHT_KG} kg (up to 2 decimal places).`;
  }

  const lowStockThreshold = Number(thresholdText);

  if (
    !DECIMAL_PATTERN.test(thresholdText) ||
    lowStockThreshold < 0 ||
    lowStockThreshold > MAX_LOW_STOCK_THRESHOLD
  ) {
    errors.lowStockThreshold = "Minimum threshold must be a number from 0 and above (up to 2 decimal places).";
  }

  if (!THRESHOLD_UNITS.includes(thresholdUnit)) {
    errors.thresholdUnit = "Threshold unit must be kg or sacks.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    value: {
      feedType,
      feedKey: normalizeFeedKey(feedType),
      sackWeightKg: round2(sackWeightKg),
      lowStockThreshold: round2(lowStockThreshold),
      thresholdUnit,
    },
  };
};

const formatNumber = (value) =>
  round2(value).toLocaleString("en-US", { maximumFractionDigits: 2 });

const notifyLowFeedStock = async (stock) => {
  if (!stock || !stock.isLow) return null;

  const { createNotification } = require("../controllers/notificationController");
  const slug = stock.feedKey.replace(/[^a-z0-9]+/g, "-");
  const state = stock.isOut ? "out" : "low";

  return createNotification({
    title: stock.isOut ? "Out of Feed Stock" : "Low Feed Stock",
    description: `${stock.feedType} stock is ${
      stock.isOut ? "empty" : "low"
    }: ${formatNumber(stock.availableKg)} kg (${formatNumber(
      stock.availableSacks
    )} sacks at ${formatNumber(stock.sackWeightKg)} kg/sack) remaining. Alert threshold is ${formatNumber(
      stock.lowStockThreshold
    )} ${stock.thresholdUnit}.`,
    category: "feed",
    type: "alert",
    priority: stock.isOut ? "Critical" : "Warning",
    roles: ["Owner", "Farmer"],
    sourceId: `feed_${state}_${slug}_${stock.latestRestockId || "none"}_${stock.thresholdKg}`,
  });
};

module.exports = {
  LEGACY_SACK_WEIGHT_KG,
  MAX_SACK_WEIGHT_KG,
  THRESHOLD_UNITS,
  normalizeFeedKey,
  feedTypeMatcher,
  round2,
  isSackUnit,
  resolveSackWeight,
  toKg,
  toSacks,
  inventoryRecordKg,
  consumptionRecordKg,
  getFeedStockSetting,
  computeFeedStock,
  getFeedStockSummary,
  validateFeedStockSetting,
  notifyLowFeedStock,
  formatNumber,
};