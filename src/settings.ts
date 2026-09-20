// App settings, persisted as JSON in the setting table. Targets are stored
// in km/h and metres regardless of display units, so switching units never
// silently changes a target's meaning.
import { loadSettingsJson, saveSettingsJson } from "./db";
import type { AppSettings, SpeciesDef, Targets, UnitsMode } from "./types";

export const DEFAULT_SPECIES: SpeciesDef[] = [
  { key: "bison", label: "Bison", code: "B" },
  { key: "elk", label: "Elk", code: "E" },
  { key: "moose", label: "Moose", code: "M" },
  { key: "deer", label: "Deer", code: "D" },
  { key: "coyote", label: "Coyote", code: "C" },
  { key: "dead", label: "Dead", code: "X" },
];

export const DEFAULT_TARGETS: Targets = { speedKmh: 110, speedTolKmh: 30, altM: 150, altTolM: 45 };

export const DEFAULT_SETTINGS: AppSettings = {
  species: DEFAULT_SPECIES,
  units: "metric",
  targets: DEFAULT_TARGETS,
};

const KEY = "app-settings";

export function loadAppSettings(): AppSettings {
  const raw = loadSettingsJson(KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      species: Array.isArray(parsed.species) && parsed.species.length ? parsed.species : DEFAULT_SPECIES,
      units: parsed.units === "aviation" ? "aviation" : "metric",
      targets: { ...DEFAULT_TARGETS, ...(parsed.targets ?? {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(s: AppSettings): void {
  saveSettingsJson(KEY, JSON.stringify(s));
}

// ----- unit conversion helpers (display only) -----

export function speedLabel(units: UnitsMode): string {
  return units === "aviation" ? "kt" : "km/h";
}
export function altLabel(units: UnitsMode): string {
  return units === "aviation" ? "ft" : "m";
}
/** m/s -> display units */
export function displaySpeed(ms: number | null, units: UnitsMode): number | null {
  if (ms == null) return null;
  return units === "aviation" ? ms * 1.94384 : ms * 3.6;
}
/** metres -> display units */
export function displayAlt(m: number | null, units: UnitsMode): number | null {
  if (m == null) return null;
  return units === "aviation" ? m * 3.28084 : m;
}
/** stored km/h target -> display units */
export function displaySpeedTarget(kmh: number, units: UnitsMode): number {
  return units === "aviation" ? kmh / 1.852 : kmh;
}
/** stored metres target -> display units */
export function displayAltTarget(m: number, units: UnitsMode): number {
  return units === "aviation" ? m * 3.28084 : m;
}
/** display value -> stored km/h */
export function storedSpeed(display: number, units: UnitsMode): number {
  return units === "aviation" ? display * 1.852 : display;
}
/** display value -> stored metres */
export function storedAlt(display: number, units: UnitsMode): number {
  return units === "aviation" ? display / 3.28084 : display;
}
