// Shared "no future dates" check. "Today" is computed on Philippine time
// (UTC+8) so the cut-off rolls over at 12:00 AM PH, not 8:00 AM.
const phToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

const isFutureDate = (value) => {
  if (!value) return false;
  const d = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d > phToday();
};

const FUTURE_DATE_MESSAGE = "Date cannot be a future date.";

module.exports = { phToday, isFutureDate, FUTURE_DATE_MESSAGE };