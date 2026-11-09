// Shared "no future dates" check. "Today" is computed on Philippine time
// (UTC+8) so the cut-off rolls over at 12:00 AM PH, not 8:00 AM.
const phToday = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

const isFutureDate = (value) => {
  if (!value) return false;
  const d = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && d > phToday();
};

const FUTURE_DATE_MESSAGE = "Date cannot be a future date.";

const QUARANTINE_DAYS = 14;

const toDay = (value) => {
  if (!value) return "";
  if (value instanceof Date) return isNaN(value) ? "" : value.toISOString().slice(0, 10);
  const d = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
};

const addDays = (day, days) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Philippine calendar day (YYYY-MM-DD) of any instant.
const phDayOf = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? "" : new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

// Whole calendar days from startDay to endDay (both YYYY-MM-DD, already on
// Philippine dates). Day arithmetic is done in UTC on date-only strings, so
// the server's own timezone and daylight-saving rules can never shift it.
const daysBetween = (startDay, endDay) => {
  const s = toDay(startDay);
  const e = toDay(endDay);
  if (!s || !e) return null;
  return Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86400000);
};

// How long a Quarantine record has been (or was) under quarantine, in whole
// days: start date -> Philippine today while Ongoing, start date -> actual
// release date once Released. Returns null when it cannot be determined.
const quarantineDurationDays = ({ startDate, status, releasedDate, releasedAt }) => {
  const start = toDay(startDate);
  if (!start) return null;

  let end = "";
  if (status === "Ongoing") {
    end = phToday();
  } else if (status === "Released") {
    // Older records may have no releasedDate; fall back to the day the
    // record was last saved as Released, on Philippine time.
    end = toDay(releasedDate) || phDayOf(releasedAt);
  }
  if (!end) return null;

  const days = daysBetween(start, end);
  return days === null ? null : Math.max(0, days);
};

const quarantineReleaseDate = (startDate) => {
  const start = toDay(startDate);
  return start ? addDays(start, QUARANTINE_DAYS) : "";
};

const isQuarantineComplete = (startDate) => {
  const releaseDate = quarantineReleaseDate(startDate);
  return !!releaseDate && phToday() >= releaseDate;
};

module.exports = {
  phToday,
  phDayOf,
  daysBetween,
  quarantineDurationDays,
  isFutureDate,
  FUTURE_DATE_MESSAGE,
  QUARANTINE_DAYS,
  quarantineReleaseDate,
  isQuarantineComplete,
};