// Filipino versions of messages that are built from templates (they contain
// batch IDs, names, counts, dates). They come from the server (notifications,
// API messages) and from generateAlerts.js, so they cannot be listed one by one.
// Each entry is [RegExp, replacement]; the replacement is a string using $1,
// $2... or a function. A message that matches nothing stays in English.

const word = (map) => (w) => map[w] ?? w;
const dueWord = word({ overdue: "lampas na sa takdang petsa", "due today": "takdang petsa ngayon" });

// Nouns used by the generic "<thing> created successfully." style messages.
const NOUN = {
  "sales": "benta", "sales record": "benta", "expense": "gastos", "expense record": "gastos",
  "egg": "itlog", "egg record": "itlog", "mortality": "pagkamatay", "mortality record": "pagkamatay",
  "health": "kalusugan", "health record": "kalusugan", "feed inventory": "imbentaryo ng pakain",
  "feed inventory record": "imbentaryo ng pakain", "feed consumption": "konsumo ng pakain",
  "feed consumption record": "konsumo ng pakain", "flock": "flock", "flocks": "mga flock",
  "visitor": "bisita", "visitors": "mga bisita", "visitor logs": "mga log ng bisita",
  "todo": "gawain", "task": "gawain", "personnel tasks": "mga gawain ng tauhan",
  "personnel": "tauhan", "notification": "abiso", "notifications": "mga abiso", "record": "record",
  "archived flocks": "mga naka-archive na flock", "archived mortality records": "mga naka-archive na record ng pagkamatay",
  "archived health records": "mga naka-archive na record ng kalusugan", "archived expense records": "mga naka-archive na record ng gastos",
  "sales records": "mga record ng benta", "expense records": "mga record ng gastos", "egg records": "mga record ng itlog",
  "mortality records": "mga record ng pagkamatay", "health records": "mga record ng kalusugan",
};
const noun = (n) => { const k = String(n).toLowerCase(); return NOUN[k] ?? n; };
const DONE = { created: "nagawa", updated: "na-update", deleted: "nabura", archived: "na-archive", restored: "naibalik" };
const CANT = { create: "magawa", retrieve: "ma-load", load: "ma-load", fetch: "ma-load", update: "ma-update", delete: "mabura", archive: "ma-archive", restore: "maibalik" };
const asRecord = (n) => { const t = noun(n); return /^mga |^record|record$/.test(t) ? t : `record ng ${t}`; };

