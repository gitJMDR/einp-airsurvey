// Sanity check: every INSERT's placeholder count matches its column count.
const fs = require("fs");
const s = fs.readFileSync("src/db.ts", "utf8");
let ok = true;
for (const m of s.matchAll(/INSERT INTO (\w+) \(([^)]*)\)[\s\S]*?VALUES (\([^)]*\))/g)) {
  const [, table, cols, vals] = m;
  const nCols = cols.split(",").map((c) => c.trim()).filter(Boolean).length;
  const nQs = (vals.match(/\?/g) || []).length;
  const match = nCols === nQs;
  if (!match) ok = false;
  console.log(`${table}: columns ${nCols} | placeholders ${nQs} ${match ? "MATCH" : "MISMATCH"}`);
}
console.log(ok ? "ALL OK" : "FIX NEEDED");
