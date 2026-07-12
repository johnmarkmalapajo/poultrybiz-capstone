// BatchSummary.jsx — MOBILE-FIRST standalone page opened by scanning a
// batch QR code. No Sidebar, no top navigation, no breadcrumbs, and no
// admin UI — only the summary of the scanned flock, in PoultryBiz's
// design system (Poppins/Lato, golden-ratio type scale, gold palette).
import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import batchStore from "../batchStore"; // adjust path if batchStore.js is elsewhere
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

export default function BatchSummary() {
  const { batchId } = useParams();
  const [data, setData] = useState(() => batchStore.getSummary(batchId));

  const refresh = useCallback(() => setData(batchStore.getSummary(batchId)), [batchId]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, [refresh]);

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
            <h2>Batch “{batchId}” not found</h2>
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
            <Info label="Date Acquired" value={b.dateAcquired} />
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
