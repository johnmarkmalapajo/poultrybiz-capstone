// productionRules.js — single source of truth for PoultryBiz business rules
// Put in: src/utils/productionRules.js

// ── Structural constants (rules #1–#5) ──
export const CHICKENS_PER_BATCH = 48; // 1 batch = 48 chickens
export const TIERS_PER_SETUP    = 3;  // 1 setup = 3 tiers
export const CHICKENS_PER_TIER   = 12; // 1 tier = 12 chickens
export const ROOMS_PER_TIER      = 4;  // 1 tier = 4 rooms
export const CHICKENS_PER_ROOM   = 4;  // 1 room (cage) = 4 chickens

// ── Thresholds ──
export const STARTING_AGE_WEEKS    = 16; // chickens arrive at 16 weeks (rule #11)
export const DROP_ALERT_THRESHOLD  = 2;  // >2 percentage-point drop = alert (rule #10)

// ── Rule #12: Current Active Birds = Purchase Quantity − Total Mortality ──
export function activeBirds(purchaseQty, totalMortality) {
  return Math.max(0, (Number(purchaseQty) || 0) - (Number(totalMortality) || 0));
}

// ── Rule #7: Production Rate = (Total Eggs ÷ Active Birds) × 100 (never manual — rule #8) ──
export function productionRate(totalEggs, birds) {
  const b = Number(birds) || 0;
  if (b <= 0) return 0;
  const rate = (Number(totalEggs) || 0) / b * 100;
  return Math.round(rate * 100) / 100; // 2 decimals
}

// ── Rule #9: Production Status ──
export function productionStatus(rate) {
  if (rate >= 95) return { label: "Excellent", tone: "green",  icon: "🟢" };
  if (rate >= 90) return { label: "Good",      tone: "blue",   icon: "🔵" };
  if (rate >= 80) return { label: "Monitor",   tone: "yellow", icon: "🔶" };
  return            { label: "Critical",  tone: "red",    icon: "🔺" };
}

// ── Rule #10: Compare today vs yesterday → alert if drop > 2 percentage points ──
export function productionDropAlert(todayRate, yesterdayRate) {
  const drop = Math.round(((Number(yesterdayRate) || 0) - (Number(todayRate) || 0)) * 100) / 100;
  if (drop > DROP_ALERT_THRESHOLD) {
    return {
      dropped: true,
      drop,
      message: `Production dropped ${drop} percentage points from yesterday (${yesterdayRate}% → ${todayRate}%). Inspection recommended.`,
    };
  }
  return { dropped: false, drop, message: "" };
}

// ── Rule #11: Chicken age — starts at 16 weeks on arrival, auto-computed from arrival date ──
export function chickenAgeWeeks(arrivalDate, asOf = new Date()) {
  if (!arrivalDate) return STARTING_AGE_WEEKS;
  const start = new Date(arrivalDate);
  if (isNaN(start)) return STARTING_AGE_WEEKS;
  const weeksElapsed = Math.floor((asOf - start) / (1000 * 60 * 60 * 24 * 7));
  return STARTING_AGE_WEEKS + Math.max(0, weeksElapsed);
}

// Helper: full age label, e.g. "32 weeks (≈7.4 months)"
export function chickenAgeLabel(arrivalDate, asOf = new Date()) {
  const weeks = chickenAgeWeeks(arrivalDate, asOf);
  const months = Math.round((weeks / 4.345) * 10) / 10;
  return `${weeks} weeks (≈${months} months)`;
}
