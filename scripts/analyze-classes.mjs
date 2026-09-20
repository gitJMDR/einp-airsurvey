// One-time analysis: which class-count combinations actually occur in the
// historical UngulateSpatial data, to choose "template" buttons.
// Run from app/:  node scripts/analyze-classes.mjs
import { readFileSync } from "fs";

const DIR = "_wb";
const shared = readFileSync(`${DIR}/xl/sharedStrings.xml`, "utf8");
const strings = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")
);
const sheet = readFileSync(`${DIR}/xl/worksheets/sheet2.xml`, "utf8"); // UngulateSpatial

// Column letters for: species M, total N, bulls O, yearlings P, cows Q, calves R, unknown S
const WANT = { M: "species", N: "total", O: "bulls", P: "yearlings", Q: "cows", R: "calves", S: "unknown" };
const colLetter = (ref) => ref.replace(/\d+/g, "");
const num = (v) => {
  if (v == null || v === "" || v === "NA") return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
};

const rows = [];
for (const rowMatch of sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  if (Number(rowMatch[1]) === 1) continue; // header
  const cells = {};
  for (const c of rowMatch[2].matchAll(/<c\b([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
    const attrs = c[1];
    const v = c[2];
    if (v === undefined) continue;
    const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
    const type = attrs.match(/t="(\w+)"/)?.[1];
    const field = WANT[ref ?? ""];
    if (field) cells[field] = type === "s" ? strings[Number(v)] : v;
  }
  const t = num(cells.total);
  if (t == null || t <= 0 || !cells.species) continue; // no observation (NA rows, blanks)
  rows.push({
    species: cells.species.toLowerCase(),
    total: t,
    bulls: num(cells.bulls) ?? 0,
    yearlings: num(cells.yearlings) ?? 0,
    cows: num(cells.cows) ?? 0,
    calves: num(cells.calves) ?? 0,
    unknown: num(cells.unknown) ?? 0,
  });
}

console.log(`observations with a count: ${rows.length}`);
const bySpecies = new Map();
for (const r of rows) bySpecies.set(r.species, (bySpecies.get(r.species) ?? 0) + 1);
console.log("by species:", [...bySpecies.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join(", "));

const withClasses = rows.filter((r) => r.bulls + r.yearlings + r.cows + r.calves > 0);
console.log(`rows with any class data: ${withClasses.length} (${((withClasses.length / rows.length) * 100).toFixed(0)}%)`);

const patterns = new Map();
const key = (r) => `${r.bulls}|${r.yearlings}|${r.cows}|${r.calves}|${r.unknown}`;
for (const r of withClasses) {
  const k = key(r);
  const e = patterns.get(k) ?? { count: 0, species: new Map(), total: new Map() };
  e.count++;
  e.species.set(r.species, (e.species.get(r.species) ?? 0) + 1);
  e.total.set(r.total, (e.total.get(r.total) ?? 0) + 1);
  patterns.set(k, e);
}

console.log("\nTOP CLASS PATTERNS (bulls|yearlings|cows|calves|unknown):");
const sorted = [...patterns.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15);
for (const [k, e] of sorted) {
  const sp = [...e.species.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join(" ");
  const tot = [...e.total.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t, n]) => `${t}×${n}`).join(" ");
  console.log(`  [${k}]  n=${e.count}  totals(${tot})  species(${sp})`);
}
