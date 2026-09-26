import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import transectsJson from "./src/transects.json";
import MapCanvas from "./src/components/MapCanvas";
import MarkModal from "./src/components/MarkModal";
import SettingsScreen from "./src/screens/SettingsScreen";
import MetadataScreen from "./src/screens/MetadataScreen";
import TotalsScreen from "./src/screens/TotalsScreen";
import ReviewScreen from "./src/screens/ReviewScreen";
import {
  endSession,
  getCurrentSessionId,
  getLegs,
  getOrCreateActiveSession,
  getSession,
  getTracklog,
  getWaypoints,
  initDb,
  insertLeg,
  insertTrackPoint,
  insertWaypoint,
  nextWaypointNumber,
  setCurrentSessionId,
  updateLeg,
} from "./src/db";
import { loadAppSettings, saveAppSettings, altLabel, displayAlt, displayAltTarget, displaySpeed, displaySpeedTarget, speedLabel } from "./src/settings";
import { ensureMapAssets } from "./src/offline-maps";
import { deleteWaypoint, updateWaypoint } from "./src/db";
import { draftFromWaypoint } from "./src/types";
import { COLORS } from "./src/theme";
import type { AppSettings, GpsFix, LegRecord, MapType, SessionInfo, TrackPoint, WaypointRecord } from "./src/types";

const FLIGHT_LINES = transectsJson as unknown as {
  transects: { name: string; coords: [number, number][] }[];
  helipad: [number, number] | null;
};

type Screen = "survey" | "settings" | "metadata" | "totals" | "review";

const RAIL_BUTTONS: { screen: Screen; glyph: string; label: string }[] = [
  { screen: "totals", glyph: "Σ", label: "TOTALS" },
  { screen: "review", glyph: "☰", label: "REVIEW" },
  { screen: "metadata", glyph: "▦", label: "DATA" },
  { screen: "settings", glyph: "⚙", label: "SETUP" },
];

function tolColor(value: number | null, target: number, tol: number): string {
  if (value == null) return COLORS.muted;
  const d = Math.abs(value - target);
  return d <= tol ? COLORS.ok : d <= tol * 2 ? COLORS.warn : COLORS.bad;
}

/** Which way to correct: ↑ when below the target band, ↓ when above, blank
 *  while inside tolerance (green = nothing to fix). */
function tolArrow(value: number | null, target: number, tol: number): string {
  if (value == null || Math.abs(value - target) <= tol) return "";
  return value < target ? "↑" : "↓";
}

// Leg auto-prompting: sustained speeds that suggest survey activity / rest.
const LEG_ON_SPEED_MS = 10; // ~36 km/h sustained → offer to start a leg
const LEG_ON_SUSTAIN_MS = 10_000;
const LEG_OFF_SPEED_MS = 2; // ~7 km/h sustained → offer to end the leg
const LEG_OFF_SUSTAIN_MS = 30_000;
const PROMPT_COOLDOWN_MS = 60_000;

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

