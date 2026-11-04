import { pathToFileURL } from "url";
const RealDate = Date;
let fixed = null;
globalThis.Date = class extends RealDate { constructor(...a) { if (a.length === 0 && fixed !== null) super(fixed); else super(...a); } static now() { return fixed ?? RealDate.now(); } };
const { phToday } = await import(pathToFileURL("/home/claude/POULTRYBIZ-CAPSTONE-MAKDOMAK-DASHBOARD-FIXED/client/src/phDate.js").href);
const cases = [
  ["2026-11-01T15:59:59Z", "2026-11-01"], // 23:59:59 PH
  ["2026-11-01T16:00:00Z", "2026-11-02"], // 00:00:00 PH  (UTC is still Nov 1)
  ["2026-11-02T00:30:00Z", "2026-11-02"], // 08:30 PH
  ["2026-12-31T16:00:00Z", "2027-01-01"], // year rollover
];
let bad = 0;
for (const [iso, want] of cases) { fixed = new RealDate(iso).getTime(); const got = phToday(); const ok = got === want; if (!ok) bad++; console.log(ok ? "PASS" : "FAIL", `${process.env.TZ || "system"} ${iso} -> ${got} (want ${want})`); }
process.exit(bad ? 1 : 0);
