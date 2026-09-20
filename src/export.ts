// Exports. Column names and order are taken verbatim from the master
// workbook (scripts/parse-workbook-headers.mjs) so files load into the
// UngulateSpatial and SurveyConditions sheets with zero reformatting.
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";
import { getLegs, getTracklog, getWaypoints } from "./db";
import type { LegRecord, SessionInfo, WaypointRecord } from "./types";
import { managementYear, mstParts, pad2, recruitmentYear } from "./time";

// Exact column order from the workbook (verified against cell refs A..AA):
export const SIGHTINGS_COLUMNS = [
  "RecruitmentYear", "ManagementYear", "Waypoint", "Year", "Month", "Day",
  "Hour", "Minute", "Second", "Area", "Latitude", "Longitude", "Species", "Total",
  "Bulls", "Yearlings", "Cows", "Calves", "Unknown", "Distance", "Movement",
  "Comments", "Navigator", "Observer1", "Observer2", "Transcriber", "QC",
] as const;

export const CONDITIONS_COLUMNS = [
  "RecruitmentYear", "ManagementYear", "Year", "Month", "Day",
  "Area", "SurveyLeg", "LegWptStart", "LegWptEnd", "LegTimeStart", "LegTimeEnd",
  "AirCharterCo", "Aircraft", "Pilot", "PilotRating", "Navigator", "NavigatorRating",
  "Observer1", "Observer1Rating", "Observer2", "Observer2Rating", "Temperature",
  "LightIntensity", "PercCloudCover", "AvSnowDepth_cm", "HrsSinceSnow", "AmtLastSnow", "Notes",
] as const;

