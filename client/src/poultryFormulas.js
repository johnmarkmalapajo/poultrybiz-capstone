// poultryFormulas.js
// Central business rules for Egginear Agri-Poultry (from client interview).
// Put this in: src/utils/poultryFormulas.js

// ── Constants (from interview) ──
export const PR_BREAKEVEN = 70;          // PR below 70% = deficit (lugi)
export const FEED_GRAMS_MIN = 105;       // grams/head/day at laying stage
export const FEED_GRAMS_MAX = 110;
export const FEED_GRAMS_DEFAULT = 108;   // midpoint used for estimates
export const LIFECYCLE_MONTHS = 24;      // cull after ~2 years
export const VITAMIN_INTERVAL_DAYS = 2;  // vitamins every other day

// ── Productivity Rate ──
// PR = (eggs collected / number of heads) * 100   (100% = 1 egg/head/day)
export function productivityRate(eggsCollected, heads) {
  if (!heads || heads <= 0) return 0;
  return +((eggsCollected / heads) * 100).toFixed(1);
}

// Returns a status label + tone for a given PR value.
export function prStatus(pr) {
  if (pr < PR_BREAKEVEN) return { label: "Deficit", tone: "red" };      // below break-even
  if (pr < 85)           return { label: "Break-even", tone: "amber" }; // viable but watch
  return { label: "Healthy", tone: "green" };
}

// ── Feed consumption ──
// daily feed = heads * grams/head/day
export function dailyFeedGrams(heads, gramsPerHead = FEED_GRAMS_DEFAULT) {
  return (Number(heads) || 0) * gramsPerHead;
}
export function dailyFeedKg(heads, gramsPerHead = FEED_GRAMS_DEFAULT) {
  return +(dailyFeedGrams(heads, gramsPerHead) / 1000).toFixed(2);
}

// How many days the current feed stock will last for the whole flock.
export function feedDaysRemaining(stockKg, heads, gramsPerHead = FEED_GRAMS_DEFAULT) {
  const perDay = dailyFeedKg(heads, gramsPerHead);
  if (perDay <= 0) return Infinity;
  return Math.floor((Number(stockKg) || 0) / perDay);
}

// ── Breakage rate ──
// breakage % = cracked / total eggs * 100
export function breakageRate(cracked, totalEggs) {
  if (!totalEggs || totalEggs <= 0) return 0;
  return +(((Number(cracked) || 0) / totalEggs) * 100).toFixed(1);
}

// ── Flock age (months) from acquisition date ──
export function flockAgeMonths(dateAcquired) {
  if (!dateAcquired) return 0;
  const start = new Date(dateAcquired);
  if (isNaN(start)) return 0;
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

// ── Culling recommendation ──
// Cull if: age >= 24 months OR PR < 70% OR breakage exceeds good eggs (>50%).
export function cullingRecommendation({ ageMonths = 0, pr = 100, breakagePct = 0 }) {
  const reasons = [];
  if (ageMonths >= LIFECYCLE_MONTHS) reasons.push(`Reached ${LIFECYCLE_MONTHS}-month lifecycle`);
  if (pr < PR_BREAKEVEN) reasons.push(`Productivity Rate below ${PR_BREAKEVEN}%`);
  if (breakagePct > 50) reasons.push("Breakage higher than good eggs");
  return { shouldCull: reasons.length > 0, reasons };
}

// ── Vitamin schedule (every other day) ──
// Returns true if vitamins are due today based on the last date given.
export function vitaminDueToday(lastGivenDate) {
  if (!lastGivenDate) return true; // never given yet
  const last = new Date(lastGivenDate);
  if (isNaN(last)) return true;
  const today = new Date();
  const days = Math.floor((today - last) / (1000 * 60 * 60 * 24));
  return days >= VITAMIN_INTERVAL_DAYS;
}

// ── Peso formatter helper (handy for financial displays) ──
export function peso(n) {
  return `₱${Number(n || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
