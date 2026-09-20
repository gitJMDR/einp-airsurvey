// Preliminary per-species totals for the current survey — a mid-flight
// sanity check, explicitly NOT the official count.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ScreenShell from "../components/ScreenShell";
import { COLORS } from "../theme";
import type { WaypointRecord } from "../types";
import { mstParts, pad2 } from "../time";

export default function TotalsScreen({
  waypoints,
  sessionStartedAt,
  onBack,
}: {
  waypoints: WaypointRecord[];
  sessionStartedAt: string;
  onBack: () => void;
}) {
  const bySpecies = new Map<string, { animals: number; groups: number }>();
  for (const w of waypoints) {
    const e = bySpecies.get(w.species) ?? { animals: 0, groups: 0 };
    e.animals += w.total ?? 0;
    e.groups += 1;
    bySpecies.set(w.species, e);
  }
  const rows = [...bySpecies.entries()].sort((a, b) => b[1].animals - a[1].animals);
  const grandAnimals = rows.reduce((s, [, e]) => s + e.animals, 0);
  const t = mstParts(new Date(sessionStartedAt));

  return (
    <ScreenShell title="Preliminary totals" onBack={onBack}>
      <Text style={styles.provisional}>PROVISIONAL — sanity check only, not the official count</Text>
      <Text style={styles.started}>
        Survey of {t.year}-{pad2(t.month)}-{pad2(t.day)} · {waypoints.length} waypoints
      </Text>

      {rows.length === 0 && <Text style={styles.empty}>No sightings recorded yet.</Text>}

      <View style={styles.table}>
        {rows.length > 0 && (
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.headerCell]}>Species</Text>
            <Text style={[styles.cellNum, styles.headerCell]}>Groups</Text>
            <Text style={[styles.cellNum, styles.headerCell]}>Animals</Text>
          </View>
        )}
        {rows.map(([sp, e]) => (
          <View key={sp} style={styles.row}>
            <Text style={styles.cell}>{sp}</Text>
            <Text style={styles.cellNum}>{e.groups}</Text>
            <Text style={[styles.cellNum, styles.big]}>{e.animals}</Text>
          </View>
        ))}
        {rows.length > 0 && (
          <View style={[styles.row, styles.totalRow]}>
            <Text style={[styles.cell, styles.totalText]}>TOTAL</Text>
            <Text style={[styles.cellNum, styles.totalText]}>{waypoints.length}</Text>
            <Text style={[styles.cellNum, styles.totalText, styles.big]}>{grandAnimals}</Text>
          </View>
        )}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  provisional: { color: COLORS.warn, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  started: { color: COLORS.muted, fontSize: 14 },
  empty: { color: COLORS.muted, fontSize: 16, marginTop: 12 },
  table: { alignSelf: "stretch", borderRadius: 12, backgroundColor: COLORS.panel, padding: 8 },
  row: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8 },
  headerRow: { borderBottomWidth: 1, borderBottomColor: COLORS.line },
  totalRow: { borderTopWidth: 1, borderTopColor: COLORS.line },
  cell: { flex: 1, color: COLORS.text, fontSize: 18 },
  cellNum: { width: 100, color: COLORS.text, fontSize: 18, textAlign: "right", fontVariant: ["tabular-nums"] },
  big: { fontSize: 22, fontWeight: "800" },
  headerCell: { color: COLORS.muted, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  totalText: { fontWeight: "900", fontSize: 20 },
});
