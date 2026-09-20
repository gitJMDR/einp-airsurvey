// One-time converter: turns the park's flight-lines GPX into transects.json
// used by the map. Run from app/:  node scripts/parse-gpx.mjs
import { readFileSync, writeFileSync } from "fs";

const GPX_PATH = "../reference material/UngulateSurvey_FlightLines.gpx";
const OUT_PATH = "src/transects.json";

const gpx = readFileSync(GPX_PATH, "utf8");

// Each waypoint looks like: <wpt lat="53.7" lon="-112.8"><name>1W</name>
const points = [...gpx.matchAll(/<wpt lat="([^"]+)" lon="([^"]+)">[\s\S]*?<name>([^<]+)<\/name>/g)]
  .map((m) => ({ lat: Number(m[1]), lon: Number(m[2]), name: m[3].trim() }));

const rows = new Map(); // "1" -> { W:[lat,lon], C:[...], E:[...] }
let helipad = null;

for (const p of points) {
  if (p.name.toLowerCase().includes("helipad")) {
    helipad = [p.lat, p.lon];
    continue;
  }
  const side = p.name.slice(-1); // W, C or E
  const label = p.name.slice(0, -1); // e.g. "1", "46a"
  if (!/^[WCE]$/.test(side)) continue;
  if (!rows.has(label)) rows.set(label, {});
  rows.get(label)[side] = [p.lat, p.lon];
}

const transects = [...rows.entries()]
  .filter(([_, s]) => s.W && s.E)
  .sort((a, b) => Number(a[0].replace(/\D/g, "")) - Number(b[0].replace(/\D/g, "")) || a[0].localeCompare(b[0]))
  .map(([label, s]) => ({
    name: label,
    coords: [s.W, ...(s.C ? [s.C] : []), s.E],
  }));

writeFileSync(OUT_PATH, JSON.stringify({ generatedFrom: "UngulateSurvey_FlightLines.gpx", transects, helipad }, null, 1));
console.log(`Wrote ${transects.length} transects${helipad ? " + helipad" : ""} to ${OUT_PATH}`);
