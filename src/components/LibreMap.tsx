// Full MapLibre map for the development-build APK (MapLibre cannot run
// inside Expo Go — this module is only required outside it). Style URL is a
// placeholder until the offline imagery pack (MBTiles) is built.
//
// Written against @maplibre/maplibre-react-native v11's API: named exports
// (Map/Camera/GeoJSONSource/Layer), `mapStyle`/`data`/`center` props, and
// style-spec layers with `type` + kebab-case `paint`. The v10-era
// `MapLibreGL.MapView`/`ShapeSource`/`LineLayer` names don't exist in v11 —
// rendering them was the launch crash of build 2e0f1071 (undefined element
// types). Keep this file aligned with the installed major version.
import React from "react";
import { StyleSheet } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
} from "@maplibre/maplibre-react-native";
import { COLORS } from "../theme";
import type { GpsFix, TrackPoint, WaypointRecord } from "../types";

const STYLE_URL = "https://demotiles.maplibre.org/style.json"; // placeholder — offline pack replaces this

interface Props {
  fix: GpsFix | null;
  track: TrackPoint[];
  waypoints: WaypointRecord[];
  transects: { name: string; coords: [number, number][] }[];
}

export default function LibreMap({ fix, track, waypoints, transects }: Props) {
  const lineString = (coords: { latitude: number; longitude: number }[]) => ({
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: coords.map((c): [number, number] => [c.longitude, c.latitude]),
    },
    properties: null,
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
    <Map mapStyle={STYLE_URL} compass style={StyleSheet.absoluteFill}>
      <Camera
        center={fix ? [fix.longitude, fix.latitude] : [-112.87, 53.6]}
        zoom={11}
        duration={500}
      />
      <UserLocation heading />
      {transectFeatures.map((f, i) => (
        <GeoJSONSource key={`tr-${i}`} id={`tr-src-${i}`} data={f}>
          <Layer
            id={`tr-line-${i}`}
            type="line"
            paint={{ "line-color": "#4da3ff", "line-width": 1.5, "line-opacity": 0.8 }}
          />
        </GeoJSONSource>
      ))}
      {segments.map((s, i) => (
        <GeoJSONSource key={`seg-${i}`} id={`seg-src-${i}`} data={lineString(s.coords)}>
          <Layer
            id={`seg-line-${i}`}
            type="line"
            paint={{ "line-color": s.leg ? COLORS.ok : COLORS.bad, "line-width": 4 }}
          />
        </GeoJSONSource>
      ))}
      {waypoints.length > 0 && (
        <GeoJSONSource
          id="wp-src"
          data={{
            type: "FeatureCollection" as const,
            features: waypoints.map((w) => ({
              type: "Feature" as const,
              geometry: {
                type: "Point" as const,
                coordinates: [w.longitude, w.latitude] as [number, number],
              },
              properties: { number: w.number, species: w.species, total: w.total },
            })),
          }}
          onPress={(e) => {
            const f = e.nativeEvent.features?.[0];
            const p = f?.properties;
            if (p) console.log(`WP #${p.number} ${p.species} ×${p.total}`);
          }}
        >
          <Layer
            id="wp-circle"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": "#ffd54a",
              "circle-stroke-color": "#111418",
              "circle-stroke-width": 1,
            }}
          />
        </GeoJSONSource>
      )}
    </Map>
  );
}
