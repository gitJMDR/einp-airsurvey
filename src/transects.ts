// Transect numbering + derived view metrics, shared by both map views.
// Lines are numbered north→south starting at #1 (survey convention, computed
// from geometry — never trust file order). The default zoom shows five lines
// in heading-up mode: the one being flown plus two either side, first and
// fifth near the screen edges.
import { Dimensions } from "react-native";

export interface TransectLike {
  name: string;
  coords: [number, number][];
}

export interface NumberedTransect extends TransectLike {
  number: number;
  meanLat: number;
}

/** Polylines whose mean latitudes differ by less than this are segments of
 *  the same physical line (~220 m — under half the ~500 m line spacing). */
const SEGMENT_MERGE_DEG = 0.002;

/** Distinct lines (segments merged), north→south, numbered from #1. */
export function numberedTransects(ts: TransectLike[]): NumberedTransect[] {
  const polys = ts.map((t) => ({
    ...t,
    number: 0,
    meanLat: t.coords.reduce((s, c) => s + c[0], 0) / (t.coords.length || 1),
  }));
  polys.sort((a, b) => b.meanLat - a.meanLat);

  // walk north→south, giving segments of one line the same running mean
  const lines: { mean: number; n: number }[] = [];
  for (const p of polys) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.mean - p.meanLat) < SEGMENT_MERGE_DEG) {
      last.mean = (last.mean * last.n + p.meanLat) / (last.n + 1);
      last.n++;
      p.number = lines.length;
    } else {
      lines.push({ mean: p.meanLat, n: 1 });
      p.number = lines.length;
    }
  }
  return polys;
}

/** Median latitude gap between adjacent distinct lines, in degrees. */
export function transectGapDeg(ts: TransectLike[]): number {
  const byLine = new Map<number, number>();
  for (const t of numberedTransects(ts)) if (!byLine.has(t.number)) byLine.set(t.number, t.meanLat);
  const means = [...byLine.values()].sort((a, b) => b - a);
  const gaps = means.slice(1).map((m, i) => Math.abs(m - means[i])).sort((a, b) => a - b);
  if (!gaps.length) return 0.02; // single line — sane spacing fallback
  return gaps[Math.floor(gaps.length / 2)];
}

const EARTH_CIRCUMFERENCE_M = 40075016.7;

/**
 * MapLibre zoom at which five transect gaps fill the screen height
 * (fractional; heading-up puts the lines across the screen).
 */
export function zoomForFiveLines(ts: TransectLike[], lat: number): number {
  const h = Dimensions.get("window").height;
  const gapM = (transectGapDeg(ts) * Math.PI * EARTH_CIRCUMFERENCE_M) / 180;
  // world metres visible vertically = (h / 256) * circumference * cos(lat) / 2^z
  const worldM = 5 * gapM;
  return Math.log2(((h / 256) * EARTH_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / worldM);
}

/** SvgMap scale (pixels per degree of latitude) for the same five-line view. */
export function kForFiveLines(ts: TransectLike[]): number {
  const h = Dimensions.get("window").height;
  return h / (5 * transectGapDeg(ts));
}

/** Rough centre of the transect block, for the no-fix initial view. */
export function transectCentroid(ts: TransectLike[]): { lat: number; lon: number } | null {
  if (!ts.length) return null;
  let lat = 0;
  let lon = 0;
  let n = 0;
  for (const t of ts) for (const c of t.coords) {
    lat += c[0];
    lon += c[1];
    n++;
  }
  return n ? { lat: lat / n, lon: lon / n } : null;
}