function AppInner() {
  useKeepAwake();
  const insets = useSafeAreaInsets();

  const [screen, setScreen] = useState<Screen>("survey");
  const [fix, setFix] = useState<GpsFix | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [mapStyleUrls, setMapStyleUrls] = useState<Record<MapType, string> | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [waypoints, setWaypoints] = useState<WaypointRecord[]>([]);
  const [legs, setLegs] = useState<LegRecord[]>([]);
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [markOpen, setMarkOpen] = useState(false);
  const [editWp, setEditWp] = useState<WaypointRecord | null>(null);

  const sessionIdRef = useRef<number | null>(null);
  const lastTrackAtRef = useRef(0);
  const legActiveRef = useRef(false);
  const sessionClosedRef = useRef(false);
  const fastSinceRef = useRef<number | null>(null);
  const slowSinceRef = useRef<number | null>(null);
  const lastPromptRef = useRef(0);
  const promptOpenRef = useRef(false);

  const refreshWaypoints = useCallback(() => {
    if (sessionIdRef.current == null) return;
    setWaypoints(getWaypoints(sessionIdRef.current));
    setNextNumber(nextWaypointNumber(sessionIdRef.current));
  }, []);

  const bootSession = useCallback(() => {
    initDb();
    const ptr = getCurrentSessionId();
    const s = (ptr != null ? getSession(ptr) : null) ?? getOrCreateActiveSession();
    sessionIdRef.current = s.id;
    setSession(s);
    setLegs(getLegs(s.id));
    setTrack(getTracklog(s.id).map((p) => ({ latitude: p.latitude, longitude: p.longitude, leg: !!p.leg })));
    refreshWaypoints();
  }, [refreshWaypoints]);

  const refreshLegs = useCallback(() => {
    if (sessionIdRef.current != null) setLegs(getLegs(sessionIdRef.current));
  }, []);

  const startLeg = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid == null) return;
    insertLeg(sid, new Date());
    setLegs(getLegs(sid));
  }, []);

  const stopLeg = useCallback(() => {
    const sid = sessionIdRef.current;
    if (sid == null) return;
    const open = [...getLegs(sid)].reverse().find((l) => !l.ended_at);
    if (!open) return;
    updateLeg(open.id, { ...open, ended_at: new Date().toISOString() });
    setLegs(getLegs(sid));
  }, []);

  // the GPS watcher (which lives in an effect with stale-safe refs) calls these
  const legHandlersRef = useRef({ start: startLeg, stop: stopLeg });
  legHandlersRef.current = { start: startLeg, stop: stopLeg };

  // leg state → ref for the track colouring + prompts
  useEffect(() => {
    legActiveRef.current = legs.some((l) => !l.ended_at);
  }, [legs]);

  // closed surveys are read-only: no recording, no leg prompts
  useEffect(() => {
    sessionClosedRef.current = !!session?.ended_at;
  }, [session?.ended_at]);

  /** Suggest starting/stopping a leg based on sustained speed. Cooldown-guarded. */
  const maybePromptLeg = (start: boolean, now: number) => {
    if (promptOpenRef.current || sessionClosedRef.current || now - lastPromptRef.current < PROMPT_COOLDOWN_MS) return;
    promptOpenRef.current = true;
    lastPromptRef.current = now;
    if (start) fastSinceRef.current = null;
    else slowSinceRef.current = null;
    const close = () => {
      promptOpenRef.current = false;
    };
    if (start) {
      Alert.alert("Start a survey leg?", "You've been moving at survey speed. Start a leg now?", [
        { text: "Not now", style: "cancel", onPress: close },
        { text: "Start leg", onPress: () => { close(); legHandlersRef.current.start(); } },
      ]);
    } else {
      Alert.alert("Stop the survey leg?", "You've been stationary for a while. End the leg?", [
        { text: "Keep flying", style: "cancel", onPress: close },
        { text: "Stop leg", onPress: () => { close(); legHandlersRef.current.stop(); } },
      ]);
    }
  };

  // Landscape lock + bootstrap (settings, session, GPS).
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    initDb(); // tables must exist before anything reads them
    setSettings(loadAppSettings());
    bootSession();
  }, [bootSession]);

  // Write the offline map styles + label font to Documents once, then keep
  // the current style URL fed to the map (null → demotiles fallback).
  useEffect(() => {
    let alive = true;
    ensureMapAssets()
      .then((urls) => alive && setMapStyleUrls(urls))
      .catch((e) => console.warn("[maps] style asset init failed:", e));
    return () => {
      alive = false;
    };
  }, []);

  const mapType = settings?.mapType ?? "satellite";
  const toggleMapType = useCallback(() => {
    setSettings((prev) => {
      if (!prev) return prev;
      const next: AppSettings = { ...prev, mapType: prev.mapType === "satellite" ? "roads" : "satellite" };
      saveAppSettings(next);
      return next;
    });
  }, []);

  // Continuous GPS: the freshest fix is snapshotted when Mark is pressed,
  // and thinned points persist to the tracklog (~1 per 3 s).
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Location permission needed", "The app records GPS positions for every sighting.");
        return;
      }
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
        (loc) => {
          const f: GpsFix = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? null,
            altitude: loc.coords.altitude ?? null,
            speed: loc.coords.speed ?? null,
            heading: loc.coords.heading ?? null,
            timestamp: loc.timestamp,
          };
          setFix(f);
          const now = Date.now();
          const sid = sessionIdRef.current;
          if (sid != null && now - lastTrackAtRef.current > 3000) {
            lastTrackAtRef.current = now;
            const leg = legActiveRef.current;
            try {
              insertTrackPoint(sid, f, leg);
            } catch {
              // never let tracklog trouble block the UI
            }
            setTrack((prev) => [...prev, { latitude: f.latitude, longitude: f.longitude, leg }]);
          }
          // leg prompts by sustained speed
          const s = f.speed;
          if (legActiveRef.current) {
            if (s != null && s < LEG_OFF_SPEED_MS) {
              if (slowSinceRef.current == null) slowSinceRef.current = now;
              else if (now - slowSinceRef.current > LEG_OFF_SUSTAIN_MS) maybePromptLeg(false, now);
            } else slowSinceRef.current = null;
          } else {
            if (s != null && s > LEG_ON_SPEED_MS) {
              if (fastSinceRef.current == null) fastSinceRef.current = now;
              else if (now - fastSinceRef.current > LEG_ON_SUSTAIN_MS) maybePromptLeg(true, now);
            } else fastSinceRef.current = null;
          }
        }
      );
    })();
    return () => sub?.remove();
  }, []);

  const region = useMemo(() => {
    const lats = FLIGHT_LINES.transects.flatMap((t) => t.coords.map((c) => c[0]));
    const lons = FLIGHT_LINES.transects.flatMap((t) => t.coords.map((c) => c[1]));
    const pad = 0.02;
    return {
      latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
      longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
      latitudeDelta: (Math.max(...lats) - Math.min(...lats)) * 1.25 + pad,
      longitudeDelta: (Math.max(...lons) - Math.min(...lons)) * 1.25 + pad,
    };
  }, []);

  const units = settings?.units ?? "metric";
  const targets = settings?.targets;
  const speedDisp = displaySpeed(fix?.speed ?? null, units);
  const altDisp = displayAlt(fix?.altitude ?? null, units);
  const speedTargetDisp = targets ? displaySpeedTarget(targets.speedKmh, units) : null;
  const altTargetDisp = targets ? displayAltTarget(targets.altM, units) : null;
  const speedTolDisp = targets ? displaySpeedTarget(targets.speedTolKmh, units) : 0;
  const altTolDisp = targets ? displayAltTarget(targets.altTolM, units) : 0;
  const speedColor = speedTargetDisp != null ? tolColor(speedDisp, speedTargetDisp, speedTolDisp) : COLORS.muted;
  const speedArrow = speedTargetDisp != null ? tolArrow(speedDisp, speedTargetDisp, speedTolDisp) : "";
  const altColor = altTargetDisp != null ? tolColor(altDisp, altTargetDisp, altTolDisp) : COLORS.muted;
  const altArrow = altTargetDisp != null ? tolArrow(altDisp, altTargetDisp, altTolDisp) : "";

  const gpsChip = (() => {
    if (!fix) return { text: "GPS —", color: COLORS.bad };
    if (fix.accuracy == null) return { text: "GPS ?", color: COLORS.warn };
    if (fix.accuracy < 10) return { text: `GPS ${fix.accuracy.toFixed(0)} m`, color: COLORS.ok };
    if (fix.accuracy < 30) return { text: `GPS ${fix.accuracy.toFixed(0)} m`, color: COLORS.warn };
    return { text: `GPS ${fix.accuracy.toFixed(0)} m`, color: COLORS.bad };
  })();

  // split the track into same-colour runs (red off-survey, green on-leg),
  // with a shared boundary point so the line stays visually continuous
  const activeLeg = [...legs].reverse().find((l) => !l.ended_at);

  if (!settings || !session) {
    return (
      <View style={styles.root}>
        <Text style={styles.bootText}>Air Survey — starting…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* the map stays mounted across screen switches so pan/zoom persists */}
      <MapCanvas
        fix={fix}
        track={track}
        waypoints={waypoints}
        transects={FLIGHT_LINES.transects}
        species={settings.species}
        onWaypointPress={(w) => setEditWp(w)}
        mapStyleUrl={mapStyleUrls ? mapStyleUrls[mapType] : null}
        mapType={mapType}
        onToggleMapType={toggleMapType}
      />
      {screen === "survey" && (
        <>

          <View style={[styles.hud, { top: insets.top }]}>
            <View style={[styles.chip, { borderColor: gpsChip.color }]}>
              <Text style={[styles.chipText, { color: gpsChip.color }]}>{gpsChip.text}</Text>
            </View>
            <View style={[styles.chip, { borderColor: activeLeg ? COLORS.ok : COLORS.muted }]}>
              <Text style={[styles.chipText, { color: activeLeg ? COLORS.ok : COLORS.muted }]}>
                {activeLeg ? `LEG ${activeLeg.survey_leg ?? ""} · ON` : "OFF SURVEY"}
              </Text>
            </View>
            <View style={styles.readout}>
              <Text style={styles.readoutLabel}>SPD</Text>
              <Text style={[styles.readoutValue, { color: speedColor }]}>{speedDisp != null ? speedDisp.toFixed(0) : "--"}</Text>
              {speedArrow !== "" && <Text style={[styles.readoutArrow, { color: speedColor }]}>{speedArrow}</Text>}
              <Text style={styles.readoutUnit}>{speedLabel(units)}</Text>
            </View>
            <View style={styles.readout}>
              <Text style={styles.readoutLabel}>ALT</Text>
              <Text style={[styles.readoutValue, { color: altColor }]}>{altDisp != null ? altDisp.toFixed(0) : "--"}</Text>
              {altArrow !== "" && <Text style={[styles.readoutArrow, { color: altColor }]}>{altArrow}</Text>}
              <Text style={styles.readoutUnit}>{altLabel(units)}</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={styles.wpCounter}>next WP #{nextNumber}</Text>
          </View>

          <View style={[styles.rail, { top: 64 + insets.top }]}>
            {RAIL_BUTTONS.map((b) => (
              <Pressable
                key={b.screen}
                style={styles.railButton}
                onPress={() => setScreen(b.screen)}
                accessibilityLabel={b.label}
              >
                <Text style={styles.railGlyph}>{b.glyph}</Text>
                <Text style={styles.railLabel}>{b.label}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.markButton, { bottom: 24 + insets.bottom }, session.ended_at && { opacity: 0.4 }]}
            onPress={() => {
              if (session.ended_at) {
                Alert.alert(
                  "This survey is closed",
                  "Closed surveys are read-only. Load or start an open survey to record new sightings."
                );
                return;
              }
              setMarkOpen(true);
            }}
            accessibilityLabel="Mark a sighting"
          >
            <Text style={styles.markButtonText}>MARK</Text>
          </Pressable>

          <MarkModal
            visible={markOpen}
            mode="mark"
            waypointNumber={nextNumber}
            gpsText={gpsChip.text}
            gpsColor={gpsChip.color}
            species={settings.species}
            onCancel={() => setMarkOpen(false)}
            onSave={(draft) => {
              if (!fix) return;
              insertWaypoint(session.id, nextNumber, fix, draft);
              refreshWaypoints();
              setMarkOpen(false);
            }}
          />

          <MarkModal
            visible={editWp != null}
            mode="edit"
            waypointNumber={editWp?.number ?? 0}
            gpsText={gpsChip.text}
            gpsColor={gpsChip.color}
            species={settings.species}
            initial={editWp ? draftFromWaypoint(editWp) : undefined}
            onCancel={() => setEditWp(null)}
            onSave={(draft) => {
              if (!editWp) return;
              updateWaypoint(editWp.id, draft);
              refreshWaypoints();
              setEditWp(null);
            }}
            onDelete={() => {
              if (!editWp) return;
              deleteWaypoint(editWp.id);
              refreshWaypoints();
              setEditWp(null);
            }}
          />
        </>
      )}

      {screen === "settings" && (
        <SettingsScreen
          settings={settings}
          onBack={() => setScreen("survey")}
          onSave={(s) => {
            saveAppSettings(s);
            setSettings(s);
          }}
        />
      )}

      {screen === "totals" && (
        <TotalsScreen waypoints={waypoints} sessionStartedAt={session.started_at} onBack={() => setScreen("survey")} />
      )}

      {screen === "review" && (
        <ReviewScreen
          session={session}
          waypoints={waypoints}
          species={settings.species}
          lastFix={fix}
          onBack={() => setScreen("survey")}
          onWaypointsChanged={refreshWaypoints}
        />
      )}

      {screen === "metadata" && (
        <MetadataScreen
          key={session.id}
          session={session}
          initialLegs={legs}
          waypoints={waypoints}
          onBack={() => setScreen("survey")}
          onSessionUpdated={() => setSession(getSession(session.id) ?? session)}
          onStartNewSurvey={() => {
            endSession(session.id);
            setCurrentSessionId(null);
            bootSession();
            setScreen("survey");
            Alert.alert("New survey started", "Recording from waypoint #1 again.");
          }}
          onPastSurveySelected={(id) => {
            setCurrentSessionId(id);
            bootSession();
            setScreen("survey");
          }}
          onLegsChanged={refreshLegs}
          onDeleteSurvey={(id) => {
            if (id === session.id) {
              setCurrentSessionId(null);
              bootSession();
              Alert.alert("Loaded survey deleted", "A fresh survey has been started.");
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  bootText: { color: COLORS.text, fontSize: 18, marginTop: 80, alignSelf: "center" },
  hud: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(17,20,24,0.85)",
  },
  chip: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 16, fontWeight: "700" },
  readout: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  readoutLabel: { color: COLORS.muted, fontSize: 14, fontWeight: "700" },
  readoutValue: { fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] },
  readoutArrow: { fontSize: 22, fontWeight: "900" }, // correction direction, coloured like the value
  readoutUnit: { color: COLORS.muted, fontSize: 14 },
  wpCounter: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  rail: {
    position: "absolute",
    right: 12,
    top: 64,
    flexDirection: "row",
    flexWrap: "wrap",
    width: 160, // two 76-wide columns
    gap: 8,
  },
  railButton: {
    width: 76,
    height: 56,
    borderRadius: 10,
    backgroundColor: "rgba(27,32,39,0.92)",
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
  },
  railGlyph: { color: COLORS.accent, fontSize: 20, fontWeight: "900" },
  railLabel: { color: COLORS.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  markButton: {
    position: "absolute",
    left: 24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.mark,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  markButtonText: { color: COLORS.bg, fontSize: 28, fontWeight: "900", letterSpacing: 2 },
});
