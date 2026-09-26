// Post-flight review: every waypoint, editable; missed-observation (9001+)
// additions from the audio. Exports live on the DATA screen.
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import ScreenShell from "../components/ScreenShell";
import MarkModal from "../components/MarkModal";
import { COLORS } from "../theme";
import { deleteWaypoint, insertWaypointAtCoords, nextMissedNumber, updateWaypoint } from "../db";
import { draftFromWaypoint, type GpsFix, type SessionInfo, type SpeciesDef, type WaypointRecord } from "../types";
import { mstParts, pad2 } from "../time";

type EditorState =
  | { mode: "closed" }
  | { mode: "edit"; waypoint: WaypointRecord }
  | { mode: "missed"; number: number };

function timeLabel(iso: string): string {
  const t = mstParts(new Date(iso));
  return `${pad2(t.hour)}:${pad2(t.minute)}:${pad2(t.second)}`;
}

function flagsLabel(w: WaypointRecord): string {
  const f: string[] = [];
  if (w.circled) f.push("↻");
  if (w.photographed) f.push("📷");
  if (w.captive) f.push("⌂");
  if (w.collared) f.push("◉");
  if (w.recheck) f.push("✓");
  if (w.duplicate) f.push("⧉");
  if (w.not_dup) f.push("≠");
  return f.join("");
}

export default function ReviewScreen({
  session,
  waypoints,
  species,
  lastFix,
  onBack,
  onWaypointsChanged,
}: {
  session: SessionInfo;
  waypoints: WaypointRecord[];
  species: SpeciesDef[];
  lastFix: GpsFix | null;
  onBack: () => void;
  onWaypointsChanged: () => void;
}) {
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });

  const gpsChip = lastFix ? `GPS ${lastFix.accuracy?.toFixed(0) ?? "?"} m` : "no GPS";

  return (
    <ScreenShell title="Review" onBack={onBack}>
      <Text style={styles.meta}>
        {waypoints.length} waypoints recorded · tap any row to fix it
      </Text>

      <View style={styles.list}>
        {waypoints.map((w) => (
          <Pressable key={w.id} style={styles.row} onPress={() => setEditor({ mode: "edit", waypoint: w })}>
            <Text style={w.number >= 9001 ? styles.numMissed : styles.num}>#{w.number}</Text>
            <Text style={styles.species}>{w.species}</Text>
            <Text style={styles.count}>{w.total}</Text>
            <Text style={styles.flags}>{flagsLabel(w)}</Text>
            <Text style={styles.time}>{timeLabel(w.recorded_at)}</Text>
          </Pressable>
        ))}
        {waypoints.length === 0 && <Text style={styles.empty}>Nothing recorded yet.</Text>}
      </View>

      <Pressable
        style={[styles.missedBtn, session.ended_at && { opacity: 0.4 }]}
        onPress={() => {
          if (session.ended_at) {
            Alert.alert("This survey is closed", "Closed surveys are read-only — recording goes to an open survey.");
            return;
          }
          setEditor({ mode: "missed", number: nextMissedNumber(session.id) });
        }}
      >
        <Text style={styles.missedBtnText}>+ Add missed observation (9001+)</Text>
      </Pressable>

      <MarkModal
        visible={editor.mode === "edit"}
        mode="edit"
        waypointNumber={editor.mode === "edit" ? editor.waypoint.number : 0}
        gpsText={gpsChip}
        gpsColor={COLORS.muted}
        species={species}
        initial={editor.mode === "edit" ? draftFromWaypoint(editor.waypoint) : undefined}
        onCancel={() => setEditor({ mode: "closed" })}
        onSave={(draft) => {
          if (editor.mode !== "edit") return;
          updateWaypoint(editor.waypoint.id, draft);
          onWaypointsChanged();
          setEditor({ mode: "closed" });
        }}
        onDelete={() => {
          if (editor.mode !== "edit") return;
          deleteWaypoint(editor.waypoint.id);
          onWaypointsChanged();
          setEditor({ mode: "closed" });
        }}
      />

      <MarkModal
        visible={editor.mode === "missed"}
        mode="missed"
        waypointNumber={editor.mode === "missed" ? editor.number : 0}
        gpsText={gpsChip}
        gpsColor={COLORS.muted}
        species={species}
        initialPosition={lastFix ? { lat: lastFix.latitude, lon: lastFix.longitude } : null}
        onCancel={() => setEditor({ mode: "closed" })}
        onSave={(draft, position) => {
          if (editor.mode !== "missed" || !position) return;
          insertWaypointAtCoords(session.id, editor.number, new Date(), position.lat, position.lon, draft);
          onWaypointsChanged();
          setEditor({ mode: "closed" });
        }}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  meta: { color: COLORS.muted, fontSize: 14 },
  list: { alignSelf: "stretch", gap: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.panel,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  num: { color: COLORS.accent, fontSize: 18, fontWeight: "900", width: 64 },
  numMissed: { color: COLORS.warn, fontSize: 18, fontWeight: "900", width: 64 },
  species: { color: COLORS.text, fontSize: 17, flex: 1 },
  count: { color: COLORS.text, fontSize: 18, fontWeight: "800", width: 50, textAlign: "right", fontVariant: ["tabular-nums"] },
  flags: { color: COLORS.warn, width: 60 },
  time: { color: COLORS.muted, fontSize: 14, width: 70, textAlign: "right", fontVariant: ["tabular-nums"] },
  empty: { color: COLORS.muted, fontSize: 16 },
  missedBtn: {
    borderWidth: 2,
    borderColor: COLORS.warn,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  missedBtnText: { color: COLORS.warn, fontSize: 16, fontWeight: "800" },
  section: { color: COLORS.muted, fontSize: 13, fontWeight: "800", letterSpacing: 1.5, marginTop: 12 },
  hint: { color: COLORS.muted, fontSize: 13, maxWidth: 560 },
});
