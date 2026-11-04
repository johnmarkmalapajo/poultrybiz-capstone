import { useEffect, useState } from "react";
import { listHealthOptions } from "../api/healthOptions";

// Sentinel value of the "Others" choice. It only reveals the text box and is
// never sent to or stored by the server as a waste type / disposal method.
export const NEW_VALUE = "__new__";

export const WASTE_TYPES = [
  "Dead Birds",
  "Plastic Waste",
  "Feed Bags",
  "Broken Eggs",
  "Chemical Containers",
];

export const DISPOSAL_METHODS = ["Burial", "Burning", "Recycling", "Composting", "Disposal"];

export const CUSTOM_MAX_LENGTH = 60;

// Collapse inner/outer whitespace so "  Sold   to  farmers " == "Sold to farmers".
export const normalizeCustom = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export const isOthersWord = (value) => /^others?$/i.test(String(value ?? "").trim());

// Returns an error message for a custom value typed under "Others", or "".
export const validateCustom = (value, label) => {
  const text = normalizeCustom(value);
  if (!text) return `Please enter the specific ${label}.`;
  if (isOthersWord(text)) return `Please enter a specific ${label}, not the word "Others".`;
  if (text.length > CUSTOM_MAX_LENGTH) {
    return `The ${label} must be ${CUSTOM_MAX_LENGTH} characters or fewer.`;
  }
  if (!/[\p{L}\p{N}]/u.test(text)) return `Please enter a valid ${label}.`;
  return "";
};

// Predefined options first, then previously saved custom options, with
// case/space-insensitive de-duplication. `extra` keeps values that a record
// being edited already holds (e.g. an old "Other") selectable.
const mergeOptions = (predefined, saved, extra = []) => {
  const out = [...predefined];
  [...saved, ...extra].forEach((raw) => {
    const value = normalizeCustom(raw);
    if (!value) return;
    if (!out.some((o) => o.toLowerCase() === value.toLowerCase())) out.push(value);
  });
  return out;
};

export function useWasteOptions(extraWasteTypes = [], extraDisposalMethods = []) {
  const [savedTypes, setSavedTypes] = useState([]);
  const [savedMethods, setSavedMethods] = useState([]);

  useEffect(() => {
    listHealthOptions("wasteType")
      .then((r) => setSavedTypes((r.options || []).map((o) => o.value)))
      .catch(() => setSavedTypes([]));
    listHealthOptions("disposalMethod")
      .then((r) => setSavedMethods((r.options || []).map((o) => o.value)))
      .catch(() => setSavedMethods([]));
  }, []);

  return {
    wasteTypeOptions: mergeOptions(WASTE_TYPES, savedTypes, extraWasteTypes),
    disposalMethodOptions: mergeOptions(DISPOSAL_METHODS, savedMethods, extraDisposalMethods),
  };
}