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
import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  type CameraRef,
  type InitialViewState,
} from "@maplibre/maplibre-react-native";
import MapControls, { type Orientation } from "./MapControls";
import { COLORS } from "../theme";
import { numberedTransects, transectCentroid, zoomForFiveLines } from "../transects";
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
  // follow mode feeding Camera.trackUserLocation: "course" (H↑) or "default"
  // (N↑) keeps the arrow pinned at screen centre with the map scrolling
  // beneath it; a manual pan sets it undefined (arrow moves, map stays) until
  // the next N↑/H↑ tap re-engages. "default" follows position without
  // rotating — north stays up.
  const [tracking, setTracking] = useState<"default" | "course" | undefined>("course");
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;
  const cameraRef = useRef<CameraRef>(null);
  // default zoom: five transect lines fill the screen (flown line + two each
  // side) — also what a double-tapped N↑/H↑ resets to. Computed once.
  const defaultZoom = useMemo(() => zoomForFiveLines(transects, fix?.latitude ?? 53.6), [transects, fix?.latitude]);
  // live viewport, kept for the zoom buttons (zoom is relative to "now").
  // Seeded with the default zoom; refreshed by every camera change.
  const viewRef = useRef<{ zoom: number; center?: [number, number] }>({ zoom: defaultZoom });

  // initial view, computed once: on the aircraft if there is a fix, else the
  // middle of the transect block — always at the five-line default zoom.
  const [initialView] = useState<InitialViewState>((): InitialViewState => {
    const centroid = transectCentroid(transects);
    return {
      center: fix
        ? [fix.longitude, fix.latitude]
        : centroid
          ? [centroid.lon, centroid.lat]
          : PARK_CENTER,
      zoom: defaultZoom,
    };
  });

  const lineString = (coords: { latitude: number; longitude: number }[], props?: Record<string, unknown>) => ({
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: coords.map((c): [number, number] => [c.longitude, c.latitude]),
    },
    properties: props ?? null,
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

  // numbered north→south (#1 is northernmost) so labels survive any file order
  const numbered = numberedTransects(transects);
  const transectFeatures = numbered.map((t) =>
    lineString(t.coords.map(([lat, lon]) => ({ latitude: lat, longitude: lon })), { name: `#${t.number}` })
  );

  /** EVERY N↑/H↑ tap: set the mode, re-centre, and (re-)engage follow — the
   *  arrow pins to screen centre and the map scrolls beneath it. A double-tap
   *  also snaps the zoom back to the five-line default. Snap-back animations
   *  are kept near-instant; a smooth glide reads as lag in the cabin. */
  const orient = (o: Orientation, isDouble: boolean) => {
    setOrientation(o);
    const mode: "default" | "course" = o === "heading" ? "course" : "default";
    // drop, then re-apply: the prop needs a fresh value for the native camera
    // mode to re-engage and re-centre (a same-value prop is a no-op)
    setTracking(undefined);
    window.setTimeout(() => setTracking(mode), 60);
    if (o === "north") {
      // "default" follows position but never levels the bearing itself
      const center: [number, number] = fix ? [fix.longitude, fix.latitude] : viewRef.current.center ?? PARK_CENTER;
      cameraRef.current?.easeTo({ center, bearing: 0, duration: 150 });
    }
    if (isDouble) window.setTimeout(() => cameraRef.current?.zoomTo(defaultZoom, { duration: 150 }), 130);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Map
        mapStyle={mapStyleUrl ?? FALLBACK_STYLE_URL}
        compass={false} // our N↑/H↑ buttons own orientation; the built-in ornament would sit under the HUD
        style={StyleSheet.absoluteFill}
        onRegionDidChange={(e) => {
          const { zoom, center, userInteraction } = e.nativeEvent;
          const prev = viewRef.current.center;
          viewRef.current = { zoom, center };
          // a deliberate pan away from the followed position ends follow
          // mode — the arrow then moves while the map stays put, until N↑/H↑
          // is tapped again. (Zoom gestures and our own camera calls keep
          // the centre, so they never trip this.)
          if (userInteraction && prev != null && trackingRef.current != null) {
            const moved = Math.abs(center[0] - prev[0]) + Math.abs(center[1] - prev[1]);
            if (moved > 0.0005) setTracking(undefined);
          }
        }}
      >
      <Camera ref={cameraRef} initialViewState={initialView} trackUserLocation={tracking} />
      <UserLocation accuracy heading />
      {transectFeatures.map((f, i) => (
        <GeoJSONSource key={`tr-${i}`} id={`tr-src-${i}`} data={f}>
          <Layer
            id={`tr-line-${i}`}
            type="line"
            paint={{ "line-color": "#4da3ff", "line-width": 1.5, "line-opacity": 0.8 }}
          />
          {/* labels repeat along the line so one is always in view while
              flying it; MapLibre's collision detection drops overlapping
              ones automatically when zoomed out */}
          <Layer
            id={`tr-label-${i}`}
            type="symbol"
            layout={{
              "symbol-placement": "line",
              "symbol-spacing": 260,
              "text-field": ["get", "name"],
              "text-font": [LABEL_FONT],
              "text-size": 13,
              "text-padding": 4,
            }}
            paint={{
              "text-color": "#9fd0ff",
              "text-halo-color": "rgba(13,16,20,0.85)",
              "text-halo-width": 1.5,
            }}
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
