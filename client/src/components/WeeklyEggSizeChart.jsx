// WeeklyEggSizeChart.jsx
// Dependency-free stacked bar chart of egg-size distribution per day.
// Put in: src/components/WeeklyEggSizeChart.jsx
import "./WeeklyEggSizeChart.css";

const SIZES = [
  { key: "peewee",     label: "Peewee",      color: "#f3dd9a" },
  { key: "small",      label: "Small",       color: "#E4AF1F" },
  { key: "medium",     label: "Medium",      color: "#c8930c" },
  { key: "large",      label: "Large",       color: "#3a7bd5" },
  { key: "extraLarge", label: "Extra Large", color: "#2e9e6b" },
  { key: "jumbo",      label: "Jumbo",       color: "#47321C" },
];

// Aggregate records into the last `days` dates.
function buildSeries(records, days) {
  const byDate = {};
  records.forEach((r) => {
    if (!r.date) return;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date };
    SIZES.forEach((s) => {
      byDate[r.date][s.key] = (byDate[r.date][s.key] || 0) + (Number(r[s.key]) || 0);
    });
  });
  return Object.values(byDate)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-days);
}

const shortDate = (d) =>
  new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric" });

export default function WeeklyEggSizeChart({ records = [], days = 7, title = "Weekly Egg-Size Distribution" }) {
  const series = buildSeries(records, days);
  const maxTotal = Math.max(
    1,
    ...series.map((d) => SIZES.reduce((sum, s) => sum + (d[s.key] || 0), 0))
  );

  return (
    <div className="wesc">
      <div className="wesc-header">
        <h3>{title}</h3>
        <span>Last {days} recorded days</span>
      </div>

      {series.length === 0 ? (
        <div className="wesc-empty">No egg records yet — chart will populate once data is added.</div>
      ) : (
        <>
          <div className="wesc-chart">
            {series.map((d) => {
              const total = SIZES.reduce((sum, s) => sum + (d[s.key] || 0), 0);
              return (
                <div className="wesc-col" key={d.date}>
                  <div className="wesc-bar" style={{ height: `${(total / maxTotal) * 100}%` }} title={`${shortDate(d.date)} — ${total} eggs`}>
                    {SIZES.map((s) =>
                      d[s.key] > 0 ? (
                        <div
                          key={s.key}
                          className="wesc-seg"
                          style={{ flex: d[s.key], background: s.color }}
                          title={`${s.label}: ${d[s.key]}`}
                        />
                      ) : null
                    )}
                  </div>
                  <span className="wesc-xlabel">{shortDate(d.date)}</span>
                </div>
              );
            })}
          </div>

          <div className="wesc-legend">
            {SIZES.map((s) => (
              <span className="wesc-legend-item" key={s.key}>
                <span className="wesc-dot" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
