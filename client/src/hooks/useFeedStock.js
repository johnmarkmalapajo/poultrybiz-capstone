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