import { useCallback, useEffect, useState } from "react";
import { getFeedStock } from "../api/feedInventory";

export const DEFAULT_SACK_WEIGHT_KG = 50;

const normalizeFeedKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const roundTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const formatFeedNumber = (value) =>
  roundTwo(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

export const isSackUnit = (unit) => normalizeFeedKey(unit).startsWith("sack");

export const resolveSackWeight = (value) => {
  const weight = Number(value);

  return Number.isFinite(weight) && weight > 0 ? weight : DEFAULT_SACK_WEIGHT_KG;
};

export const feedQuantityToKg = (quantity, unit, sackWeightKg) => {
  const value = Number(quantity || 0);

  if (!Number.isFinite(value)) return 0;

  return isSackUnit(unit) ? value * resolveSackWeight(sackWeightKg) : value;
};

export const convertFeedQuantity = (value, fromUnit, toUnit, sackWeightKg) => {
  const quantity = Number(value);

  if (value === "" || value === null || value === undefined || Number.isNaN(quantity)) {
    return "";
  }

  if (isSackUnit(fromUnit) === isSackUnit(toUnit)) {
    return String(quantity);
  }

  const kg = feedQuantityToKg(quantity, fromUnit, sackWeightKg);

  return String(
    roundTwo(isSackUnit(toUnit) ? kg / resolveSackWeight(sackWeightKg) : kg)
  );
};

export const sackWeightHint = (unit, sackWeightKg) => {
  const weight = formatFeedNumber(resolveSackWeight(sackWeightKg));

  return isSackUnit(unit)
    ? `1 sack is equal to ${weight} kg.`
    : `${weight} kg is equal to 1 sack.`;
};

export function useFeedStock() {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(
    () =>
      getFeedStock()
        .then((json) => {
          setStock(Array.isArray(json?.stock) ? json.stock : []);
          setError("");
        })
        .catch((err) => {
          setError(err?.message || "Couldn't load feed stock.");
        })
        .finally(() => {
          setLoading(false);
        }),
    []
  );

  useEffect(() => {
    reload();

    window.addEventListener("pb_data_changed", reload);

    return () => window.removeEventListener("pb_data_changed", reload);
  }, [reload]);

  const stockFor = useCallback(
    (feedType) =>
      stock.find((item) => normalizeFeedKey(item.feedType) === normalizeFeedKey(feedType)) ||
      null,
    [stock]
  );

  const sackWeightFor = useCallback(
    (feedType) => resolveSackWeight(stockFor(feedType)?.sackWeightKg),
    [stockFor]
  );

  return {
    stock,
    loading,
    error,
    reload,
    setStock,
    stockFor,
    sackWeightFor,
  };
}

// ── Feed Consumption: feed plan by age, and multi-batch entries ──────────
// Shared by Add and Edit Feed Consumption.
//
// One entry can feed several batches that received the same feed. Its
// Quantity Consumed is the TOTAL for all selected batches and is taken from
// the feed stock once. It is shared among the batches in proportion to each
// batch's current bird count (equal shares if no counts are known) -- the
// server does the same split and stores it with the entry.

// ── Feed transition rules by current age (weeks) ──
function getFeedPlan(week) {
  if (week == null || isNaN(week) || week < 17) return null;
  if (week === 17) return { grower: 100, layer: 0, gPerHead: 75 };
  if (week === 18) return { grower: 100, layer: 0, gPerHead: 85 };
  if (week === 19) return { grower: 75, layer: 25, gPerHead: 90 };
  if (week === 20) return { grower: 50, layer: 50, gPerHead: 95 };
  if (week === 21) return { grower: 25, layer: 75, gPerHead: 100 };
  if (week === 22) return { grower: 0, layer: 100, gPerHead: 105 };

  return {
    grower: 0,
    layer: 100,
    gPerHead: 110,
  };
}

function planLabel(p) {
  if (!p) return "";

  const parts = [];

  if (p.grower) {
    parts.push(`${p.grower}% Grower Feed`);
  }

  if (p.layer) {
    parts.push(`${p.layer}% Layer Feed`);
  }

  return `${parts.join(" + ")} (${p.gPerHead} g/head/day)`;
}

function primaryFeed(p) {
  if (!p) return "";

  return p.layer > p.grower ? "Layer Feed" : "Grower Feed";
}

// Current age (weeks)
function getAgeWeeks(f) {
  if (!f) return null;

  const direct =
    f.currentAgeWeeks ??
    f.ageWeeks ??
    f.currentAge ??
    f.ageInWeeks ??
    f.age;

  if (direct != null && direct !== "") {
    return Math.floor(Number(direct));
  }

  const start =
    f.dateAcquired ||
    f.startDate ||
    f.hatchDate ||
    f.dateOfArrival ||
    f.acquisitionDate;

  if (start) {
    const ms = Date.now() - new Date(start).getTime();

    if (!isNaN(ms)) {
      return Math.max(
        0,
        Math.floor(ms / (7 * 24 * 60 * 60 * 1000))
      );
    }
  }

  return null;
}

// Current quantity (head count)
function getQuantity(f) {
  if (!f) return null;

  const q =
    f.currentQuantity ??
    f.currentBirds ??
    f.quantity ??
    f.headCount ??
    f.quantityPurchased ??
    f.numberOfBirds ??
    f.birdCount;

  const n = Number(q);

  return isNaN(n) || n <= 0 ? null : n;
}


// Shares (kg) of `totalKg` per batch, by bird count; the last batch takes the
// rounding remainder so the shares add up to exactly the total.
export function splitByBirds(totalKg, batchIds, flockList) {
  const heads = batchIds.map((id) => Math.max(0, Number(getQuantity(flockList.find((f) => f.batchId === id))) || 0));
  const totalHeads = heads.reduce((a, b) => a + b, 0);
  const weights = totalHeads > 0 ? heads : batchIds.map(() => 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let given = 0;
  return batchIds.map((batchId, i) => {
    const kg = i === batchIds.length - 1
      ? Math.max(0, roundTwo(totalKg - given))
      : roundTwo((totalKg * weights[i]) / totalWeight);
    given = roundTwo(given + kg);
    return { batchId, kg, birds: heads[i] || null };
  });
}

// What the form can fill in for the selected batches: the suggested TOTAL
// quantity (sum of each batch's birds x its age-based g/head/day, only when
// every batch has both), the feed type the largest need calls for, the
// per-batch details sent with the entry, and -- for a single batch -- the
// same fields a single-batch entry always had.
export function batchFeedSuggestion(flockList, batchIds) {
  const per = batchIds.map((batchId) => {
    const flock = flockList.find((f) => f.batchId === batchId);
    const age = getAgeWeeks(flock);
    const birds = getQuantity(flock);
    const plan = getFeedPlan(age);
    return { batchId, age, birds, plan, needKg: plan && birds ? birds * plan.gPerHead / 1000 : null };
  });

  const complete = per.length > 0 && per.every((p) => p.needKg != null);
  const biggest = per.filter((p) => p.plan).sort((a, b) => (b.needKg || 0) - (a.needKg || 0))[0];

  return {
    totalKg: complete ? roundTwo(per.reduce((sum, p) => sum + p.needKg, 0)) : null,
    feedType: biggest ? primaryFeed(biggest.plan) : "",
    batchMeta: Object.fromEntries(
      per.map((p) => [p.batchId, { currentAge: p.age, gPerHeadPerDay: p.plan?.gPerHead ?? null }])
    ),
    singleMeta: per.length === 1
      ? {
          currentAge: per[0].age,
          currentQuantity: per[0].birds,
          feedTransition: planLabel(per[0].plan),
          gPerHeadPerDay: per[0].plan?.gPerHead ?? null,
        }
      : {},
  };
}

// Batch IDs of one Feed Consumption entry: `batchIds` on multi-batch
// entries, or the single `batchId` of older entries.
export const entryBatchIds = (record) =>
  record?.batchIds?.length ? record.batchIds : record?.batchId ? [record.batchId] : [];

// The part (kg) of an entry that went to one batch: the whole quantity for a
// single-batch entry, that batch's stored share for a multi-batch entry.
export const batchShareKg = (record, batchId) => {
  const ids = entryBatchIds(record);
  if (!ids.includes(batchId)) return 0;
  if (ids.length === 1) {
    return feedQuantityToKg(record.quantityConsumed, record.quantityUnit || "kg", record.sackWeightKg);
  }
  return Number(record.allocations?.find((a) => a.batchId === batchId)?.quantityKg) || 0;
};