// Hwy 16 corridor splits the park into North/South areas; sightings north of
// this latitude belong to the North area. TO VERIFY with Jonathan (morning flag).
const AREA_BOUNDARY_LAT = 53.567;

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: readonly string[], rows: (string | number | null)[][]): string {
  return [columns.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\r\n") + "\r\n";
}

function areaForLat(lat: number): string {
  return lat >= AREA_BOUNDARY_LAT ? "North" : "South";
}

/** The leg whose time window contains the waypoint (or the nearest earlier leg). */
function legForTime(legs: LegRecord[], iso: string): LegRecord | null {
  const sorted = [...legs].sort((a, b) => (a.started_at ?? "").localeCompare(b.started_at ?? ""));
  let match: LegRecord | null = null;
  for (const l of sorted) {
    if (l.started_at && l.started_at <= iso) match = l;
    else break;
  }
  return match;
}

function commentsFor(w: WaypointRecord): string {
  const parts: string[] = [];
  if (w.circled) parts.push("circled");
  if (w.photographed) parts.push("photographed");
  if (w.captive) parts.push("captive");
  if (w.collared) parts.push("collared");
  if (w.recheck) parts.push("check");
  if (w.duplicate) parts.push("duplicate?");
  if (w.not_dup) parts.push("not dup");
  if (w.notes) parts.push(w.notes);
  return parts.join("; ");
}

const classSum = (w: WaypointRecord): number =>
  (w.bulls ?? 0) + (w.cows ?? 0) + (w.yearlings ?? 0) + (w.calves ?? 0);

function exportFileName(session: SessionInfo, suffix: string, ext: string): string {
  const p = mstParts(new Date(session.started_at));
  return `airsurvey_${p.year}-${pad2(p.month)}-${pad2(p.day)}_${pad2(p.hour)}${pad2(p.minute)}_${suffix}.${ext}`;
}

export function buildSightingsCsv(session: SessionInfo): string {
  const waypoints = getWaypoints(session.id);
  const legs = getLegs(session.id);
  const ry = recruitmentYear(new Date(session.started_at));
  const my = managementYear(new Date(session.started_at));
  const rows = waypoints.map((w) => {
    const t = mstParts(new Date(w.recorded_at));
    const leg = legForTime(legs, w.recorded_at);
    return [
      ry,
      my,
      w.number,
      t.year,
      pad2(t.month),
      pad2(t.day),
      pad2(t.hour),
      pad2(t.minute),
      pad2(t.second),
      leg?.area ?? areaForLat(w.latitude),
      w.latitude,
      w.longitude,
      w.species,
      w.total,
      w.bulls ?? 0,
      w.yearlings ?? 0,
      w.cows ?? 0,
      w.calves ?? 0,
      Math.max(0, w.total - classSum(w)),
      "", // Distance — legacy column, not collected by the app
      "", // Movement — legacy column, not collected by the app
      commentsFor(w),
      leg?.navigator.name ?? "",
      leg?.observer1.name ?? "",
      leg?.observer2.name ?? "",
      "", // Transcriber — the app replaces the transcription step; left for the workbook
      "", // QC — filled in during the workbook QC step, not by the app
    ];
  });
  return toCsv(SIGHTINGS_COLUMNS, rows);
}

export function buildConditionsCsv(session: SessionInfo): string {
  const legs = getLegs(session.id);
  const waypoints = getWaypoints(session.id);
  const t0 = mstParts(new Date(session.started_at));
  const ry = recruitmentYear(new Date(session.started_at));
  const my = managementYear(new Date(session.started_at));
  const rows = legs.map((l) => {
    const inLeg = waypoints.filter((w) => (!l.started_at || w.recorded_at >= l.started_at) && (!l.ended_at || w.recorded_at <= l.ended_at));
    const numbers = inLeg.map((w) => w.number).sort((a, b) => a - b);
    const fmtTime = (iso: string | null) => {
      if (!iso) return "";
      const t = mstParts(new Date(iso));
      return `${pad2(t.hour)}:${pad2(t.minute)}:${pad2(t.second)}`;
    };
    return [
      ry,
      my,
      t0.year,
      pad2(t0.month),
      pad2(t0.day),
      l.area ?? "",
      l.survey_leg ?? "",
      numbers.length ? numbers[0] : "",
      numbers.length ? numbers[numbers.length - 1] : "",
      fmtTime(l.started_at),
      fmtTime(l.ended_at),
      // aircraft & pilot are survey-level now; fall back to legacy leg values
      session.air_charter_co ?? l.air_charter_co ?? "",
      session.aircraft ?? l.aircraft ?? "",
      session.pilot ?? l.pilot.name ?? "",
      session.pilot_rating ?? l.pilot.exp ?? "",
      l.navigator.name,
      l.navigator.exp,
      l.observer1.name,
      l.observer1.exp,
      l.observer2.name,
      l.observer2.exp,
      l.temperature ?? "",
      l.light ?? "",
      l.cloud_pct ?? "",
      session.snow_avg_cm ?? "",
      session.snow_hrs_since ?? "",
      session.snow_last_amt_cm ?? "",
      l.notes ?? "",
    ];
  });
  return toCsv(CONDITIONS_COLUMNS, rows);
}

export function buildGpx(session: SessionInfo): string {
  const waypoints = getWaypoints(session.id);
  const track = getTracklog(session.id);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const wptXml = waypoints
    .map(
      (w) =>
        `  <wpt lat="${w.latitude}" lon="${w.longitude}">\n    <name>${w.number}</name>\n    <desc>${esc(
          `${w.species} x${w.total}${commentsFor(w) ? " — " + commentsFor(w) : ""}`
        )}</desc>\n    <time>${w.recorded_at}</time>\n  </wpt>`
    )
    .join("\n");
  const trkXml = track
    .map(
      (p) =>
        `      <trkpt lat="${p.latitude}" lon="${p.longitude}">${
          p.altitude_m != null ? `<ele>${p.altitude_m.toFixed(1)}</ele>` : ""
        }<time>${p.recorded_at}</time></trkpt>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Air Survey app" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${exportFileName(session, "track", "gpx")}</name></metadata>
${wptXml}
  <trk><name>Survey track</name><trkseg>
${trkXml}
  </trkseg></trk>
</gpx>
`;
}

/** Write to the cache directory and open the Android share sheet. */
export async function shareExport(content: string, fileName: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!Sharing.isAvailableAsync()) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Export ${fileName}` });
}

/** One-tap export: sightings CSV + conditions CSV + GPX track, zipped. */
export async function shareAllExports(session: SessionInfo): Promise<void> {
  const zip = new JSZip();
  zip.file(exportFileName(session, "sightings", "csv"), buildSightingsCsv(session));
  zip.file(exportFileName(session, "conditions", "csv"), buildConditionsCsv(session));
  zip.file(exportFileName(session, "track", "gpx"), buildGpx(session));
  const base64 = await zip.generateAsync({ type: "base64" });
  const fileName = exportFileName(session, "export", "zip");
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(base64, { encoding: "base64" });
  if (!Sharing.isAvailableAsync()) throw new Error("Sharing is not available on this device");
  await Sharing.shareAsync(file.uri, { mimeType: "application/zip", dialogTitle: `Export ${fileName}` });
}
