// Shared types for the Air Survey app.

export interface GpsFix {
  latitude: number;
  longitude: number;
  accuracy: number | null; // metres
  altitude: number | null; // metres
  speed: number | null; // m/s
  heading: number | null;
  timestamp: number;
}

/** One point of the live tracklog; `leg` colours it green (on-leg) or red. */
export interface TrackPoint {
  latitude: number;
  longitude: number;
  leg: boolean;
}

export interface SpeciesDef {
  key: string; // lowercase, used in exports (must match workbook species spellings)
  label: string;
  code: string; // single letter shown on the big button
  custom?: boolean; // user-added in Settings; deletable
}

export type SpeedUnit = "kmh" | "kt";
export type AltUnit = "m" | "ft";
export type UnitsMode = "metric" | "aviation";

/** Survey targets. Always stored in km/h and metres; converted for display. */
export interface Targets {
  speedKmh: number;
  speedTolKmh: number;
  altM: number;
  altTolM: number;
}

export interface AppSettings {
  species: SpeciesDef[];
  units: UnitsMode;
  targets: Targets;
}

/** What the Mark pop-over collects before saving. */
export interface SightingDraft {
  species: string | null;
  total: string; // kept as string while typing; parsed on save
  classes: { bulls: string; cows: string; yearlings: string; calves: string };
  photographed: boolean;
  circled: boolean;
  recheck: boolean;
  duplicate: boolean;
  captive: boolean;
  collared: boolean;
  notDup: boolean;
  notes: string;
}

export interface WaypointRecord {
  id: number;
  number: number;
  recorded_at: string;
  latitude: number;
  longitude: number;
  species: string;
  total: number;
  bulls: number | null;
  cows: number | null;
  yearlings: number | null;
  calves: number | null;
  photographed: number;
  circled: number;
  recheck: number;
  duplicate: number;
  captive: number;
  collared: number;
  not_dup: number;
  notes: string | null;
}

export type Experience = "A" | "B" | "C"; // A experienced+current, B experienced not current, C inexperienced

export interface CrewSlot {
  name: string;
  exp: Experience;
}

export interface LegRecord {
  id: number;
  session_id: number;
  started_at: string | null;
  ended_at: string | null;
  area: string | null; // "North" | "South"
  survey_leg: number | null;
  pilot: CrewSlot;
  navigator: CrewSlot;
  observer1: CrewSlot;
  observer2: CrewSlot;
  air_charter_co: string | null;
  aircraft: string | null;
  temperature: number | null;
  light: string | null; // "flat" | "bright"
  cloud_pct: number | null;
  notes: string | null;
}

/** Session-level fields edited on the metadata screen. Recruitment and
 *  management years are COMPUTED (previous June rule) — never stored/typed. */
export interface SessionInfo {
  id: number;
  started_at: string;
  ended_at: string | null;
  snow_avg_cm: number | null;
  snow_last_amt_cm: number | null;
  snow_hrs_since: number | null;
  air_charter_co: string | null;
  aircraft: string | null;
  pilot: string | null;
  pilot_rating: string | null;
  condition_photos: number | null;
}

export function emptyDraft(): SightingDraft {
  return {
    species: null,
    total: "",
    classes: { bulls: "", cows: "", yearlings: "", calves: "" },
    photographed: false,
    circled: false,
    recheck: false,
    duplicate: false,
    captive: false,
    collared: false,
    notDup: false,
    notes: "",
  };
}

export function draftFromWaypoint(w: WaypointRecord): SightingDraft {
  const s = (v: number | null) => (v == null ? "" : String(v));
  return {
    species: w.species,
    total: String(w.total ?? 0),
    classes: { bulls: s(w.bulls), cows: s(w.cows), yearlings: s(w.yearlings), calves: s(w.calves) },
    photographed: !!w.photographed,
    circled: !!w.circled,
    recheck: !!w.recheck,
    duplicate: !!w.duplicate,
    captive: !!w.captive,
    collared: !!w.collared,
    notDup: !!w.not_dup,
    notes: w.notes ?? "",
  };
}
