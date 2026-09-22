// Schematic map for Expo Go (no native map library available there): flight
// lines, coloured tracklog, waypoint pins and heading arrow on a dark canvas,
// with pinch-zoom, pan, zoom buttons, and North-up / Heading-up orientation
// (heading-up is the default — the map rotates to match the view from the
// aircraft). Imagery arrives with the MapLibre dev build — see LibreMap.tsx.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Polygon, Polyline as SvgPolyline, Rect, Text as SvgText } from "react-native-svg";
import MapControls, { type Orientation } from "./MapControls";
import { COLORS } from "../theme";
import { kForFiveLines, numberedTransects } from "../transects";
import type { GpsFix, SpeciesDef, TrackPoint, WaypointRecord } from "../types";

interface Props {
  fix: GpsFix | null;
  track: TrackPoint[];
  waypoints: WaypointRecord[];
  transects: { name: string; coords: [number, number][] }[];
  species: SpeciesDef[];
  onWaypointPress?: (w: WaypointRecord) => void;
}

interface Viewport {
  cLat: number;
  cLon: number;
  k: number; // pixels per degree of latitude (longitude scaled by cos)
}

const ZOOM_STEP = 1.6;

/** rotate a screen vector by a degrees (SVG convention, y-down) */
const rot = (x: number, y: number, aDeg: number) => {
  const a = (aDeg * Math.PI) / 180;
  return { x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) };
};

