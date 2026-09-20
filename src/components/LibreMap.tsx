// Full MapLibre map for the development-build APK (MapLibre cannot run
// inside Expo Go — this module is only required outside it). Style URL is a
// placeholder until the offline imagery pack (MBTiles) is built.
import React from "react";
import { StyleSheet } from "react-native";
import { COLORS } from "../theme";
import type { GpsFix, TrackPoint, WaypointRecord } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapLibreGL = require("@maplibre/maplibre-react-native") as any;

const STYLE_URL = "https://demotiles.maplibre.org/style.json"; // placeholder — offline pack replaces this

interface Props {
  fix: GpsFix | null;
  track: TrackPoint[];
  waypoints: WaypointRecord[];
  transects: { name: string; coords: [number, number][] }[];
}

export default function LibreMap({ fix, track, waypoints, transects }: Props) {
  const lineString = (coords: { latitude: number; longitude: number }[]) => ({
    type: "Feature",
    geometry: { type: "LineString", coordinates: coords.map((c) => [c.longitude, c.latitude]) },
  });

  // split the track into same-colour runs with shared boundary points
  const segments: { leg: boolean; coords: { latitude: number; longitude: number }[] }[] = [];
  for (let i = 0; i < track.length; i++) {
    const p = track[i];
    const last = segments[segments.length - 1];
    if (!last || last.leg !== p.leg) {
      if (last) last.coords.push(p);
      segments.push({ leg: p.leg, coords: i > 0 ? [track[i - 1], p] : [p] });
    } else last.coords.push(p);
  }

  const transectFeatures = transects.map((t) =>
    lineString(t.coords.map(([lat, lon]) => ({ latitude: lat, longitude: lon })))
  );

  return (
    <MapLibreGL.MapView style={StyleSheet.absoluteFill} styleURL={STYLE_URL} compassEnabled>
      <MapLibreGL.Camera
        centerCoordinate={fix ? [fix.longitude, fix.latitude] : [-112.87, 53.6]}
        zoomLevel={11}
        animationDuration={500}
      />
      <MapLibreGL.UserLocation showsUserHeadingIndicator />
      {transectFeatures.map((f, i) => (
        <MapLibreGL.ShapeSource key={`tr-${i}`} id={`tr-src-${i}`} shape={f}>
          <MapLibreGL.LineLayer id={`tr-line-${i}`} style={{ lineColor: "#4da3ff", lineWidth: 1.5, lineOpacity: 0.8 }} />
        </MapLibreGL.ShapeSource>
      ))}
      {segments.map((s, i) => (
        <MapLibreGL.ShapeSource key={`seg-${i}`} id={`seg-src-${i}`} shape={lineString(s.coords)}>
          <MapLibreGL.LineLayer
            id={`seg-line-${i}`}
            style={{ lineColor: s.leg ? COLORS.ok : COLORS.bad, lineWidth: 4 }}
          />
        </MapLibreGL.ShapeSource>
      ))}
      {waypoints.length > 0 && (
        <MapLibreGL.ShapeSource
          id="wp-src"
          shape={{
            type: "FeatureCollection",
            features: waypoints.map((w) => ({
              type: "Feature",
              geometry: { type: "Point", coordinates: [w.longitude, w.latitude] },
              properties: { number: w.number, species: w.species, total: w.total },
            })),
          }}
          onPress={(e: { features: { properties: { number: number; species: string; total: number } }[] }) => {
            const f = e.features?.[0];
            if (f) console.log(`WP #${f.properties.number} ${f.properties.species} ×${f.properties.total}`);
          }}
        >
          <MapLibreGL.CircleLayer
            id="wp-circle"
            style={{ circleRadius: 6, circleColor: "#ffd54a", circleStrokeColor: "#111418", circleStrokeWidth: 1 }}
          />
        </MapLibreGL.ShapeSource>
      )}
    </MapLibreGL.MapView>
  );
}
