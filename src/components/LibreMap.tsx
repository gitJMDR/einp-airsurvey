// Full MapLibre map for the development-build APK (MapLibre cannot run
// inside Expo Go — this module is only required outside it). Style URL is a
// placeholder until the offline imagery pack (MBTiles) is built.
//
// Written against @maplibre/maplibre-react-native v11's API: named exports
// (Map/Camera/GeoJSONSource/Layer), `mapStyle`/`data` props, and style-spec
// layers with `type` + kebab-case `paint`. The v10-era `MapLibreGL.*` names
// don't exist in v11 — rendering them was the launch crash of build 2e0f1071.
//
// Camera discipline (same lesson as SvgMap's gestures): the initial view is
// frozen once and all later movement is imperative through cameraRef — a
// live `center` prop would re-apply a stop on every GPS fix and fight the
// user's finger. Heading-up mode uses trackUserLocation="course" (rotate to
// direction of travel, matching the schematic's GPS-heading behaviour — the
// device compass would be useless in a helicopter anyway).
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  type CameraRef,
  type InitialViewState,
  type LngLatBounds,
} from "@maplibre/maplibre-react-native";
import MapControls, { type Orientation } from "./MapControls";
import { COLORS } from "../theme";
import type { GpsFix, MapType, SpeciesDef, TrackPoint, WaypointRecord } from "../types";

// Fallback while offline-maps.ts writes the on-device styles (first moments
// after launch); the offline styles carry the same font name.
const FALLBACK_STYLE_URL = "https://demotiles.maplibre.org/style.json";
const LABEL_FONT = "Open Sans Semibold";
const ZOOM_STEP = 1;
const PARK_CENTER: [number, number] = [-112.87, 53.6];

interface Props {
  fix: GpsFix | null;
  track: TrackPoint[];
  waypoints: WaypointRecord[];
  transects: { name: string; coords: [number, number][] }[];
  species: SpeciesDef[];
  onWaypointPress?: (w: WaypointRecord) => void;
  mapStyleUrl?: string | null;
  mapType?: MapType;
  onToggleMapType?: () => void;
}

export default function LibreMap({
  fix,
  track,
  waypoints,
  transects,
  species,
  onWaypointPress,
  mapStyleUrl,
  mapType,
  onToggleMapType,
}: Props) {
  const codeOf = (key: string) => species.find((s) => s.key === key)?.code ?? (key[0] ?? "?").toUpperCase();

  const [labelsOn, setLabelsOn] = useState(true);
  const [orientation, setOrientation] = useState<Orientation>("heading");
  const cameraRef = useRef<CameraRef>(null);
  // live viewport, kept for the zoom buttons (zoom is relative to "now").
  // Seeded with the initial zoom; refreshed by every camera change.
  const viewRef = useRef<{ zoom: number; center?: [number, number] }>({ zoom: 11 });

  // initial view, computed once: centred on the aircraft if there is a fix,
  // otherwise fitted to the flight lines so the park opens visible.
  const [initialView] = useState<InitialViewState>((): InitialViewState => {
    if (fix) return { center: [fix.longitude, fix.latitude], zoom: 12 };
    const lats = transects.flatMap((t) => t.coords.map((c) => c[0]));
    const lons = transects.flatMap((t) => t.coords.map((c) => c[1]));
    if (!lats.length) return { center: PARK_CENTER, zoom: 10 };
    return {
      // flat [west, south, east, north] per GeoJSON RFC
      bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] as LngLatBounds,
    };
  });

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

  /** North-up: drop course-follow and rotate level; re-centre like the schematic. */
  const orient = (o: Orientation) => {
    setOrientation(o);
    if (o === "north") {
      const center: [number, number] = fix ? [fix.longitude, fix.latitude] : viewRef.current.center ?? PARK_CENTER;
      cameraRef.current?.easeTo({ center, bearing: 0, duration: 400 });
    }
    // heading-up needs no imperative call: trackUserLocation="course" follows
    // and re-centres on the next GPS update.
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        mapStyle={mapStyleUrl ?? FALLBACK_STYLE_URL}
        compass={false} // our N↑/H↑ buttons own orientation; the built-in ornament would sit under the HUD
        style={StyleSheet.absoluteFill}
        onRegionDidChange={(e) => {
          const { zoom, center } = e.nativeEvent;
          viewRef.current = { zoom, center };
        }}
      >
      <Camera
        ref={cameraRef}
        initialViewState={initialView}
        trackUserLocation={orientation === "heading" ? "course" : undefined}
      />
      <UserLocation accuracy heading />
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
              properties: {
                number: w.number,
                // grey for audio-only missed observations (9001+), yellow otherwise
                pinColor: w.number >= 9001 ? "#8a94a3" : "#ffd54a",
                label: `${w.number}-${codeOf(w.species)}${w.total}`,
              },
            })),
          }}
          onPress={(e) => {
            const p = e.nativeEvent.features?.[0]?.properties as { number?: number | string } | null | undefined;
            if (p == null || !onWaypointPress) return;
            const w = waypoints.find((x) => x.number === Number(p.number));
            if (w) onWaypointPress(w);
          }}
        >
          <Layer
            id="wp-circle"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": ["get", "pinColor"],
              "circle-stroke-color": "#111418",
              "circle-stroke-width": 1,
            }}
          />
          {labelsOn && (
            <Layer
              id="wp-label"
              type="symbol"
              layout={{
                "text-field": ["get", "label"],
                "text-font": [LABEL_FONT],
                "text-size": 14,
                "text-offset": [1.1, 0],
                "text-anchor": "left",
                "text-padding": 2,
              }}
              paint={{
                "text-color": COLORS.text,
                "text-halo-color": "rgba(17,20,24,0.85)",
                "text-halo-width": 1.5,
              }}
            />
          )}
        </GeoJSONSource>
      )}
      </Map>
      <MapControls
        labelsOn={labelsOn}
        onToggleLabels={() => setLabelsOn((v) => !v)}
        onZoomIn={() => cameraRef.current?.zoomTo(viewRef.current.zoom + ZOOM_STEP, { duration: 200 })}
        onZoomOut={() => cameraRef.current?.zoomTo(viewRef.current.zoom - ZOOM_STEP, { duration: 200 })}
        orientation={orientation}
        onOrient={orient}
        mapType={mapType}
        onToggleMapType={onToggleMapType}
      />
    </View>
  );
}
