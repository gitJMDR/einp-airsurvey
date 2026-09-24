// One-time: extract the exact column headers of UngulateSpatial and
// SurveyConditions from the master workbook, so app exports match reality.
// Run from app/:  node scripts/parse-workbook-headers.mjs
import { readFileSync, readdirSync } from "fs";

const DIR = "_wb";
const shared = readFileSync(`${DIR}/xl/sharedStrings.xml`, "utf8");
const strings = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")
);

const workbook = readFileSync(`${DIR}/xl/workbook.xml`, "utf8");
const rels = readFileSync(`${DIR}/xl/_rels/workbook.xml.rels`, "utf8");

const relMap = {};
for (const r of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
  relMap[r[1]] = r[2];
}

function sheetFile(name) {
  const re = new RegExp(`<sheet[^>]*name="${name}"[^>]*r:id="([^"]+)"`);
  const m = workbook.match(re) || workbook.match(new RegExp(`<sheet[^>]*r:id="([^"]+)"[^>]*name="${name}"`));
  return `${DIR}/xl/${relMap[m[1]].replace(/^\//, "")}`;
}

// Excel column order: A..Z then AA, AB… — by length, then letters.
// (localeCompare alone puts AA *before* B, which once shuffled the QC
// column into second position and nearly shipped a wrong export order.)
const colRank = (ref) => {
  const L = ref.replace(/[0-9]/g, "");
  return L.length * 100 + [...L].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0);
};

function firstRowHeaders(sheetPath) {
  const xml = readFileSync(sheetPath, "utf8");
  const row = xml.match(/<row[^>]*>([\s\S]*?)<\/row>/)[1];
  const headers = [];
  for (const c of row.matchAll(/<c\b([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
    const attrs = c[1];
    const v = c[2];
    if (v === undefined) continue;
    const type = attrs.match(/t="(\w+)"/)?.[1];
    const ref = attrs.match(/r="([A-Z]+)\d+"/)?.[1];
    headers.push({ ref, header: type === "s" ? strings[Number(v)] : v });
  }
  return headers.sort((a, b) => colRank(a.ref) - colRank(b.ref)).map((h) => h.header);
}

for (const name of ["UngulateSpatial", "SurveyConditions", "AdditionalAirSurveys"]) {
  try {
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(firstRowHeaders(sheetFile(name))));
  } catch (e) {
    console.log(`${name}: FAILED - ${e.message}`);
  }
}
console.log("\n(all sheet files: " + readdirSync(`${DIR}/xl/worksheets`).join(", ") + ")");