export const PATTERNS = [
  // ---- Dashboard alerts (generateAlerts.js) ----
  [/^Low Productivity — (.+)$/, "Mababang Produksyon — $1"],
  [/^PR is (.+)% \(below the (.+)% break-even\)\. This batch may be running at a loss\.$/, "Ang PR ay $1% (mas mababa sa $2% break-even). Maaaring lugi ang batch na ito."],
  [/^Culling Recommended — (.+)$/, "Inirerekomenda ang Culling — $1"],
  [/^About (\d+) days? of feed left for (\d+) heads\. Reorder soon\.$/, "Mga $1 araw na lang ang natitirang pakain para sa $2 ulo. Mag-order na agad."],

  // ---- Notification titles with variable parts ----
  [/^Scheduled Reminder: (.+) (Overdue|Due Today)$/, (m, label, when) => `Nakaiskedyul na Paalala: ${label} ${when === "Overdue" ? "Lampas na sa Takdang Petsa" : "Takdang Petsa Ngayon"}`],

  // ---- Notification descriptions ----
  [/^(.+) \((.+)\) checked in at (.+) on (.+)\. Purpose: (.+)\.$/, "$1 ($2) ay nag-check in nang $3 noong $4. Layunin: $5."],
  [/^(.+) \((.+)\) checked in at (.+)\.$/, "$1 ($2) ay nag-check in nang $3."],
  [/^(.+) \((.+)\) signed up as a Farmer and is waiting for your approval\.$/, "$1 ($2) ay nag-sign up bilang Magsasaka at naghihintay ng iyong pag-apruba."],
  [/^An attempt to log (.+) (\S+) of (.+) \(batch '(.+)'\) was blocked — only (.+) of stock is available\.$/, "Isang pagtatangkang i-log ang $1 $2 ng $3 (batch '$4') ay hinarang — $5 lang ng stock ang magagamit."],
  [/^Batch (.+) has been marked as Culled — (\d+) birds affected as of (.+)\.$/, "Ang Batch $1 ay namarkahang Culled — $2 manok ang apektado simula $3."],
  [/^High mortality detected in Batch (.+)\. (\d+) bird\(s\) recorded today at (.+)\.$/, "Natukoy ang mataas na pagkamatay sa Batch $1. $2 manok ang naitala ngayon nang $3."],
  [/^(.+) created a new personal task: "(.+)"\.$/, '$1 ay gumawa ng bagong personal na gawain: "$2".'],
  [/^(.+) completed a personal task: "(.+)"\.$/, '$1 ay nakatapos ng personal na gawain: "$2".'],
  [/^(.+) marked your personal task "(.+)" as completed\.$/, 'Minarkahan ni $1 na tapos na ang iyong personal na gawain na "$2".'],
  [/^(.+) assigned you a new task: "(.+)"\.$/, 'Binigyan ka ni $1 ng bagong gawain: "$2".'],
  [/^(.+) reassigned a task to you: "(.+)"\.$/, 'Itinalaga ulit ni $1 sa iyo ang gawain: "$2".'],
  [/^(.+) marked your assigned task "(.+)" as completed\.$/, 'Minarkahan ni $1 na tapos na ang itinalaga mong gawain na "$2".'],
  [/^(.+) updated your assigned task: "(.+)"\.$/, 'In-update ni $1 ang itinalaga mong gawain: "$2".'],
  [/^Health issue detected in Batch (.+): (.+)\. Reported (.+) at (.+)\.$/, "Natukoy ang isyu sa kalusugan sa Batch $1: $2. Iniulat noong $3 nang $4."],
  [/^Recorded transactions currently show a net loss of PHP (.+)\.$/, "Ipinapakita ng mga naitalang transaksyon ang netong lugi na PHP $1."],
  [/^(.+) answered 'Yes' to a biosecurity risk question during check-in on (.+)\. Review before allowing farm access\.$/, "Sumagot ng 'Oo' si $1 sa tanong tungkol sa biosecurity risk sa check-in noong $2. Suriin muna bago payagan ang pagpasok sa farm."],
  [/^(.+) at (.+) is in Poor condition and needs maintenance\.$/, "Ang $1 sa $2 ay nasa Mahinang kondisyon at kailangan ng maintenance."],
  [/^"(.+)" \(assigned to (.+)\) is (overdue|due today) \((.+)\)\.$/, (m, w, who, when, d) => `"${w}" (itinalaga kay ${who}) ay ${dueWord(when)} (${d}).`],
  [/^"(.+)" is (overdue|due today) \((.+)\)\.$/, (m, w, when, d) => `"${w}" ay ${dueWord(when)} (${d}).`],
  [/^Batch (.+) is eligible for culling: (.+)\.$/, "Ang Batch $1 ay puwede nang i-cull: $2."],
  [/^(\d+) new Farmer account\(s\) waiting for Owner approval\.$/, "$1 bagong account ng Magsasaka ang naghihintay ng pag-apruba ng May-ari."],
  [/^(.+) stock is (empty|low): (.+) kg \((.+) sacks at (.+) kg\/sack\) remaining\. Alert threshold is (.+) (.+)\.$/, (m, feed, state, kg, sacks, per, th, unit) => `Ang stock ng ${feed} ay ${state === "empty" ? "ubos na" : "mababa"}: ${kg} kg (${sacks} sako sa ${per} kg/sako) ang natitira. Ang limitasyon ng alerto ay ${th} ${unit}.`],
  [/^The (\d+)-day quarantine period of Batch (.+) has ended\. The batch was automatically released on (.+?)\.(.*)$/, "Natapos na ang $1-araw na quarantine ng Batch $2. Awtomatikong inilabas ang batch noong $3.$4"],
  [/^Egg production has not yet been recorded today for Batch (.+)\.$/, "Hindi pa naitatala ang produksyon ng itlog ngayon para sa Batch $1."],
  [/^Reminder: egg production for Batch (.+) has not yet been recorded today\.$/, "Paalala: hindi pa naitatala ngayon ang produksyon ng itlog para sa Batch $1."],
  [/^Final reminder: please record today's egg production for Batch (.+)\.$/, "Huling paalala: pakitala ang produksyon ng itlog ngayon para sa Batch $1."],
  [/^Egg production has not been recorded today for Batch (.+)\.$/, "Hindi naitala ang produksyon ng itlog ngayon para sa Batch $1."],

  // ---- extra API / UI messages ----
  [/^Please wait (\S+) before adding this same batch again \(same date, breed and supplier\)\. Change the date, breed or supplier to add a different batch\.$/, "Pakihintay ang $1 bago idagdag muli ang parehong batch (parehong petsa, lahi at supplier). Palitan ang petsa, lahi o supplier para magdagdag ng ibang batch."],
  [/^Restored (.+) "(.+)"\.$/, 'Naibalik ang $1 "$2".'],
  [/^Permanently deleted (.+) "(.+)"\.$/, 'Permanenteng nabura ang $1 "$2".'],
  [/^Please enter the specific (waste type|disposal method)\.$/, (m, w) => `Pakilagay ang partikular na ${w === "waste type" ? "uri ng basura" : "paraan ng pagtatapon"}.`],
  [/^Please enter a specific (waste type|disposal method), not the word "Others"\.$/, (m, w) => `Pakilagay ang partikular na ${w === "waste type" ? "uri ng basura" : "paraan ng pagtatapon"}, hindi ang salitang "Others".`],
  [/^The (waste type|disposal method) must be (\d+) characters or fewer\.$/, (m, w, n) => `Ang ${w === "waste type" ? "uri ng basura" : "paraan ng pagtatapon"} ay dapat hindi hihigit sa ${n} na karakter.`],
  [/^Please enter a valid (waste type|disposal method)\.$/, (m, w) => `Pakilagay ang wastong ${w === "waste type" ? "uri ng basura" : "paraan ng pagtatapon"}.`],
  [/^(Waste type|Disposal method) is required\.$/, (m, w) => `Kailangan ang ${w === "Waste type" ? "uri ng basura" : "paraan ng pagtatapon"}.`],
  // ---- Server API messages ----
  [/^(.+?) (?:record )?(created|updated|deleted|archived|restored) successfully\.$/, (m, n, v) => `Matagumpay na ${DONE[v]} ang ${asRecord(n)}.`],
  [/^(.+?) (archived|restored|deleted) successfully\.$/, (m, n, v) => `Matagumpay na ${DONE[v]} ang ${noun(n)}.`],
  [/^Unable to (create|retrieve|load|fetch|update|delete|archive|restore) (.+)\.$/, (m, v, n) => `Hindi ${CANT[v]} ang ${noun(n)}.`],
  [/^Failed to (create|fetch|update|delete|archive|restore) (.+)\.$/, (m, v, n) => `Hindi ${CANT[v]} ang ${noun(n)}.`],
  [/^(.+?) not found\.$/, (m, n) => `Hindi nakita ang ${/record$/i.test(n) ? asRecord(n) : noun(n)}.`],
  [/^Batch ([\w-]+) already has an egg record for (.+)\.$/, "May record na ng itlog ang Batch $1 para sa $2."],
  [/^This batch in this day is already collected\. Batch (.+) already has an egg record for (.+)\.$/, "Nakolekta na ang batch na ito sa araw na ito. May record na ng itlog ang Batch $1 para sa $2."],
  [/^Total eggs: (\d+)\. Current chickens: (\d+)\. Please reduce the egg quantities\.$/, "Kabuuang itlog: $1. Kasalukuyang manok: $2. Pakibawasan ang dami ng itlog."],
  [/^Number of Birds Isolated cannot exceed the available birds in this batch \((\d+)\)\.$/, "Ang Bilang ng Manok na Na-isolate ay hindi puwedeng lumampas sa magagamit na manok sa batch na ito ($1)."],
  [/^Number of mortality exceeds the current Quarantine Head Count \((\d+)\)\.$/, "Ang bilang ng namatay ay lampas sa kasalukuyang Quarantine Head Count ($1)."],
  [/^Number of Birds Administered cannot exceed the available birds in this batch \((\d+)\)\.$/, "Ang Bilang ng Manok na Binigyan ay hindi puwedeng lumampas sa magagamit na manok sa batch na ito ($1)."],
  [/^Quantity consumed exceeds available feed stock\. Only (.+) of (.+) is available\.$/, "Ang dami na nakonsumo ay lampas sa magagamit na stock ng pakain. $1 lang ng $2 ang magagamit."],
  [/^Low stock alert settings for (.+) saved\.$/, "Na-save ang mga setting ng alerto sa mababang stock para sa $1."],
  [/^You already checked in today at (.+)\. No new record was created\..*$/, "Nag-check in ka na ngayon nang $1. Walang bagong record na ginawa."],
  [/^You already checked out today at (.+)\. No new record was created\.$/, "Nag-check out ka na ngayon nang $1. Walang bagong record na ginawa."],
];

export const translateByPattern = (text) => {
  if (typeof text !== "string" || text.length > 600) return undefined;
  for (const [re, rep] of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (typeof rep === "function") return rep(...m);
    return text.replace(re, rep);
  }
  return undefined;
};