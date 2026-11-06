// Shows a culling status pill for a flock. Put in: src/components/CullingBadge.jsx
import {
  productivityRate, flockAgeMonths, cullingRecommendation,
} from "../utils/poultryFormulas";
import "./CullingBadge.css";
import { useLanguage } from "../i18n/LanguageContext";

// Pass a flock object: { dateAcquired, eggsToday, currentQty }
export default function CullingBadge({ flock = {} }) {
  const { t: tr } = useLanguage();
  const ageMonths = flockAgeMonths(flock.dateAcquired);
  const pr  = productivityRate(flock.eggsToday, flock.currentQty);
  const { shouldCull, reasons } = cullingRecommendation({ ageMonths, pr });

  return (
    <span
      className={`cull-badge ${shouldCull ? "cull-due" : "cull-ok"}`}
      title={shouldCull ? reasons.join("; ") : tr("Within productive lifecycle")}
    >
      {shouldCull ? "Cull due" : "Active"}
    </span>
  );
}