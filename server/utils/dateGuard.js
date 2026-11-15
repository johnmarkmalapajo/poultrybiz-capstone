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

// Quarantine day counting (one convention everywhere: table, release
// eligibility, reminders): the Quarantine Start Date (Flock Profile Date
// Acquired) is DAY 1, and each Philippine (Asia/Manila) calendar day after it
// adds one. With a 14-day quarantine starting November 1:
//   Nov 1 = Day 1 ... Nov 13 = Day 13 (upcoming-release reminder)
//   Nov 14 = Day 14 = expected release date (Owner may release from now on)
//   Nov 15+ = Day 15+ (overdue while not yet released)
const quarantineDayNumber = (startDate, onDay = phToday()) => {
  const days = daysBetween(startDate, onDay);
  return days === null ? null : days + 1;
};

// How long a Quarantine record has been (or was) under quarantine, in days,
// counting the start date as Day 1: start date -> Philippine today while
// Ongoing, start date -> actual release date once Released. Returns null when
// it cannot be determined.
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

  const day = quarantineDayNumber(start, end);
  return day === null ? null : Math.max(1, day);
};

// Day 14: the start date (Day 1) + 13 days.
const quarantineReleaseDate = (startDate) => {
  const start = toDay(startDate);
  return start ? addDays(start, QUARANTINE_DAYS - 1) : "";
};

const isQuarantineComplete = (startDate) => {
  const releaseDate = quarantineReleaseDate(startDate);
  return !!releaseDate && phToday() >= releaseDate;
};

// Release states shown to Owner and Farmer (all on Philippine dates):
//   "Quarantined"          Ongoing, before the expected release date
//   "Eligible for Release" Ongoing, ON the expected release date
//   "Overdue"              Ongoing, after the expected release date (the
//                          Owner has not released it yet)
//   "Released"             released by the Owner
// Reaching the release date never releases a batch by itself.
const QUARANTINE_STATES = {
  QUARANTINED: "Quarantined",
  ELIGIBLE: "Eligible for Release",
  OVERDUE: "Overdue",
  RELEASED: "Released",
};

const quarantineReleaseState = ({ startDate, status }) => {
  if (status === "Released") return QUARANTINE_STATES.RELEASED;
  const releaseDate = quarantineReleaseDate(startDate);
  if (!releaseDate) return QUARANTINE_STATES.QUARANTINED;
  const today = phToday();
  if (today < releaseDate) return QUARANTINE_STATES.QUARANTINED;
  if (today === releaseDate) return QUARANTINE_STATES.ELIGIBLE;
  return QUARANTINE_STATES.OVERDUE;
};

module.exports = {
  phToday,
  phDayOf,
  daysBetween,
  quarantineDurationDays,
  quarantineDayNumber,
  isFutureDate,
  FUTURE_DATE_MESSAGE,
  QUARANTINE_DAYS,
  quarantineReleaseDate,
  isQuarantineComplete,
  QUARANTINE_STATES,
  quarantineReleaseState,
  addDays,
  toDay,
};