// Settings: species list (add/remove custom), display units, and survey
// speed/altitude targets with tolerances (drives the HUD yellow/red states).
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenShell from "../components/ScreenShell";
import { COLORS } from "../theme";
import {
  altLabel,
  displayAltTarget,
  displaySpeedTarget,
  speedLabel,
  storedAlt,
  storedSpeed,
} from "../settings";
import type { AppSettings, SpeciesDef, UnitsMode } from "../types";

export default function SettingsScreen({
  settings,
  onSave,
  onBack,
}: {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onBack: () => void;
}) {
  const [species, setSpecies] = useState<SpeciesDef[]>(settings.species);
  const [units, setUnits] = useState<UnitsMode>(settings.units);
  // work in display units while editing
  const [speed, setSpeed] = useState(String(Math.round(displaySpeedTarget(settings.targets.speedKmh, settings.units))));
  const [speedTol, setSpeedTol] = useState(
    String(Math.round(displaySpeedTarget(settings.targets.speedTolKmh, settings.units)))
  );
  const [alt, setAlt] = useState(String(Math.round(displayAltTarget(settings.targets.altM, settings.units))));
  const [altTol, setAltTol] = useState(String(Math.round(displayAltTarget(settings.targets.altTolM, settings.units))));
  const [newSpecies, setNewSpecies] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (key: string, label: string) => {
    setEditingKey(key);
    setEditText(label);
  };

  const commitEdit = () => {
    if (editingKey == null) return;
    const label = editText.trim();
    setEditingKey(null);
    if (!label) return;
    const key = label.toLowerCase();
    if (species.some((s) => s.key === key && s.key !== editingKey)) {
      Alert.alert("Name already used", "Two species can't share a name.");
      return;
    }
    setSpecies((prev) =>
      prev.map((s) => (s.key === editingKey ? { ...s, key, label, code: (label[0] || "?").toUpperCase() } : s))
    );
  };

  const moveSpecies = (index: number, dir: -1 | 1) => {
    setSpecies((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const removeSpecies = (index: number) => {
    setSpecies((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const unitsChanged = units !== settings.units;
  // when switching units, convert the visible numbers too
  const switchUnits = (u: UnitsMode) => {
    if (u === units) return;
    const conv = (v: string, from: UnitsMode, to: UnitsMode, isAlt: boolean) => {
      const n = parseFloat(v);
      if (!isFinite(n)) return v;
      const stored = isAlt ? storedAlt(n, from) : storedSpeed(n, from);
      return String(Math.round(isAlt ? displayAltTarget(stored, to) : displaySpeedTarget(stored, to)));
    };
    setSpeed((v) => conv(v, units, u, false));
    setSpeedTol((v) => conv(v, units, u, false));
    setAlt((v) => conv(v, units, u, true));
    setAltTol((v) => conv(v, units, u, true));
    setUnits(u);
  };

  const addSpecies = () => {
    const label = newSpecies.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (species.some((s) => s.key === key)) {
      Alert.alert("Already listed", `${label} is already on the species list.`);
      return;
    }
    const code = (label[0] || "?").toUpperCase();
    setSpecies((prev) => [...prev, { key, label, code, custom: true }]);
    setNewSpecies("");
  };

  const save = () => {
    const nums = [speed, speedTol, alt, altTol].map((v) => parseFloat(v));
    if (nums.some((n) => !isFinite(n) || n < 0)) {
      Alert.alert("Check the targets", "Speed and altitude targets must be numbers.");
      return;
    }
    onSave({
      species,
      units,
      targets: {
        speedKmh: storedSpeed(nums[0], units),
        speedTolKmh: storedSpeed(nums[1], units),
        altM: storedAlt(nums[2], units),
        altTolM: storedAlt(nums[3], units),
      },
    });
    onBack();
  };

  return (
    <ScreenShell title="Settings" onBack={onBack}>
      <Text style={styles.section}>SPECIES (tap a name to edit · arrows reorder)</Text>
      <View style={styles.speciesWrap}>
        {species.map((s, i) => (
          <View key={s.key} style={styles.speciesRow}>
            <View style={styles.speciesCodeChip}>
              <Text style={styles.speciesCodeText}>{s.code}</Text>
            </View>
            {editingKey === s.key ? (
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                onSubmitEditing={commitEdit}
                onBlur={commitEdit}
              />
            ) : (
              <Pressable style={styles.speciesNameBtn} onPress={() => startEdit(s.key, s.label)}>
                <Text style={styles.speciesName}>{s.label}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.arrowBtn, i === 0 && styles.arrowDisabled]}
              disabled={i === 0}
              onPress={() => moveSpecies(i, -1)}
            >
              <Text style={styles.arrowText}>↑</Text>
            </Pressable>
            <Pressable
              style={[styles.arrowBtn, i === species.length - 1 && styles.arrowDisabled]}
              disabled={i === species.length - 1}
              onPress={() => moveSpecies(i, 1)}
            >
              <Text style={styles.arrowText}>↓</Text>
            </Pressable>
            <Pressable
              style={[styles.removeBtn, species.length <= 1 && styles.arrowDisabled]}
              disabled={species.length <= 1}
              onPress={() => removeSpecies(i)}
            >
              <Text style={styles.removeBtnText}>remove</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="add species…"
          placeholderTextColor={COLORS.muted}
          value={newSpecies}
          onChangeText={setNewSpecies}
        />
        <Pressable style={styles.addBtn} onPress={addSpecies}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>UNITS</Text>
      <View style={styles.segRow}>
        {(["metric", "aviation"] as UnitsMode[]).map((u) => (
          <Pressable key={u} style={[styles.segBtn, units === u && styles.segOn]} onPress={() => switchUnits(u)}>
            <Text style={[styles.segText, units === u && { color: COLORS.bg }]}>
              {u === "metric" ? `km/h · m` : `kt · ft`}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>SURVEY TARGETS</Text>
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>Target speed ({speedLabel(units)})</Text>
        <NumInput value={speed} onChange={setSpeed} />
      </View>
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>Speed tolerance (±)</Text>
        <NumInput value={speedTol} onChange={setSpeedTol} />
      </View>
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>Target altitude ({altLabel(units)})</Text>
        <NumInput value={alt} onChange={setAlt} />
      </View>
      <View style={styles.targetRow}>
        <Text style={styles.targetLabel}>Altitude tolerance (±)</Text>
        <NumInput value={altTol} onChange={setAltTol} />
      </View>
      <Text style={styles.hint}>
        Readouts stay green inside tolerance, yellow in the warning band just outside, red beyond.
      </Text>

      <Pressable style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveBtnText}>Save settings</Text>
      </Pressable>
    </ScreenShell>
  );
}

function NumInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={styles.numInput}
      keyboardType="numeric"
      value={value}
      onChangeText={onChange}
      selectTextOnFocus
    />
  );
}

const styles = StyleSheet.create({
  section: { color: COLORS.muted, fontSize: 13, fontWeight: "800", letterSpacing: 1.5, marginTop: 8 },
  speciesWrap: { alignSelf: "stretch", gap: 6 },
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.panel,
    borderRadius: 10,
    padding: 10,
  },
  speciesCodeChip: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  speciesCodeText: { color: COLORS.accent, fontSize: 18, fontWeight: "900" },
  speciesNameBtn: { flex: 1, paddingVertical: 4 },
  speciesName: { color: COLORS.text, fontSize: 17, fontWeight: "600" },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 16,
    padding: 6,
  },
  arrowBtn: { width: 38, alignItems: "center", justifyContent: "center", paddingVertical: 6 },
  arrowDisabled: { opacity: 0.25 },
  arrowText: { color: COLORS.accent, fontSize: 18, fontWeight: "900" },
  removeBtn: { padding: 6 },
  removeBtnText: { color: COLORS.bad, fontSize: 14, fontWeight: "700" },
  addRow: { flexDirection: "row", gap: 10, alignSelf: "stretch" },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
    color: COLORS.text,
    fontSize: 16,
    padding: 10,
  },
  addBtn: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 20, justifyContent: "center" },
  addBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: "800" },
  segRow: { flexDirection: "row", gap: 10 },
  segBtn: {
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  segOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  segText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  targetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
  },
  targetLabel: { color: COLORS.text, fontSize: 16 },
  numInput: {
    width: 110,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: COLORS.panel,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    padding: 8,
    textAlign: "center",
  },
  hint: { color: COLORS.muted, fontSize: 13, maxWidth: 500 },
  saveBtn: { backgroundColor: COLORS.ok, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 },
  saveBtnText: { color: COLORS.bg, fontSize: 18, fontWeight: "900" },
});
