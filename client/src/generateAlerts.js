// generateAlerts.js
// Builds the farm alert list from current data. Pure function — easy to test.
// Put this in: src/utils/generateAlerts.js

import {
  productivityRate,
  prStatus,
  breakageRate,
  flockAgeMonths,
  cullingRecommendation,
  feedDaysRemaining,
  vitaminDueToday,
  PR_BREAKEVEN,
} from "./poultryFormulas";

/**
 * @param {Object} farm
 * @param {Array}  farm.flocks      - [{ batchId, dateAcquired, currentQty, eggsToday, crackedToday, totalEggsToday }]
 * @param {number} farm.feedStockKg - current feed stock in kg
 * @param {number} farm.totalHeads  - total population (for feed forecast)
 * @param {string} farm.lastVitaminDate - ISO date vitamins last given
 * @param {number} farm.lowFeedDays - threshold in days to warn (default 5)
 * @returns {Array} alerts: { id, severity, title, message, icon }
 */
export function generateAlerts(farm = {}) {
  const {
    flocks = [],
    feedStockKg = 0,
    totalHeads = 0,
    lastVitaminDate = null,
    lowFeedDays = 5,
  } = farm;

  const alerts = [];

  // 1. PR below break-even (per flock)
  flocks.forEach((f) => {
    const pr = productivityRate(f.eggsToday, f.currentQty);
    if (f.eggsToday != null && f.currentQty > 0 && pr < PR_BREAKEVEN) {
      alerts.push({
        id: `pr-${f.batchId}`,
        severity: "critical",
        title: `Low Productivity — ${f.batchId}`,
        message: `PR is ${pr}% (below the ${PR_BREAKEVEN}% break-even). This batch may be running at a loss.`,
        icon: "trending-down",
      });
    }
  });

  // 2. Culling due (age / PR / breakage)
  flocks.forEach((f) => {
    const ageMonths = flockAgeMonths(f.dateAcquired);
    const pr = productivityRate(f.eggsToday, f.currentQty);
    const brk = breakageRate(f.crackedToday, f.totalEggsToday);
    const rec = cullingRecommendation({ ageMonths, pr, breakagePct: brk });
    if (rec.shouldCull) {
      alerts.push({
        id: `cull-${f.batchId}`,
        severity: "warning",
        title: `Culling Recommended — ${f.batchId}`,
        message: rec.reasons.join("; ") + ".",
        icon: "alert-triangle",
      });
    }
  });

  // 3. Low feed stock
  if (totalHeads > 0) {
    const daysLeft = feedDaysRemaining(feedStockKg, totalHeads);
    if (daysLeft <= lowFeedDays) {
      alerts.push({
        id: "feed-low",
        severity: daysLeft <= 2 ? "critical" : "warning",
        title: "Feed Stock Running Low",
        message: `About ${daysLeft} day${daysLeft === 1 ? "" : "s"} of feed left for ${totalHeads} heads. Reorder soon.`,
        icon: "package",
      });
    }
  }

  // 4. Vitamin schedule (every other day)
  if (vitaminDueToday(lastVitaminDate)) {
    alerts.push({
      id: "vitamin-due",
      severity: "info",
      title: "Vitamins Due Today",
      message: "Vitamins are given every other day. Today is a scheduled day.",
      icon: "droplet",
    });
  }

  return alerts;
}