export default function SvgMap({ fix, track, waypoints, transects, species, onWaypointPress }: Props) {
  const [labelsOn, setLabelsOn] = useState(true);
  const codeOf = (key: string) => species.find((s) => s.key === key)?.code ?? (key[0] ?? "?").toUpperCase();
  const W = Dimensions.get("window").width;
  const H = Dimensions.get("window").height;

  const [orientation, setOrientation] = useState<Orientation>("heading");
  // smoothed heading so the rotated map doesn't twitch on every GPS jitter
  const [headingSm, setHeadingSm] = useState(0);

  // initial view: fit everything (before moving, the park; after, the movement)
  const [view, setView] = useState<Viewport>(() => {
    const moving = track.length >= 2;
    const lats = [
      ...(moving ? [] : transects.flatMap((t) => t.coords.map((c) => c[0]))),
      ...track.map((p) => p.latitude),
      ...waypoints.map((w) => w.latitude),
      ...(fix ? [fix.latitude] : []),
    ];
    const lons = [
      ...(moving ? [] : transects.flatMap((t) => t.coords.map((c) => c[1]))),
      ...track.map((p) => p.longitude),
      ...waypoints.map((w) => w.longitude),
      ...(fix ? [fix.longitude] : []),
    ];
    if (!lats.length) return { cLat: 53.6, cLon: -112.87, k: 3000 };
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const padLat = (maxLat - minLat) * 0.08 + 0.002;
    const padLon = (maxLon - minLon) * 0.08 + 0.002;
    minLat -= padLat; maxLat += padLat; minLon -= padLon; maxLon += padLon;
    const cosLat = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    const k = Math.min(H / (maxLat - minLat), W / ((maxLon - minLon) * cosLat));
    return { cLat: (minLat + maxLat) / 2, cLon: (minLon + maxLon) / 2, k };
  });

  const viewRef = useRef(view);
  viewRef.current = view;
  const kBoundsRef = useRef({ min: view.k * 0.3, max: view.k * 40 });

  // smooth toward the live heading (shortest angular path, 25% per fix)
  useEffect(() => {
    if (fix?.heading == null) return;
    setHeadingSm((prev) => {
      let d = fix.heading! - prev;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      return prev + d * 0.25;
    });
  }, [fix?.heading]);

  const hd = orientation === "heading" ? ((headingSm % 360) + 360) % 360 : 0;
  const hdRef = useRef(hd);
  hdRef.current = hd;

  const cosLat = Math.cos((view.cLat * Math.PI) / 180);
  const xOf = (lon: number) => W / 2 + (lon - view.cLon) * view.k * cosLat;
  const yOf = (lat: number) => H / 2 - (lat - view.cLat) * view.k;

  const clampK = (k: number) => Math.min(kBoundsRef.current.max, Math.max(kBoundsRef.current.min, k));
  /** Re-centre on the current position, keeping the user's zoom level. */
  const recenter = () => {
    if (!fix) return;
    setView((v) => ({ ...v, cLat: fix.latitude, cLon: fix.longitude }));
  };
  /** Change zoom keeping the world point under (mx,my) fixed on screen (rotation-aware). */
  const zoomAt = (mx: number, my: number, newK: number) => {
    const v = viewRef.current;
    const o = rot(mx - W / 2, my - H / 2, hdRef.current);
    const cosW = Math.cos((v.cLat * Math.PI) / 180);
    const lat = v.cLat - o.y / v.k;
    const lon = v.cLon + o.x / (v.k * cosW);
    const nk = clampK(newK);
    const cosNew = Math.cos((lat * Math.PI) / 180);
    setView({ cLat: lat + o.y / nk, cLon: lon - o.x / (nk * cosNew), k: nk });
  };

  const grabRef = useRef({ touches: 0, pinchDist: 0, startK: view.k, cx: 0, cy: 0 });
  const tapRef = useRef({ t0: 0, x: 0, y: 0, moved: false });
  const dist = (t: { pageX: number; pageY: number }[]) =>
    t.length >= 2 ? Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY) : 0;
  const centroid = (t: { pageX: number; pageY: number }[]) =>
    t.length
      ? { x: t.reduce((s, p) => s + p.pageX, 0) / t.length, y: t.reduce((s, p) => s + p.pageY, 0) / t.length }
      : { x: W / 2, y: H / 2 };

  /** Waypoint under a screen tap — generous target: 44 px around the pin,
   *  plus the label area (even inflated); nearest candidate wins. */
  const waypointAt = (px: number, py: number): WaypointRecord | null => {
    let best: WaypointRecord | null = null;
    let bestScore = Infinity;
    for (const w of waypoints) {
      const off = rot(xOf(w.longitude) - W / 2, yOf(w.latitude) - H / 2, -hdRef.current);
      const sx = W / 2 + off.x;
      const sy = H / 2 + off.y;
      const d = Math.hypot(px - sx, py - sy);
      const bw = `${w.number}-${codeOf(w.species)}${w.total}`.length * 12.9 + 10;
      const inLabel = labelsOn && px > sx - 10 && px < sx + 16 + bw && py > sy - 27 && py < sy + 20;
      const hit = d < 44 || inLabel;
      const score = inLabel ? Math.min(d, 20) : d;
      if (hit && score < bestScore) {
        best = w;
        bestScore = score;
      }
    }
    return best;
  };

  // the PanResponder is created once, so its handlers must reach current
  // state through refs — calling these directly would use first-render
  // positions after any pan/zoom (the classic stale-closure trap)
  const waypointAtRef = useRef(waypointAt);
  waypointAtRef.current = waypointAt;
  const onPressRef = useRef(onWaypointPress);
  onPressRef.current = onWaypointPress;

  // pan + pinch + tap (deltas pass through the same rotation as the content)
  const gesture = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        const c = centroid(t);
        grabRef.current = { touches: t.length, pinchDist: dist(t), startK: viewRef.current.k, cx: c.x, cy: c.y };
        tapRef.current = { t0: Date.now(), x: c.x, y: c.y, moved: false };
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length !== grabRef.current.touches) {
          const c = centroid(t);
          grabRef.current = { touches: t.length, pinchDist: dist(t), startK: viewRef.current.k, cx: c.x, cy: c.y };
          if (t.length > 1) tapRef.current.moved = true; // pinch is not a tap
          return;
        }
        if (t.length >= 2) {
          const factor = grabRef.current.pinchDist > 0 ? dist(t) / grabRef.current.pinchDist : 1;
          const c = centroid(t);
          zoomAt(c.x, c.y, grabRef.current.startK * factor);
        } else if (t.length === 1) {
          const c = centroid(t);
          const dx = c.x - grabRef.current.cx;
          const dy = c.y - grabRef.current.cy;
          // generous slop: a bouncing finger still lands a tap
          if (Math.hypot(c.x - tapRef.current.x, c.y - tapRef.current.y) > 25) tapRef.current.moved = true;
          grabRef.current.cx = c.x;
          grabRef.current.cy = c.y;
          const r = rot(dx, dy, hdRef.current);
          const v = viewRef.current;
          const cos = Math.cos((v.cLat * Math.PI) / 180);
          setView({ ...v, cLat: v.cLat + r.y / v.k, cLon: v.cLon - r.x / (v.k * cos) });
        }
      },
      onPanResponderRelease: (e) => {
        const tap = e.nativeEvent.changedTouches[0];
        if (__DEV__ && tap) {
          const hitNow = waypointAtRef.current(tap.pageX, tap.pageY);
          console.log(
            `[tap] moved=${tapRef.current.moved} touches=${grabRef.current.touches} dt=${Date.now() - tapRef.current.t0} ` +
              `x=${tap.pageX.toFixed(0)} y=${tap.pageY.toFixed(0)} hit=${hitNow ? `#${hitNow.number}` : "miss"}`
          );
        }
        if (
          !tapRef.current.moved &&
          grabRef.current.touches <= 1 &&
          Date.now() - tapRef.current.t0 < 1000 &&
          tap
        ) {
          const hit = waypointAtRef.current(tap.pageX, tap.pageY);
          if (hit) onPressRef.current?.(hit);
        }
        grabRef.current.touches = 0;
      },
    })
  ).current;

  // track split into coloured runs (shared boundary point keeps the line continuous)
  const segments = useMemo(() => {
    const segs: { leg: boolean; points: string[] }[] = [];
    let last: { leg: boolean; pts: string[] } | null = null;
    const px = (p: { latitude: number; longitude: number }) => `${xOf(p.longitude)},${yOf(p.latitude)}`;
    for (let i = 0; i < track.length; i++) {
      const p = track[i];
      if (!last || last.leg !== p.leg) {
        if (last) segs.push({ leg: last.leg, points: last.pts });
        last = { leg: p.leg, pts: [i > 0 ? px(track[i - 1]) : null, px(p)].filter(Boolean) as string[] };
      } else {
        last.pts.push(px(p));
      }
    }
    if (last && last.pts.length) segs.push({ leg: last.leg, points: last.pts });
    return segs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, view]);

  // in heading-up the map rotates, so the aircraft marker always points up;
  // in north-up the marker itself rotates with heading
  const arrow = useMemo(() => {
    if (!fix) return null;
    const cx = xOf(fix.longitude);
    const cy = yOf(fix.latitude);
    const aDeg = orientation === "heading" ? 0 : (((fix.heading ?? 0) - 90) * Math.PI) / 180;
    const a = orientation === "heading" ? -Math.PI / 2 : aDeg;
    const tip = [cx + 16 * Math.cos(a), cy + 16 * Math.sin(a)];
    const bl = [cx + 12 * Math.cos(a + 2.5), cy + 12 * Math.sin(a + 2.5)];
    const br = [cx + 12 * Math.cos(a - 2.5), cy + 12 * Math.sin(a - 2.5)];
    return `${tip[0]},${tip[1]} ${bl[0]},${bl[1]} ${cx},${cy} ${br[0]},${br[1]}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fix, view, orientation]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={StyleSheet.absoluteFill} {...gesture.panHandlers}>
        <Svg width={W} height={H} style={styles.svg} pointerEvents="none">
          <G transform={`rotate(${-hd}, ${W / 2}, ${H / 2})`}>
            {numberedTransects(transects).map((t) => {
              const mid = t.coords[Math.floor(t.coords.length / 2)];
              const mx = xOf(mid[1]);
              const my = yOf(mid[0]);
              return (
                <React.Fragment key={t.name}>
                  <SvgPolyline
                    points={t.coords.map(([lat, lon]) => `${xOf(lon)},${yOf(lat)}`).join(" ")}
                    stroke="#4da3ff"
                    strokeWidth={1}
                    fill="none"
                    opacity={0.7}
                  />
                  <G transform={`rotate(${hd}, ${mx}, ${my})`}>
                    <SvgText x={mx} y={my - 4} fill="#9fd0ff" fontSize={13} fontWeight="bold" textAnchor="middle">
                      {`#${t.number}`}
                    </SvgText>
                  </G>
                </React.Fragment>
              );
            })}
            {segments.map((s, i) => (
              <SvgPolyline key={`seg-${i}`} points={s.points.join(" ")} stroke={s.leg ? COLORS.ok : COLORS.bad} strokeWidth={3} fill="none" />
            ))}
            {waypoints.map((w) => {
              const x = xOf(w.longitude);
              const y = yOf(w.latitude);
              const label = `${w.number}-${codeOf(w.species)}${w.total}`;
              const bw = label.length * 12.9 + 10;
              return (
                <React.Fragment key={`${w.number}-${w.id}`}>
                  <Circle cx={x} cy={y} r={6} fill={w.number >= 9001 ? "#8a94a3" : "#ffd54a"} />
                  {labelsOn && (
                    <G transform={`rotate(${hd}, ${x}, ${y})`}>
                      <Rect x={x + 10} y={y - 15} width={bw} height={24} rx={4} fill="rgba(17,20,24,0.75)" />
                      <SvgText x={x + 15} y={y + 6} fill={COLORS.text} fontSize={18} fontWeight="bold">
                        {label}
                      </SvgText>
                    </G>
                  )}
                </React.Fragment>
              );
            })}
            {fix && <Circle cx={xOf(fix.longitude)} cy={yOf(fix.latitude)} r={22} stroke={COLORS.ok} strokeWidth={1} fill="none" opacity={0.4} />}
            {arrow && <Polygon points={arrow} fill={COLORS.ok} />}
          </G>
        </Svg>
      </View>

      <MapControls
        labelsOn={labelsOn}
        onToggleLabels={() => setLabelsOn((v) => !v)}
        onZoomIn={() => zoomAt(W / 2, H / 2, viewRef.current.k * ZOOM_STEP)}
        onZoomOut={() => zoomAt(W / 2, H / 2, viewRef.current.k / ZOOM_STEP)}
        orientation={orientation}
        onOrient={(o, isDouble) => {
          setOrientation(o);
          recenter();
          if (isDouble) zoomAt(W / 2, H / 2, kForFiveLines(transects));
        }}
      />

      <View style={styles.banner} pointerEvents="none">
        <Text style={styles.bannerText}>schematic view — imagery arrives with the map build</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { backgroundColor: "#0d1014" },
  banner: { position: "absolute", bottom: 8, alignSelf: "center", backgroundColor: "rgba(17,20,24,0.7)", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3 },
  bannerText: { color: COLORS.muted, fontSize: 11 },
});
