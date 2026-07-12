// CullingBadge.jsx
// Shows a culling status pill for a flock. Put in: src/components/CullingBadge.jsx
import {
  productivityRate, breakageRate, flockAgeMonths, cullingRecommendation,
} from "../utils/poultryFormulas";
import "./CullingBadge.css";

// Pass a flock object: { dateAcquired, eggsToday, currentQty, crackedToday, totalEggsToday }
export default function CullingBadge({ flock = {} }) {
  const ageMonths = flockAgeMonths(flock.dateAcquired);
  const pr  = productivityRate(flock.eggsToday, flock.currentQty);
  const brk = breakageRate(flock.crackedToday, flock.totalEggsToday);
  const { shouldCull, reasons } = cullingRecommendation({ ageMonths, pr, breakagePct: brk });

  return (
    <span
      className={`cull-badge ${shouldCull ? "cull-due" : "cull-ok"}`}
      title={shouldCull ? reasons.join("; ") : "Within productive lifecycle"}
    >
      {shouldCull ? "Cull due" : "Active"}
    </span>
  );
}
