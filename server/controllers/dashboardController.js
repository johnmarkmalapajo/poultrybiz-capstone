const Flock = require("../models/Flock");
const EggRecord = require("../models/EggRecord");
const SalesRecord = require("../models/SalesRecord");
const ExpenseRecord = require("../models/ExpenseRecord");
const FeedInventory = require("../models/FeedInventory");
const FeedConsumption = require("../models/FeedConsumption");
const HealthRecord = require("../models/HealthRecord");
const Equipment = require("../models/Equipment");

const FINANCIAL_ROLES = ["Owner"];

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

exports.getDashboardSummary = async (req, res) => {
  try {
    const { start: todayStart, end: todayEnd } = todayRange();
    const canSeeFinancials = FINANCIAL_ROLES.includes(req.user?.role);

    const thirtyDaysAgo = new Date(todayStart);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const sevenDaysOut = new Date(todayEnd);
    sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);

    const [
      flockRows,
      eggTodayRows,
      eggTrendRows,
      financials,
      feedPurchasedRows,
      feedConsumedRows,
      feedConsumedTodayRows,
      healthCounts,
      equipmentCounts,
    ] = await Promise.all([
      Flock.aggregate([
        { $match: { isArchived: false } },
        {
          $group: {
            _id: null,
            currentFlockSize: { $sum: "$currentQuantity" },
            avgMortalityRate: { $avg: "$mortalityRate" },
            mortalityToday: {
              $sum: { $cond: [{ $gte: ["$updatedAt", todayStart] }, "$totalMortality", 0] },
            },
          },
        },
      ]),

      EggRecord.aggregate([
        {
          $match: {
            isArchived: false,
            collectionDate: { $gte: todayStart, $lte: todayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalEggsToday: { $sum: "$totalEggs" },
            peewee: { $sum: "$peewee" },
            small: { $sum: "$small" },
            medium: { $sum: "$medium" },
            large: { $sum: "$large" },
            extraLarge: { $sum: "$extraLarge" },
            jumbo: { $sum: "$jumbo" },
            crack: { $sum: "$crackedEggs" },
          },
        },
      ]),

      EggRecord.aggregate([
        { $match: { isArchived: false, collectionDate: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$collectionDate" } },
            count: { $sum: "$totalEggs" },
            sizes: {
              $push: {
                peewee: "$peewee", small: "$small", medium: "$medium",
                large: "$large", extraLarge: "$extraLarge", jumbo: "$jumbo",
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      canSeeFinancials
        ? Promise.all([
            SalesRecord.aggregate([
              { $match: { isArchived: false } },
              { $group: { _id: null, revenue: { $sum: "$grandTotal" } } },
            ]),
            ExpenseRecord.aggregate([
              { $match: { isArchived: false } },
              { $group: { _id: null, expenses: { $sum: "$amount" } } },
            ]),
          ])
        : Promise.resolve(null),

      FeedInventory.aggregate([
        { $match: { archived: false } },
        { $group: { _id: "$feedType", totalPurchased: { $sum: "$quantityIn" } } },
      ]),
      FeedConsumption.aggregate([
        { $match: { archived: false } },
        { $group: { _id: "$feedType", totalConsumed: { $sum: "$quantityConsumed" } } },
      ]),
      FeedConsumption.aggregate([
        { $match: { archived: false, date: { $gte: todayStart, $lte: todayEnd } } },
        { $group: { _id: null, total: { $sum: "$quantityConsumed" } } },
      ]),

      Promise.all([
        HealthRecord.countDocuments({
          archived: false,
          recordType: "Diagnosis",
          date: { $gte: todayStart, $lte: todayEnd },
        }),
        HealthRecord.countDocuments({
          archived: false,
          recordType: { $in: ["Medication", "Vitamin Administration"] },
          date: { $gte: todayStart, $lte: todayEnd },
        }),
        HealthRecord.countDocuments({
          archived: false,
          nextSchedule: { $gte: todayStart, $lte: sevenDaysOut },
        }),
      ]),

      Promise.all([
        Equipment.countDocuments({ archived: false, condition: { $in: ["Good", "Fair"] } }),
        Equipment.countDocuments({ archived: false, condition: "Poor" }),
      ]),
    ]);

    const flock = flockRows[0] || {};
    const eggToday = eggTodayRows[0] || {};
    const eggTotalForSizes = ["peewee", "small", "medium", "large", "extraLarge", "jumbo"]
      .reduce((sum, k) => sum + (eggToday[k] || 0), 0);

    const dailyTrend = eggTrendRows.map((row) => {
      const sizes = { peewee: 0, small: 0, medium: 0, large: 0, extraLarge: 0, jumbo: 0 };
      (row.sizes || []).forEach((s) => {
        sizes.peewee += s.peewee || 0;
        sizes.small += s.small || 0;
        sizes.medium += s.medium || 0;
        sizes.large += s.large || 0;
        sizes.extraLarge += s.extraLarge || 0;
        sizes.jumbo += s.jumbo || 0;
      });
      return { date: row._id, count: row.count, sizes };
    });

    const feedConsumedMap = Object.fromEntries(feedConsumedRows.map((r) => [r._id, r.totalConsumed]));
    const feedStockKg = feedPurchasedRows.reduce(
      (sum, r) => sum + (r.totalPurchased - (feedConsumedMap[r._id] || 0)),
      0
    );
    const feedConsumedToday = feedConsumedTodayRows[0]?.total || 0;
    const [sickChickens, underTreatment, vaccinationDue] = healthCounts;
    const [operationalEquipment, maintenanceDueEquipment] = equipmentCounts;

    const payload = {
      flock: {
        currentFlockSize: flock.currentFlockSize || 0,
        productiveRate: eggTotalForSizes && flock.currentFlockSize
          ? Number(((eggTotalForSizes / flock.currentFlockSize) * 100).toFixed(2))
          : 0,
        mortalityRate: Number((flock.avgMortalityRate || 0).toFixed(2)),
        mortalityToday: flock.mortalityToday || 0,
      },
      eggs: {
        totalEggsToday: eggToday.totalEggsToday || 0,
        sizeDistribution: eggTotalForSizes
          ? {
              peewee: pct(eggToday.peewee, eggTotalForSizes),
              small: pct(eggToday.small, eggTotalForSizes),
              medium: pct(eggToday.medium, eggTotalForSizes),
              large: pct(eggToday.large, eggTotalForSizes),
              extraLarge: pct(eggToday.extraLarge, eggTotalForSizes),
              jumbo: pct(eggToday.jumbo, eggTotalForSizes),
            }
          : {},
        dailyTrend,
      },
      feed: {
        feedStockKg,
        feedConsumedToday,
        feedLowStock: feedStockKg > 0 && feedStockKg < 500,
        feedCriticalStock: feedStockKg > 0 && feedStockKg < 150,
      },
      health: { sickChickens, underTreatment, vaccinationDue },
      equipment: { operationalEquipment, maintenanceDueEquipment },
    };

    if (canSeeFinancials) {
      const [[salesRow], [expenseRow]] = financials;
      const revenue = salesRow?.revenue || 0;
      const expenses = expenseRow?.expenses || 0;
      payload.financials = {
        salesRevenue: revenue,
        totalExpenses: expenses,
        netProfitLoss: revenue - expenses,
      };
    }

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ success: false, message: "Couldn't load dashboard data." });
  }
};

function pct(value, total) {
  return total > 0 ? Number((((value || 0) / total) * 100).toFixed(1)) : 0;
}