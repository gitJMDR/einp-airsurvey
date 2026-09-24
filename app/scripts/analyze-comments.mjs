// One-time: which comments recur in the historical UngulateSpatial data,
// to pick additional comment chips. Run from app/: node scripts/analyze-comments.mjs
import { readFileSync } from "fs";

const DIR = "_wb";
const shared = readFileSync(`${DIR}/xl/sharedStrings.xml`, "utf8");
const strings = [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  [...m[1].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")
);
const sheet = readFileSync(`${DIR}/xl/worksheets/sheet2.xml`, "utf8");

// header row 1: name -> column letter
const headerCells = [...sheet.matchAll(/<row[^>]*r="1"[^>]*>([\s\S]*?)<\/row>/g)][0][1];
const colByName = {};
for (const c of headerCells.matchAll(/<c\b([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
  const ref = c[1].match(/r="([A-Z]+)\d+"/)?.[1];
  const type = c[1].match(/t="(\w+)"/)?.[1];
  if (!ref || c[2] === undefined) continue;
  const name = type === "s" ? strings[Number(c[2])] : c[2];
  if (name) colByName[name] = ref;
}
console.log("columns:", JSON.stringify(colByName));
const commentsCol = colByName["Comments"];
const speciesCol = colByName["Species"];
if (!commentsCol) throw new Error("Comments column not found");

const rowRe = /<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
const cellsOf = (xml) => {
  const out = {};
  for (const c of xml.matchAll(/<c\b([^>]*)>(?:<v>([^<]*)<\/v>)?<\/c>/g)) {
    const ref = c[1].match(/r="([A-Z]+)\d+"/)?.[1];
    const type = c[1].match(/t="(\w+)"/)?.[1];
    if (!ref || c[2] === undefined) continue;
    out[ref] = type === "s" ? strings[Number(c[2])] : c[2];
  }
  return out;
};

const mask = (s) =>
  s
    .toLowerCase()
    .replace(/\d+/g, "n")
    .replace(/\s+/g, " ")
    .trim();

const whole = new Map();
const fragments = new Map();
let withComments = 0;
let totalRows = 0;
let m;
while ((m = rowRe.exec(sheet))) {
  if (Number(m[1]) === 1) continue;
  const cells = cellsOf(m[2]);
  const comment = (cells[commentsCol] ?? "").trim();
  const species = (cells[speciesCol] ?? "").toLowerCase();
  if (!comment || comment === "NA") continue;
  if (!species || species === "na") continue;
  totalRows++;
  const masked = mask(comment);
  withComments++;
  whole.set(masked, (whole.get(masked) ?? 0) + 1);
  for (const frag of comment.split(/[;,.]|\band\b/)) {
    const f = mask(frag);
    if (f.length < 3 || f === "n" || /^(n\s*)+$/.test(f)) continue;
    fragments.set(f, (fragments.get(f) ?? 0) + 1);
  }
}

console.log(`\nrows with comments: ${withComments}`);
console.log("\nTOP WHOLE COMMENTS (digits masked as n):");
for (const [c, n] of [...whole.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n} × "${c}"`);
console.log("\nTOP COMMENT FRAGMENTS:");
for (const [c, n] of [...fragments.entries()].sort((a, b) => b[1] - a[1]).slice(0, 35)) console.log(`  ${n} × "${c}"`);
