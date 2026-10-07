import { FiPlus, FiX } from "react-icons/fi";
import "./SchedulePanel.css";

// SchedulePanel — the shared, compact Schedule UI used by the Diagnosis and
// Medication/Vaccination forms: a simple Date → Schedule → Status list plus
// an optional date field. ScheduleList is the read-only list (view modal).

const toDay = (value) => (value ? String(value).slice(0, 10) : "");

const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const formatDate = (day) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day || "—";
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// Sorted, de-duplicated schedule days. The first day on/after today is "Next".
function scheduleRows(schedules) {
  const today = localToday();
  const days = [...new Set((schedules || []).map(toDay).filter(Boolean))].sort();
  const nextDay = days.find((d) => d >= today) || "";
  return days.map((day) => {
    let status = "upcoming";
    if (day < today) status = "done";
    else if (day === today) status = "today";
    else if (day === nextDay) status = "next";
    return { day, status };
  });
}

const STATUS_LABEL = { done: "Done", today: "Today", next: "Next", upcoming: "Upcoming" };

export function ScheduleList({ schedules, action = "Follow-up", emptyText = "No schedules yet.", compact = false }) {
  const rows = scheduleRows(schedules);

  if (!rows.length) {
    return <p className={`pb-sched-empty${compact ? " compact" : ""}`}>{emptyText}</p>;
  }

  return (
    <div className={`pb-sched-table${compact ? " compact" : ""}`} role="table">
      {!compact && (
        <div className="pb-sched-row pb-sched-row-head" role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Schedule</span>
          <span role="columnheader">Status</span>
        </div>
      )}
      {rows.map((r) => (
        <div key={r.day} className={`pb-sched-row is-${r.status}`} role="row">
          <span className="pb-sched-date" role="cell">{formatDate(r.day)}</span>
          {!compact && <span className="pb-sched-action" role="cell">{action}</span>}
          <span className={`pb-sched-status is-${r.status}`} role="cell">{STATUS_LABEL[r.status]}</span>
        </div>
      ))}
    </div>
  );
}

export default function SchedulePanel({
  schedules = [],
  action,
  emptyText,
  input = null,
  addable = false,
  adding = false,
  onStartAdd,
  onCancelAdd,
  addLabel = "Add Schedule",
}) {
  const showEditor = input && (!addable || adding);
  const inputId = input?.id || "pb-sched-input";

  return (
    <div className="pb-sched">
      <ScheduleList schedules={schedules} action={action} emptyText={emptyText} />

      {showEditor && (
        <div className="pb-sched-field">
          <label htmlFor={inputId}>{input.label || "Schedule Date"}</label>
          <div className="pb-sched-field-row">
            <input
              id={inputId}
              type="date"
              value={input.value || ""}
              min={input.min || undefined}
              max={input.max || undefined}
              onChange={(e) => input.onChange(e.target.value)}
            />
            {addable && (
              <button type="button" className="pb-sched-btn" onClick={onCancelAdd}>
                <FiX /> Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {addable && !adding && (
        <button type="button" className="pb-sched-btn" onClick={onStartAdd}>
          <FiPlus /> {addLabel}
        </button>
      )}

      {input?.error
        ? <small className="pb-sched-error">{input.error}</small>
        : input?.hint && <small className="pb-sched-hint">{input.hint}</small>}
    </div>
  );
}