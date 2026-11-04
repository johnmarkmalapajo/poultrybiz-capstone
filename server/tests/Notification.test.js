const path = require("path");
const assert = require("assert");
const S = path.resolve(__dirname, "..");
const stub = (rel, e) => { const f = path.join(S, rel); require.cache[f] = { id: f, filename: f, loaded: true, exports: e, children: [], paths: [] }; };

const users = [
  { _id: "o1", name: "Owner One", email: "owner@x.com", role: "Owner", status: "Active", archived: false, emailNotif: true },
  { _id: "f1", name: "Farmer One", email: "f1@x.com", role: "Farmer", status: "Active", archived: false, emailNotif: true },
  { _id: "f2", name: "Farmer Two", email: "f2@x.com", role: "Farmer", status: "Active", archived: false, emailNotif: false },
  { _id: "f3", name: "Pending F", email: "f3@x.com", role: "Farmer", status: "Pending", archived: false, emailNotif: true },
  { _id: "f4", name: "Archived F", email: "f4@x.com", role: "Farmer", status: "Active", archived: true, emailNotif: true },
];
// Minimal mongo-ish matcher for the filters the util uses.
const match = (u, q) => Object.entries(q).every(([k, v]) => {
  if (k === "email") return !!u.email;
  if (v && typeof v === "object") {
    if ("$ne" in v) return u[k] !== v.$ne;
    if ("$in" in v) return v.$in.includes(u[k]);
    return true;
  }
  return String(u[k]) === String(v);
});
stub("models/User.js", { find: (q) => ({ select: async () => users.filter((u) => match(u, q)) }) });

process.env.BREVO_API_KEY = "k"; process.env.MAIL_USER = "sender@x.com"; process.env.CLIENT_URL = "https://app.example.com,http://localhost:5173";
const sent = [];
global.fetch = async (url, opts) => { const b = JSON.parse(opts.body); sent.push({ to: b.to[0].email, subject: b.subject, html: b.htmlContent }); return { ok: true, text: async () => "" }; };

const { sendNotificationEmail } = require(path.join(S, "utils/notificationEmail.js"));
const results = [];
const test = async (n, f) => { sent.length = 0; try { await f(); results.push(["PASS", n]); } catch (e) { results.push(["FAIL", n + " -> " + e.message]); } };
const to = () => sent.map((s) => s.to).sort();

(async () => {
  await test("Owner-only broadcast -> only Owner", async () => {
    await sendNotificationEmail({ title: "New signup", description: "x", category: "user", priority: "Normal", type: "alert", roles: ["Owner"], userId: null });
    assert.deepStrictEqual(to(), ["owner@x.com"]);
  });
  await test("Owner+Farmer broadcast, farmer-allowed category -> Owner + active opted-in Farmer only", async () => {
    await sendNotificationEmail({ title: "Egg low", description: "x", category: "egg", priority: "Critical", type: "alert", roles: ["Owner", "Farmer"], userId: null });
    assert.deepStrictEqual(to(), ["f1@x.com", "owner@x.com"]);
    assert.ok(sent[0].subject.includes("[Critical]"));
  });
  await test("Owner+Farmer broadcast, non-farmer category (sales) -> Owner only", async () => {
    await sendNotificationEmail({ title: "Sale", description: "x", category: "sales", priority: "Normal", type: "alert", roles: ["Owner", "Farmer"], userId: null });
    assert.deepStrictEqual(to(), ["owner@x.com"]);
  });
  await test("Personal (userId) -> only that person", async () => {
    await sendNotificationEmail({ title: "Task", description: "x", category: "task", priority: "Normal", type: "reminder", roles: [], userId: "f1" });
    assert.deepStrictEqual(to(), ["f1@x.com"]);
  });
  await test("Personal to farmer with opt-out -> nobody", async () => {
    await sendNotificationEmail({ title: "Task", description: "x", category: "task", priority: "Normal", type: "reminder", roles: [], userId: "f2" });
    assert.deepStrictEqual(to(), []);
  });
  await test("Empty roles (everyone) -> Owner + eligible Farmer", async () => {
    await sendNotificationEmail({ title: "Hello", description: "x", category: "health", priority: "Normal", type: "alert", roles: [], userId: null });
    assert.deepStrictEqual(to(), ["f1@x.com", "owner@x.com"]);
  });
  await test("HTML is escaped + link uses first CLIENT_URL", async () => {
    await sendNotificationEmail({ title: "<b>x</b>", description: "a & b", category: "egg", priority: "Normal", type: "alert", roles: ["Owner"], userId: null });
    assert.ok(!sent[0].html.includes("<b>x</b>") && sent[0].html.includes("&lt;b&gt;"));
    assert.ok(sent[0].html.includes("https://app.example.com/notifications"));
  });
  await test("Mail provider failure never throws", async () => {
    const old = global.fetch; global.fetch = async () => ({ ok: false, status: 401, text: async () => "bad key" });
    const origErr = console.error; console.error = () => {};
    await sendNotificationEmail({ title: "t", description: "d", category: "egg", priority: "Normal", type: "alert", roles: ["Owner"], userId: null });
    console.error = origErr; global.fetch = old;
  });
  await test("Missing BREVO_API_KEY -> skipped silently", async () => {
    const k = process.env.BREVO_API_KEY; delete process.env.BREVO_API_KEY;
    const w = console.warn; console.warn = () => {};
    await sendNotificationEmail({ title: "t", description: "d", category: "egg", priority: "Normal", type: "alert", roles: ["Owner"], userId: null });
    console.warn = w; process.env.BREVO_API_KEY = k;
    assert.deepStrictEqual(to(), []);
  });
  results.forEach(([s, n]) => console.log(s, n));
  process.exit(results.some(([s]) => s === "FAIL") ? 1 : 0);
})();