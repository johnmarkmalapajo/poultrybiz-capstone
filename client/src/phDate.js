// Philippine calendar date helpers.
// "Today" must always be the date in Asia/Manila, no matter what timezone the
// user's phone or laptop is set to, and without going through UTC (which
// shifts the date by a day during part of every Philippine day).

const PH_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// Returns today's Philippine date as "YYYY-MM-DD" (the value format that
// <input type="date"> expects).
export const phToday = () => PH_DATE_FORMAT.format(new Date());

// Whole calendar days from one "YYYY-MM-DD" date to another. Both are plain
// calendar dates, so the browser's timezone and daylight-saving rules cannot
// shift the result. Returns null when either date is missing or invalid.
export const phDaysBetween = (startDay, endDay) => {
  const s = String(startDay || "").slice(0, 10);
  const e = String(endDay || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return null;
  const diff = Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86400000);
  return Number.isNaN(diff) ? null : Math.max(0, diff);
};