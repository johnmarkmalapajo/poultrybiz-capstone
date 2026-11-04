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