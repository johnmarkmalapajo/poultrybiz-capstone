// BatchSummary.jsx — MOBILE-FIRST standalone page opened by scanning a
// batch QR code. No Sidebar, no top navigation, no breadcrumbs, and no
// admin UI — only the summary of the scanned flock, in PoultryBiz's
// design system (Poppins/Lato, golden-ratio type scale, gold palette).
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { listFlocks } from "../api/flockProfile";
import { listEggRecords } from "../api/eggRecord";
import { listMortalityRecords } from "../api/mortalityRecord";
import { listHealthRecords } from "../api/healthRecord";
import { listQuarantineRecords } from "../api/quarantineIsolation";
import { listFeedConsumption } from "../api/feedConsumption";
import { listFeedInventory } from "../api/feedInventory";
import {
  FiFeather, FiTrendingUp, FiActivity, FiHeart,
  FiGrid, FiBox, FiShield,
} from "react-icons/fi";
import "./BatchSummary.css";

function Info({ label, value }) {
  return (
    <div className="bs-info">
      <span className="bs-info-label">{label}</span>
      <span className="bs-info-value">{value ?? "—"}</span>
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
function formatDateRange(startStr, endStr) {
  if (!startStr) return "—";
  const start = new Date(startStr);
  if (isNaN(start)) return "—";
  const startLabel = start.toLocaleDateString("en-CA");
  if (!endStr || endStr === startStr) return startLabel;
  const end = new Date(endStr);
  if (isNaN(end)) return startLabel;
  return `${startLabel} – ${end.toLocaleDateString("en-CA")}`;
}
const toList = (d) => (Array.isArray(d) ? d : d?.records || d?.data || d?.flocks || []);
const ageWeeksFrom = (dateStr) => {
  if (!dateStr) return null;
  const start = new Date(dateStr);
  if (isNaN(start)) return null;
  const w = Math.max(0, Math.floor((Date.now() - start.getTime()) / (86400000 * 7)));
  return 16 + w; // birds arrive at 16 weeks
};

// Aggregates this batch's data from the real per-module APIs (each
// filtered to this batchId).
async function fetchSummary(batchId) {
  const [flocksRes, eggsRes, mortRes, healthRes, isoRes, feedUsedRes, feedInvRes] = await Promise.all([
    listFlocks().then(toList).catch(() => []),
    listEggRecords().then(toList).catch(() => []),
    listMortalityRecords().then(toList).catch(() => []),
    listHealthRecords().then(toList).catch(() => []),
    listQuarantineRecords().then(toList).catch(() => []),
    listFeedConsumption().then(toList).catch(() => []),
    listFeedInventory().then(toList).catch(() => []),
  ]);

  const batch = flocksRes.find((b) => b.batchId === batchId) || null;
  if (!batch) return { found: false };

  const eggs   = eggsRes.filter((e) => e.batchId === batchId);
  const mort   = mortRes.filter((m) => m.batchId === batchId);
  const health = healthRes.filter((h) => h.batchId === batchId);
  const iso    = isoRes.filter((i) => i.batchId === batchId && i.recordType === "Isolation");
  const feed   = feedUsedRes.filter((f) => f.batchId === batchId);
  const vacc   = health.filter((h) => h.recordType === "Vaccination" || h.vaccineOrDrug);

  const purchased = Number(batch.quantityPurchased) || 0;
  const totalMortality = mort.reduce((s, m) => s + (Number(m.numberOfMortality) || 0), 0);
  const currentQty = Math.max(0, purchased - totalMortality);
  const mortalityRate = purchased ? (totalMortality / purchased) * 100 : 0;

  const eggQty = (e) => Number(e.currentQuantity ?? e.totalEggs ?? e.quantity ?? 0);
  const totalEggs = eggs.reduce((s, e) => s + eggQty(e), 0);
  const eggsToday = eggs.filter((e) => (e.collectionDate || e.date) === today()).reduce((s, e) => s + eggQty(e), 0);
  const eggDays = new Set(eggs.map((e) => e.collectionDate || e.date)).size;
  const avgDaily = eggDays ? totalEggs / eggDays : 0;

  const isoBirds  = iso.reduce((s, i) => s + (Number(i.headCount) || 1), 0);
  const sickBirds = health.filter((h) => /sick|disease/i.test(h.disease || h.diagnosis || "")).reduce((s, h) => s + (Number(h.numberOfBirdsAffected) || 1), 0);
  const liveBirds = Math.max(0, currentQty - isoBirds);
  const productionRate = liveBirds ? (eggsToday / liveBirds) * 100 : 0;

  // cage status C-01 … C-12
  const cages = [];
  for (let n = 1; n <= 12; n++) {
    const id = "C-" + String(n).padStart(2, "0");
    let status = "Healthy";
    if (iso.some((i) => (i.cageId || i.cage) === id)) status = "Isolation";
    else if (health.some((h) => (h.cageId || h.cage) === id && /sick|disease/i.test(h.disease || h.diagnosis || ""))) status = "Sick";
    cages.push({ cage: id, status });
  }

  const feedType = batch.feedType || feed[0]?.feedType || "—";
  const feedToday = feed.filter((f) => f.date === today()).reduce((s, f) => s + (Number(f.quantityConsumed) || 0), 0);
  const remainingFeed = feedInvRes.length
    ? feedInvRes.filter((fi) => fi.feedType === feedType).reduce((s, fi) => s + (Number(fi.quantityIn) || 0) - (Number(fi.quantityOut) || 0), 0)
    : null;
  const lastVac = vacc.length
    ? vacc.slice().sort((a, b) => new Date(a.date) - new Date(b.date)).at(-1)
    : null;

  return {
    found: true,
    batch,
    ageWeeks: ageWeeksFrom(batch.dateAcquired),
    purchased, currentQty, totalMortality, mortalityRate,
    totalEggs, eggsToday, avgDaily, productionRate,
    isoBirds, sickBirds, liveBirds,
    isolation: iso.map((i) => ({ cage: i.cageId || i.cage, birds: Number(i.headCount) || 1, reason: i.symptoms })),
    sick: health.filter((h) => /sick|disease/i.test(h.disease || h.diagnosis || "")).map((h) => ({ cage: h.cageId || h.cage, birds: Number(h.numberOfBirdsAffected) || 1, diagnosis: h.disease || h.diagnosis })),
    cages,
    feedType, feedToday, remainingFeed,
    vaccination: lastVac ? { vaccine: lastVac.vaccineOrDrug, date: lastVac.date, next: lastVac.nextSchedule, medication: lastVac.vaccineOrDrug } : null,
  };
}

export default function BatchSummary() {
  const { batchId } = useParams();
  const [data, setData] = useState({ found: false });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchSummary(batchId)
      .then(setData)
      .catch(() => setData({ found: false }))
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pb_data_changed", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pb_data_changed", onFocus);
    };
  }, [refresh]);

  if (loading) {
    return (
      <div className="bs-page">
        <header className="bs-header">
          <span className="bs-brand">PoultryBiz</span>
          <h1 className="bs-title">Batch Summary</h1>
        </header>
        <main className="bs-body">
          <p style={{ color: "#a39e94", textAlign: "center" }}>Loading batch summary...</p>
        </main>
      </div>
    );
  }

  /* ── Not found ── */
  if (!data.found) {
    return (
      <div className="bs-page">
        <header className="bs-header">
          <span className="bs-brand">PoultryBiz</span>
          <h1 className="bs-title">Batch Summary</h1>
        </header>
        <main className="bs-body">
          <div className="bs-empty">
            <h2>Batch "{batchId}" not found</h2>
            <p>No batch with this ID exists in the records. Please re-scan the QR code or contact the administrator.</p>
          </div>
        </main>
      </div>
    );
  }

  const b = data.batch;
  const num = (n, d = 0) => Number(n || 0).toFixed(d);

  return (
    <div className="bs-page">
      {/* Minimal mobile header — brand + batch only (no admin UI) */}
      <header className="bs-header">
        <span className="bs-brand">PoultryBiz</span>
        <h1 className="bs-title">Batch Summary</h1>
        <span className="bs-batch-pill">{b.batchId}</span>
      </header>

      <main className="bs-body">
        {/* Flock Information */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiFeather /> Flock Information</h3>
          <div className="bs-grid">
            <Info label="Batch ID" value={b.batchId} />
            <Info label="Breed" value={b.breed} />
            <Info label="Supplier" value={b.supplier} />
            <Info label="Date Acquired" value={formatDateRange(b.dateAcquired, b.dateAcquiredEnd)} />
            <Info label="Current Age" value={data.ageWeeks ? `${data.ageWeeks} weeks` : "—"} />
            <Info label="Original Quantity" value={`${data.purchased} birds`} />
            <Info label="Current Quantity" value={`${data.currentQty} birds`} />
            <Info label="Batch Status" value={b.status} />
          </div>
        </section>

        {/* Production */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiTrendingUp /> Production Summary</h3>
          <div className="bs-grid">
            <Info label="Eggs Produced Today" value={data.eggsToday} />
            <Info label="Avg Daily Egg Production" value={num(data.avgDaily, 1)} />
            <Info label="Total Eggs Produced" value={data.totalEggs} />
            <Info label="Production Rate" value={`${num(data.productionRate, 1)}%`} />
          </div>
        </section>

        {/* Mortality */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiActivity /> Mortality Summary</h3>
          <div className="bs-grid">
            <Info label="Total Mortality" value={data.totalMortality} />
            <Info label="Mortality Rate" value={`${num(data.mortalityRate, 1)}%`} />
            <Info label="Current Live Birds" value={data.liveBirds} />
          </div>
        </section>

        {/* Isolation & Health */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiHeart /> Isolation &amp; Health Summary</h3>
          <div className="bs-grid">
            <Info label="Total Birds in Isolation" value={`${data.isoBirds} birds`} />
            <Info label="Total Sick Birds" value={`${data.sickBirds} birds`} />
          </div>
          <div className="bs-two">
            <div>
              <h4 className="bs-sub">Isolation</h4>
              {data.isolation.length
                ? data.isolation.map((i, idx) => (
                    <div key={idx} className="bs-line">
                      <span className="bs-tag iso">{i.cage}</span> {i.birds} bird{i.birds > 1 ? "s" : ""}{i.reason ? ` — ${i.reason}` : ""}
                    </div>
                  ))
                : <p className="bs-none">None</p>}
            </div>
            <div>
              <h4 className="bs-sub">Sick</h4>
              {data.sick.length
                ? data.sick.map((h, idx) => (
                    <div key={idx} className="bs-line">
                      <span className="bs-tag sick">{h.cage}</span> {h.birds} bird{h.birds > 1 ? "s" : ""}{h.diagnosis ? ` — ${h.diagnosis}` : ""}
                    </div>
                  ))
                : <p className="bs-none">None</p>}
            </div>
          </div>
        </section>

        {/* Cage Status */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiGrid /> Cage Status (C-01 → C-12)</h3>
          <div className="bs-cages">
            {data.cages.map((c) => (
              <div key={c.cage} className={`bs-cage ${c.status.toLowerCase()}`}>
                <strong>{c.cage}</strong>
                <span>{c.status}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Feed */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiBox /> Feed Summary</h3>
          <div className="bs-grid">
            <Info label="Feed Type" value={data.feedType} />
            <Info label="Feed Consumed Today" value={`${data.feedToday} kg`} />
            <Info label="Remaining Feed Stock" value={data.remainingFeed != null ? `${data.remainingFeed} kg` : "—"} />
          </div>
        </section>

        {/* Vaccination */}
        <section className="bs-card">
          <h3 className="bs-card-title"><FiShield /> Vaccination</h3>
          <div className="bs-grid">
            <Info label="Last Vaccination" value={data.vaccination ? `${data.vaccination.vaccine} (${data.vaccination.date})` : "—"} />
            <Info label="Next Vaccination Schedule" value={data.vaccination?.next || "—"} />
            <Info label="Current Medication" value={data.vaccination?.medication || "—"} />
          </div>
        </section>

        <p className="bs-foot">
          Live summary for <strong>{b.batchId}</strong> only — updates automatically as related records change.
        </p>
      </main>
    </div>
  );
}