// The sighting editor pop-over. Three modes share one editor:
//   mark   — live entry from the map's MARK button (position = current GPS)
//   edit   — correcting a saved waypoint in Review
//   missed — post-flight 9001+ addition heard on the audio (manual position)
// Count entry: a six-cell strip (Bulls/Cows/Yearlings/Calves/Unk/Total).
// Tap a cell, type on the keypad. Total is authoritative once entered —
// classes never overwrite it and Unknown absorbs the remainder
// (Unknown = Total − class sum). While Total is blank (or was auto-filled
// by this rule), entering classes auto-fills Total with their sum, so
// "1 cow, 1 calf" alone records a total of 2.
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, NOTE_TOGGLE_ROWS } from "../theme";
import { emptyDraft, type SightingDraft, type SpeciesDef } from "../types";

export type MarkModalMode = "mark" | "edit" | "missed";

type KeypadTarget = "total" | "bulls" | "cows" | "yearlings" | "calves";
const CLASS_KEYS: Exclude<KeypadTarget, "total">[] = ["bulls", "yearlings", "cows", "calves"];
const CLASS_LABELS: Record<Exclude<KeypadTarget, "total">, string> = {
  bulls: "Bulls",
  cows: "Cows",
  yearlings: "Yearlings",
  calves: "Calves",
};

const sumClasses = (classes: SightingDraft["classes"]): number =>
  CLASS_KEYS.reduce((s, k) => s + (parseInt(classes[k], 10) || 0), 0);

type ClassCounts = SightingDraft["classes"];
/** Additive quick-entry chips, chosen from historical frequency (see
 *  scripts/analyze-classes.mjs): 1B (2192 uses), C+C (1167), 2B (817),
 *  C+Y (113), C+2C (107). Presses stack, e.g. 1B then 2B = 3 bulls. */
const TEMPLATES: { key: string; apply: (c: ClassCounts) => ClassCounts }[] = [
  { key: "1B", apply: (c) => ({ ...c, bulls: String((parseInt(c.bulls, 10) || 0) + 1) }) },
  { key: "2B", apply: (c) => ({ ...c, bulls: String((parseInt(c.bulls, 10) || 0) + 2) }) },
  { key: "1C", apply: (c) => ({ ...c, cows: String((parseInt(c.cows, 10) || 0) + 1) }) },
  {
    key: "C+C",
    apply: (c) => ({ ...c, cows: String((parseInt(c.cows, 10) || 0) + 1), calves: String((parseInt(c.calves, 10) || 0) + 1) }),
  },
  {
    key: "C+2C",
    apply: (c) => ({ ...c, cows: String((parseInt(c.cows, 10) || 0) + 1), calves: String((parseInt(c.calves, 10) || 0) + 2) }),
  },
  {
    key: "C+Y",
    apply: (c) => ({ ...c, cows: String((parseInt(c.cows, 10) || 0) + 1), yearlings: String((parseInt(c.yearlings, 10) || 0) + 1) }),
  },
];

/**
 * Reorders a list so that a normal left-to-right wrap renders it column-major
 * (top to bottom, then left to right). Species order B,E,M,D,C,X displays as
 *   B M C
 *   E D X
 */
function columnMajor<T>(items: T[]): T[] {
  const n = items.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const out: T[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const idx = j * rows + i;
      if (idx < n) out.push(items[idx]);
    }
  }
  return out;
}

export interface MarkModalProps {
  visible: boolean;
  mode: MarkModalMode;
  waypointNumber: number;
  gpsText: string;
  gpsColor: string;
  species: SpeciesDef[];
  initial?: SightingDraft;
  initialPosition?: { lat: number; lon: number } | null;
  onCancel: () => void;
  onSave: (draft: SightingDraft, position: { lat: number; lon: number } | null) => void;
  onDelete?: () => void;
}

