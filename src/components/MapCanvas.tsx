// The map, mode-switched: a schematic SVG view inside Expo Go (no native
// map library available there), the full MapLibre map in development and
// production builds. Same data feeds both.
import Constants from "expo-constants";
import React from "react";
import SvgMap from "./SvgMap";
import type { GpsFix, SpeciesDef, TrackPoint, WaypointRecord } from "../types";

const IN_EXPO_GO = Constants.appOwnership === "expo";

// LibreMap requires @maplibre/maplibre-react-native's native side — only
// load it outside Expo Go, where the dev build includes it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires
const LibreMap = IN_EXPO_GO ? null : (require("./LibreMap") as any).default;

interface Props {
  fix: GpsFix | null;
  track: TrackPoint[];
  waypoints: WaypointRecord[];
  transects: { name: string; coords: [number, number][] }[];
  species: SpeciesDef[];
  onWaypointPress?: (w: WaypointRecord) => void;
}

export default function MapCanvas(props: Props) {
  if (LibreMap) return <LibreMap {...props} />;
  return <SvgMap {...props} />;
}
