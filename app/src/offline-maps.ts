// Offline basemaps for the MapLibre build. Two raster styles (satellite
// imagery + a road map, both from Esri's free tile services — no API key,
// attribution carried in the style) are defined here in code and written to
// the app's Documents folder on first launch, along with the embedded label
// font, so everything the map needs survives airplane mode. Tile packs for
// the survey area are downloaded once on Wi-Fi (SETUP screen) through
// MapLibre's OfflineManager into its offline database; the map then serves
// tiles from that database with no network at all.
//
// The style files exist because pack creation requires a style URL — the
// runtime map could take inline JSON, but pointing both at the same written
// file keeps one source of truth and guarantees identical tile URLs (the
// offline database is keyed by tile URL, so they must match exactly).
import { Directory, File, Paths } from "expo-file-system";
import { OfflineManager } from "@maplibre/maplibre-react-native";
import transectsJson from "./transects.json";
import { OPEN_SANS_SEMIBOLD_0_255_B64 } from "./font-pbf";
import type { MapType } from "./types";

export const MAP_TYPES: MapType[] = ["satellite", "roads"];

interface MapDef {
  label: string;
  minZoom: number;
  maxZoom: number;
  tiles: string;
  attribution: string;
  /** rough download size for the survey area, shown before downloading */
  estSize: string;
}

const esriTiles = (service: string) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/${service}/MapServer/tile/{z}/{y}/{x}`;

export const MAP_DEFS: Record<MapType, MapDef> = {
  satellite: {
    label: "Satellite imagery",
    minZoom: 11,
    maxZoom: 16,
    tiles: esriTiles("World_Imagery"),
    attribution: "Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    estSize: "~170 MB",
  },
  roads: {
    label: "Road map",
    minZoom: 11,
    maxZoom: 15,
    tiles: esriTiles("World_Street_Map"),
    attribution: "Esri, HERE, Garmin, USGS, NPS",
    estSize: "~40 MB",
  },
};

const FONT_NAME = "Open Sans Semibold"; // must match LABEL_FONT in LibreMap.tsx

let cachedStyleUrls: Record<MapType, string> | null = null;

/**
 * Write the style JSONs and the label font into Documents/map-assets (once),
 * returning file:// URLs usable as map styles. Idempotent and cached in
 * memory; safe to call on every launch.
 */
export async function ensureMapAssets(): Promise<Record<MapType, string>> {
  if (cachedStyleUrls) return cachedStyleUrls;
  const dir = new Directory(Paths.document, "map-assets");
  if (!dir.exists) dir.create({ intermediates: true });

  const fontDir = new Directory(dir, "fonts", FONT_NAME);
  if (!fontDir.exists) fontDir.create({ intermediates: true });
  const fontFile = new File(fontDir, "0-255.pbf");
  if (!fontFile.exists) fontFile.write(OPEN_SANS_SEMIBOLD_0_255_B64, { encoding: "base64" });

  // {fontstack}/{range} are MapLibre's glyph URL template tokens
  const glyphsUrl = `${dir.uri}/fonts/{fontstack}/{range}.pbf`;

  const urls = {} as Record<MapType, string>;
  for (const t of MAP_TYPES) {
    const def = MAP_DEFS[t];
    const file = new File(dir, `style-${t}.json`);
    if (!file.exists) {
      file.write(
        JSON.stringify({
          version: 8,
          name: `airsurvey-${t}`,
          glyphs: glyphsUrl,
          sources: {
            basemap: {
              type: "raster",
              tiles: [def.tiles],
              tileSize: 256,
              attribution: def.attribution,
            },
          },
          layers: [
            // dark base behind the raster so edges/voids never flash white
            { id: "bg", type: "background", paint: { "background-color": "#0d1014" } },
            { id: "basemap", type: "raster", source: "basemap" },
          ],
        })
      );
    }
    urls[t] = file.uri;
  }
  cachedStyleUrls = urls;
  return urls;
}

/** Survey-area bounds [west, south, east, north] from the flight lines + margin. */
export function surveyBounds(): [number, number, number, number] {
  const transects = (transectsJson as unknown as { transects: { coords: [number, number][] }[] }).transects;
  const lats = transects.flatMap((t) => t.coords.map((c) => c[0]));
  const lons = transects.flatMap((t) => t.coords.map((c) => c[1]));
  const pad = 0.025; // ~2 km margin around the flight lines
  return [
    Math.min(...lons) - pad,
    Math.min(...lats) - pad,
    Math.max(...lons) + pad,
    Math.max(...lats) + pad,
  ];
}

export interface MapPackInfo {
  id: string;
  type: MapType;
  state: "inactive" | "active" | "complete";
  /** 0–100 while downloading */
  percentage: number;
}

/** Existing offline packs, tagged with which map type they belong to. */
export async function listMapPacks(): Promise<MapPackInfo[]> {
  const packs = await OfflineManager.getPacks();
  return packs.map((p) => {
    const kind = p.metadata?.kind;
    return {
      id: p.id,
      type: (MAP_TYPES as string[]).includes(kind as string) ? (kind as MapType) : "satellite",
      state: "complete", // packs are only listed after their region exists; live % comes from status()
      percentage: 100,
    };
  });
}

/**
 * Download the tile pack for a map type over the survey area. onProgress
 * fires with 0–100. Errors surface through onError (download continues in
 * the background once created; re-call to re-attach a listener).
 */
export async function downloadMapPack(
  type: MapType,
  onProgress: (percentage: number) => void,
  onError: (message: string) => void,
): Promise<void> {
  const urls = await ensureMapAssets();
  const def = MAP_DEFS[type];
  const existing = await listMapPacks();
  if (existing.some((p) => p.type === type)) {
    throw new Error(`${def.label} is already downloaded`);
  }
  await OfflineManager.createPack(
    {
      mapStyle: urls[type],
      bounds: surveyBounds(),
      minZoom: def.minZoom,
      maxZoom: def.maxZoom,
      metadata: { kind: type },
    },
    (_pack, status) => onProgress(status.percentage),
    (_pack, error) => onError(error.message),
  );
}

export async function deleteMapPack(id: string): Promise<void> {
  await OfflineManager.deletePack(id);
}