export default function MarkModal(props: MarkModalProps) {
  const { visible, mode, waypointNumber, species, initial, initialPosition, onCancel, onSave, onDelete } = props;
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SightingDraft>(emptyDraft);
  const [keypadTarget, setKeypadTarget] = useState<KeypadTarget>("total");
  // true right after a cell is selected: the next digit replaces instead of appending
  const [pendingReplace, setPendingReplace] = useState(true);
  // true while Total was auto-filled from class sums (still tracking); typing
  // in Total directly makes it authoritative and stops the tracking.
  const totalAutoRef = React.useRef(false);
  // read via refs on open only — the parent rebuilds `initial`/`initialPosition`
  // as fresh objects on every render (every GPS fix), which would otherwise
  // wipe in-progress edits once a second
  const initialRef = React.useRef(initial);
  initialRef.current = initial;

  useEffect(() => {
    if (visible) {
      setDraft(initialRef.current ?? emptyDraft());
      setKeypadTarget("total");
      setPendingReplace(true);
      totalAutoRef.current = false;
    }
  }, [visible, waypointNumber, mode]);

  const classSum = sumClasses(draft.classes);
  const totalNum = parseInt(draft.total, 10) || 0;
  const unknownNum = Math.max(0, totalNum - classSum);
  const overCounted = classSum > totalNum;

  /** Selecting a cell: first tap targets it, tapping the active cell empties it. */
  const selectCell = (target: KeypadTarget) => {
    if (keypadTarget === target) {
      clearCell(target);
      setPendingReplace(false);
    } else {
      setKeypadTarget(target);
      setPendingReplace(true);
    }
  };

  const pressDigit = (d: string) => {
    const replace = pendingReplace;
    setPendingReplace(false);
    setDraft((prev) => {
      if (keypadTarget === "total") {
        totalAutoRef.current = false; // typed total is authoritative
        return { ...prev, total: replace ? d : (prev.total + d).slice(0, 4) };
      }
      const classes = { ...prev.classes, [keypadTarget]: replace ? d : (prev.classes[keypadTarget] + d).slice(0, 3) };
      if (prev.total === "" || totalAutoRef.current) {
        totalAutoRef.current = true;
        return { ...prev, classes, total: String(sumClasses(classes)) };
      }
      return { ...prev, classes };
    });
  };
  /** Template chips: additive class entries honouring the total rule
   *  (blank/auto total re-sums; a hand-typed total is never touched). */
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setDraft((prev) => {
      const classes = t.apply(prev.classes);
      if (prev.total === "" || totalAutoRef.current) {
        totalAutoRef.current = true;
        return { ...prev, classes, total: String(sumClasses(classes)) };
      }
      return { ...prev, classes };
    });
  };

  /** Tap the already-active cell to empty it (corrections without a backspace key). */
  const clearCell = (target: KeypadTarget) => {
    setDraft((prev) => {
      if (target === "total") {
        totalAutoRef.current = false; // cleared by hand: blank again, classes may re-sum it
        return { ...prev, total: "" };
      }
      const classes = { ...prev.classes, [target]: "" };
      if (prev.total === "" || totalAutoRef.current) {
        totalAutoRef.current = true;
        return { ...prev, classes, total: String(sumClasses(classes)) };
      }
      return { ...prev, classes };
    });
  };

  const isDirty =
    draft.species != null ||
    draft.total !== "" ||
    Object.values(draft.classes).some((v) => v !== "") ||
    draft.notes.trim() !== "" ||
    draft.photographed ||
    draft.circled ||
    draft.recheck ||
    draft.duplicate ||
    draft.captive ||
    draft.collared ||
    draft.notDup;

  const doCancel = () => {
    if (mode === "edit") return onCancel();
    if (!isDirty) return onCancel();
    Alert.alert("Discard this waypoint?", "Nothing will be recorded.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: onCancel },
    ]);
  };

  const doSave = () => {
    if (draft.species == null) {
      Alert.alert("Pick a species", "Tap one of the species buttons first.");
      return;
    }
    if (draft.total === "") {
      Alert.alert("Enter a count", "Even a kill site gets a count (use 0 if truly none).");
      return;
    }
    if (overCounted) {
      Alert.alert("Counts don't add up", `The class counts (${classSum}) exceed the total (${totalNum}).`);
      return;
    }
    if (mode === "missed") {
      const lat = parseFloat(latText);
      const lon = parseFloat(lonText);
      if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        Alert.alert("Enter coordinates", "Type the latitude/longitude for this missed observation (or use current GPS).");
        return;
      }
      onSave(draft, { lat, lon });
      return;
    }
    onSave(draft, null);
  };

  const doDelete = () => {
    Alert.alert(`Delete waypoint ${waypointNumber}?`, "This cannot be undone.", [
      { text: "Keep", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete?.() },
    ]);
  };

  const [latText, setLatText] = useState("");
  const [lonText, setLonText] = useState("");
  const initialPosRef = React.useRef(initialPosition);
  initialPosRef.current = initialPosition;
  useEffect(() => {
    if (visible) {
      setLatText(initialPosRef.current ? String(initialPosRef.current.lat) : "");
      setLonText(initialPosRef.current ? String(initialPosRef.current.lon) : "");
    }
  }, [visible]);

  const title =
    mode === "edit"
      ? `Waypoint ${waypointNumber}`
      : mode === "missed"
        ? `Waypoint ${waypointNumber} — missed obs`
        : `Waypoint ${waypointNumber}`;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={doCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.panel, { paddingBottom: insets.bottom + 12 }]}>
          {/* Left: notes on top (keyboard rises from the bottom), species at the
              bottom near the thumb that presses MARK. */}
          <View style={styles.left}>
            <Text style={styles.wpNumber}>{title}</Text>
            {mode === "missed" && <Text style={styles.wpSub}>post-flight addition — enter position manually</Text>}
            {mode === "missed" && (
              <View style={styles.positionRow}>
                <TextInput
                  style={styles.positionInput}
                  placeholder="latitude"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="numeric"
                  value={latText}
                  onChangeText={setLatText}
                />
                <TextInput
                  style={styles.positionInput}
                  placeholder="longitude"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="numeric"
                  value={lonText}
                  onChangeText={setLonText}
                />
              </View>
            )}

            <TextInput
              style={styles.notesInput}
              placeholder="Notes (optional)"
              placeholderTextColor={COLORS.muted}
              value={draft.notes}
              onChangeText={(t) => setDraft((prev) => ({ ...prev, notes: t }))}
              multiline
            />

            {NOTE_TOGGLE_ROWS.map((row, i) => (
              <View key={i} style={styles.noteTogglesRow}>
                {row.map((n) => {
                  const on = draft[n.key];
                  return (
                    <Pressable
                      key={n.key}
                      style={[styles.noteToggle, on && styles.noteToggleOn]}
                      onPress={() => setDraft((prev) => ({ ...prev, [n.key]: !prev[n.key] }))}
                    >
                      <Text style={[styles.noteToggleText, on && { color: COLORS.bg }]}>{n.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            <View style={{ flex: 1 }} />

            <View style={styles.speciesGrid}>
              {columnMajor(species).map((s) => {
                const selected = draft.species === s.key;
                return (
                  <Pressable
                    key={s.key}
                    style={[styles.speciesButton, selected && styles.speciesSelected]}
                    onPress={() => setDraft((prev) => ({ ...prev, species: s.key }))}
                  >
                    <Text style={[styles.speciesCode, selected && { color: COLORS.bg }]}>{s.code}</Text>
                    <Text style={[styles.speciesLabel, selected && { color: COLORS.bg }]}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Right: count strip + keypad */}
          <View style={styles.right}>
            <View style={styles.strip}>
              {CLASS_KEYS.map((k) => (
                <Pressable
                  key={k}
                  style={[styles.cell, keypadTarget === k && styles.cellActive]}
                  onPress={() => selectCell(k)}
                >
                  <Text style={styles.cellLabel} numberOfLines={1} adjustsFontSizeToFit>
                    {CLASS_LABELS[k]}
                  </Text>
                  <Text style={styles.cellValue}>{draft.classes[k] === "" ? "–" : draft.classes[k]}</Text>
                </Pressable>
              ))}
              <View style={[styles.cell, styles.cellDerived]}>
                <Text style={styles.cellLabel} numberOfLines={1} adjustsFontSizeToFit>
                  Unk
                </Text>
                <Text style={styles.cellValue}>{unknownNum}</Text>
              </View>
              <Pressable
                style={[styles.cell, styles.cellTotal, keypadTarget === "total" && styles.cellActive]}
                onPress={() => selectCell("total")}
              >
                <Text style={[styles.cellLabel, { color: COLORS.accent }]} numberOfLines={1} adjustsFontSizeToFit>
                  Total
                </Text>
                <Text style={[styles.cellValue, overCounted && { color: COLORS.bad }]}>
                  {draft.total === "" ? "–" : draft.total}
                </Text>
              </Pressable>
            </View>
            {overCounted && <Text style={styles.warnText}>classes exceed total</Text>}

            <View style={styles.templateRow}>
              {TEMPLATES.map((t) => (
                <Pressable key={t.key} style={styles.templateChip} onPress={() => applyTemplate(t)}>
                  <Text style={styles.templateText}>{t.key}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.pad}>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                <Pressable key={k} style={styles.padKey} onPress={() => pressDigit(k)}>
                  <Text style={styles.padKeyText}>{k}</Text>
                </Pressable>
              ))}
              <Pressable style={[styles.padKey, styles.padCancel]} onPress={doCancel}>
                <Text style={styles.padActionText}>CANCEL</Text>
              </Pressable>
              <Pressable style={styles.padKey} onPress={() => pressDigit("0")}>
                <Text style={styles.padKeyText}>0</Text>
              </Pressable>
              <Pressable style={[styles.padKey, styles.padSave]} onPress={doSave}>
                <Text style={styles.padSaveText}>SAVE</Text>
              </Pressable>
            </View>

            {mode === "edit" && onDelete && (
              <Pressable style={styles.deleteButton} onPress={doDelete}>
                <Text style={styles.deleteButtonText}>Delete waypoint</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
  panel: {
    flexDirection: "row",
    width: "98%",
    maxHeight: "96%",
    borderRadius: 18,
    backgroundColor: COLORS.panel,
    padding: 14,
    gap: 16,
  },
  left: { flex: 1, gap: 10 },
  right: { width: 430, gap: 10 },
  wpNumber: { color: COLORS.text, fontSize: 26, fontWeight: "900" },
  wpSub: { color: COLORS.muted, fontSize: 14 },
  positionRow: { flexDirection: "row", gap: 10 },
  positionInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.warn,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 16,
    padding: 10,
  },
  speciesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  speciesButton: {
    minWidth: 118,
    minHeight: 76,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.line,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  speciesSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  speciesCode: { color: COLORS.accent, fontSize: 18, fontWeight: "900" },
  speciesLabel: { color: COLORS.text, fontSize: 16, fontWeight: "600" },
  noteTogglesRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  noteToggle: {
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: COLORS.bg,
  },
  noteToggleOn: { backgroundColor: COLORS.warn, borderColor: COLORS.warn },
  noteToggleText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 16,
    padding: 10,
    minHeight: 52,
    textAlignVertical: "top",
  },
  strip: { flexDirection: "row", gap: 6 },
  cell: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    paddingVertical: 6,
  },
  cellActive: { borderColor: COLORS.accent, backgroundColor: "#16202c" },
  cellDerived: { borderColor: COLORS.warn },
  cellTotal: { borderWidth: 2 },
  cellLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  cellValue: { color: COLORS.text, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  warnText: { color: COLORS.bad, fontSize: 12, fontWeight: "700", marginTop: -6 },
  templateRow: { flexDirection: "row", gap: 8 },
  templateChip: {
    height: 46,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  templateText: { color: COLORS.accent, fontSize: 16, fontWeight: "900" },
  pad: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  padKey: {
    flexBasis: "31%",
    height: 76,
    borderRadius: 12,
    backgroundColor: COLORS.bg,
    borderWidth: 2,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
  },
  padCancel: { borderColor: COLORS.bad },
  padSave: { backgroundColor: COLORS.ok, borderColor: COLORS.ok },
  padKeyText: { color: COLORS.text, fontSize: 30, fontWeight: "800" },
  padActionText: { color: COLORS.text, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  padSaveText: { color: COLORS.bg, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  deleteButton: { alignItems: "center", paddingVertical: 6 },
  deleteButtonText: { color: COLORS.bad, fontSize: 16, fontWeight: "700" },
});
