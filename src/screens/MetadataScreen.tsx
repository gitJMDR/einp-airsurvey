// Flight metadata: survey-level snow fields, and one card per survey leg
// (crew + experience ratings, times, weather conditions). Column names mirror
// the SurveyConditions worksheet so exports drop straight in.
// Everything auto-saves on change — there are no Save buttons.
import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenShell from "../components/ScreenShell";
import { COLORS } from "../theme";
import { deleteLeg, deleteSession, getLegs, getSession, insertLeg, listSessions, updateLeg, updateSession, type SessionSummary } from "../db";
import { shareAllExports } from "../export";
import { mstParts, pad2 } from "../time";
import type { Experience, LegRecord, SessionInfo, WaypointRecord } from "../types";

type CrewKey = keyof Pick<LegRecord, "pilot" | "navigator" | "observer1" | "observer2">;
const CREW_SLOTS: { key: CrewKey; label: string }[] = [
  { key: "pilot", label: "Pilot" },
  { key: "navigator", label: "Navigator" },
  { key: "observer1", label: "Observer 1 (nav side)" },
  { key: "observer2", label: "Observer 2 (pilot side)" },
];

function timeLabel(iso: string | null): string {
  if (!iso) return "—";
  const t = mstParts(new Date(iso));
  return `${pad2(t.hour)}:${pad2(t.minute)}`;
}

export default function MetadataScreen({
  session,
  initialLegs,
  waypoints,
  onBack,
  onSessionUpdated,
  onStartNewSurvey,
  onPastSurveySelected,
  onLegsChanged,
  onDeleteSurvey,
}: {
  session: SessionInfo;
  initialLegs: LegRecord[];
  waypoints: WaypointRecord[];
  onBack: () => void;
  onSessionUpdated: () => void;
  onStartNewSurvey: () => void;
  onPastSurveySelected: (id: number) => void;
  onLegsChanged: () => void;
  onDeleteSurvey: (id: number) => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const [pastList, setPastList] = useState<SessionSummary[]>([]);
  const [legs, setLegs] = useState<LegRecord[]>(initialLegs);
  const [snowAvg, setSnowAvg] = useState(session.snow_avg_cm?.toString() ?? "");
  const [snowLastAmt, setSnowLastAmt] = useState(session.snow_last_amt_cm?.toString() ?? "");
  const [snowHrs, setSnowHrs] = useState(session.snow_hrs_since?.toString() ?? "");
  const [charterCo, setCharterCo] = useState(session.air_charter_co ?? "");
  const [aircraft, setAircraft] = useState(session.aircraft ?? "");
  const [pilotName, setPilotName] = useState(session.pilot ?? "");
  const [pilotExp, setPilotExp] = useState((session.pilot_rating ?? "A") as Experience);
  const [condPhotos, setCondPhotos] = useState(session.condition_photos == null ? "" : session.condition_photos ? "Yes" : "No");

  /** auto-save: every session field write goes through here */
  const patchS = (fields: Parameters<typeof updateSession>[1]) => {
    updateSession(session.id, fields);
    onSessionUpdated();
  };
  const numOrNull = (v: string) => {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  };
  const setSnow = (setter: (v: string) => void, field: "snow_avg_cm" | "snow_last_amt_cm" | "snow_hrs_since", v: string) => {
    setter(v);
    patchS({ [field]: numOrNull(v) } as Parameters<typeof updateSession>[1]);
  };

  /** auto-save: leg updates persist immediately, and the app's copy stays in
   *  sync so a trip to the map and back doesn't resurrect stale legs */
  const setLeg = (id: number, patch: Partial<LegRecord>) => {
    const updated = { ...(legs.find((l) => l.id === id) as LegRecord), ...patch };
    updateLeg(id, updated);
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    onLegsChanged();
  };
  const setCrew = (id: number, key: CrewKey, patch: Partial<LegRecord[CrewKey]>) => {
    const leg = legs.find((l) => l.id === id) as LegRecord;
    setLeg(id, { [key]: { ...leg[key], ...patch } } as Partial<LegRecord>);
  };

  /** Commit an edited HH:MM (MST) time. Empty end time re-opens the leg.
   *  Returns false (and reverts) if the text isn't a valid time. */
  const commitLegTime = (l: LegRecord, which: "start" | "end", raw: string): boolean => {
    const text = raw.trim();
    if (text === "" && which === "end") {
      setLeg(l.id, { ended_at: null });
      return true;
    }
    const m = text.match(/^(\d{1,2})(?:[:.](\d{1,2}))?$/);
    if (!m) return false;
    const hh = parseInt(m[1], 10);
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    if (hh > 23 || mm > 59) return false;
    const baseIso = l.started_at ?? l.ended_at ?? new Date().toISOString();
    const base = mstParts(new Date(baseIso));
    let ms = Date.UTC(base.year, base.month - 1, base.day, hh, mm) - 7 * 3600_000; // MST → UTC
    if (which === "end" && l.started_at && ms < new Date(l.started_at).getTime()) {
      ms += 86_400_000; // ended before it started → crossed midnight
    }
    setLeg(l.id, which === "start" ? { started_at: new Date(ms).toISOString() } : { ended_at: new Date(ms).toISOString() });
    return true;
  };

  const addLeg = () => {
    if (session.ended_at) {
      Alert.alert("This survey is closed", "Closed surveys are read-only — legs can't be added.");
      return;
    }
    insertLeg(session.id, new Date());
    setLegs(getLegs(session.id));
    onLegsChanged();
  };

  const exportPast = async (id: number) => {
    const s = getSession(id);
    if (!s) return;
    try {
      await shareAllExports(s);
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : String(e));
    }
  };

  const deletePast = (s: SessionSummary) => {
    Alert.alert(
      "Delete this survey?",
      `The ${s.started_at.slice(0, 10)} survey and its ${s.n} waypoints, track, and legs will be permanently deleted from this device.`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteSession(s.id);
            setPastList(listSessions());
            onDeleteSurvey(s.id);
          },
        },
      ]
    );
  };

  const removeLeg = (l: LegRecord) => {
    Alert.alert(`Delete leg ${l.survey_leg ?? ""}?`, "The waypoints stay; only the conditions row is removed.", [
      { text: "Keep", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteLeg(l.id);
          setLegs((prev) => prev.filter((p) => p.id !== l.id));
          onLegsChanged();
        },
      },
    ]);
  };

  const doExport = async () => {
    try {
      await shareAllExports(session);
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : String(e));
    }
  };

  const startNewSurvey = () => {
    Alert.alert(
      "Start a new survey?",
      "The current survey is closed out (nothing is deleted — it stays on this device) and a fresh one begins at waypoint #1.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Start new survey", style: "destructive", onPress: onStartNewSurvey },
      ]
    );
  };

  const legWptRange = (l: LegRecord): string => {
    const inLeg = waypoints.filter(
      (w) => (!l.started_at || w.recorded_at >= l.started_at) && (!l.ended_at || w.recorded_at <= l.ended_at)
    );
    if (!inLeg.length) return "—";
    const nums = inLeg.map((w) => w.number).sort((a, b) => a - b);
    return `#${nums[0]} – #${nums[nums.length - 1]}`;
  };

  const sessionLabel = (() => {
    const t = mstParts(new Date(session.started_at));
    return `${t.year}-${pad2(t.month)}-${pad2(t.day)} ${pad2(t.hour)}:${pad2(t.minute)}`;
  })();

  return (
    <ScreenShell title="Flight metadata" onBack={onBack}>
      <Text style={styles.loadedLine}>
        Loaded survey: {sessionLabel} · {waypoints.length} waypoints ·{" "}
        <Text style={{ color: session.ended_at ? COLORS.warn : COLORS.ok }}>{session.ended_at ? "CLOSED" : "OPEN"}</Text>
        {"  ·  changes save automatically"}
      </Text>

      <Text style={styles.section}>SURVEY INFO</Text>
      <View style={styles.card}>
        <Text style={styles.subsection}>WEATHER CONDITIONS</Text>
        <Row label="Daily average snow depth (cm)">
          <Field value={snowAvg} onChange={(v) => setSnow(setSnowAvg, "snow_avg_cm", v)} numeric />
        </Row>
        <Row label="Amount of last snow (cm)">
          <Field value={snowLastAmt} onChange={(v) => setSnow(setSnowLastAmt, "snow_last_amt_cm", v)} numeric />
        </Row>
        <Row label="Hours since last snow">
          <Field value={snowHrs} onChange={(v) => setSnow(setSnowHrs, "snow_hrs_since", v)} numeric />
        </Row>
        <Segmented
          label="Condition photos taken?"
          options={["Yes", "No"]}
          value={condPhotos}
          onChange={(v) => {
            setCondPhotos(v);
            patchS({ condition_photos: v === "Yes" ? 1 : 0 });
          }}
        />

        <Text style={styles.subsection}>AIRCRAFT &amp; PILOT (all legs)</Text>
        <Row label="Air charter company">
          <Field
            value={charterCo}
            onChange={(v) => {
              setCharterCo(v);
              patchS({ air_charter_co: v.trim() || null });
            }}
          />
        </Row>
        <Row label="Aircraft">
          <Field
            value={aircraft}
            onChange={(v) => {
              setAircraft(v);
              patchS({ aircraft: v.trim() || null });
            }}
          />
        </Row>
        <Text style={styles.expLabel}>EXPERIENCE</Text>
        <View style={styles.crewRow}>
          <Text style={styles.crewLabel}>Pilot</Text>
          <TextInput
            style={styles.crewName}
            value={pilotName}
            onChangeText={(v) => {
              setPilotName(v);
              patchS({ pilot: v.trim() || null });
            }}
            placeholder="name"
            placeholderTextColor={COLORS.muted}
          />
          <SegmentedMini
            options={["A", "B", "C"]}
            value={pilotExp}
            onChange={(v) => {
              setPilotExp(v as Experience);
              patchS({ pilot_rating: v });
            }}
          />
        </View>
      </View>

      <Text style={styles.section}>SURVEY LEGS</Text>
      {legs.map((l) => (
        <View key={l.id} style={styles.card}>
          <View style={styles.legHeader}>
            <Text style={styles.legTitle}>
              Leg {l.survey_leg ?? ""}{" "}
              {!l.ended_at && <Text style={{ color: COLORS.ok, fontSize: 13 }}>· RUNNING</Text>}
            </Text>
            <Text style={styles.legMeta}>
              {timeLabel(l.started_at)} → {timeLabel(l.ended_at)} · waypoints {legWptRange(l)}
            </Text>
          </View>

          <Row label="Start time (MST)">
            <TimeField value={timeLabel(l.started_at)} onCommit={(t) => commitLegTime(l, "start", t)} />
          </Row>
          <Row label="End time (MST)">
            <TimeField value={l.ended_at ? timeLabel(l.ended_at) : ""} onCommit={(t) => commitLegTime(l, "end", t)} />
          </Row>

          <Segmented
            label="Area"
            options={["North", "South"]}
            value={l.area ?? ""}
            onChange={(v) => setLeg(l.id, { area: v })}
          />

          <Text style={styles.expLabel}>EXPERIENCE</Text>
          {CREW_SLOTS.filter((s) => s.key !== "pilot").map((slot) => (
            <View key={slot.key} style={styles.crewRow}>
              <Text style={styles.crewLabel}>{slot.label}</Text>
              <TextInput
                style={styles.crewName}
                value={l[slot.key].name}
                onChangeText={(v) => setCrew(l.id, slot.key, { name: v })}
                placeholder="name"
                placeholderTextColor={COLORS.muted}
              />
              <SegmentedMini
                options={["A", "B", "C"]}
                value={l[slot.key].exp}
                onChange={(v) => setCrew(l.id, slot.key, { exp: v as Experience })}
              />
            </View>
          ))}

          <Row label="Temperature (°C)">
            <TempField
              value={l.temperature?.toString() ?? ""}
              onChange={(v) => setLeg(l.id, { temperature: numOrNull(v) })}
            />
          </Row>
          <Row label="Cloud cover (%)">
            <Field
              value={l.cloud_pct?.toString() ?? ""}
              onChange={(v) => setLeg(l.id, { cloud_pct: parseInt(v, 10) || null })}
              numeric
            />
          </Row>
          <Segmented
            label="Light"
            options={["flat", "bright"]}
            value={l.light ?? ""}
            onChange={(v) => setLeg(l.id, { light: v })}
          />
          <Row label="Leg notes">
            <Field value={l.notes ?? ""} onChange={(v) => setLeg(l.id, { notes: v })} />
          </Row>

          <View style={styles.legActions}>
            {!l.ended_at && (
              <Pressable style={styles.stopLegBtn} onPress={() => setLeg(l.id, { ended_at: new Date().toISOString() })}>
                <Text style={styles.stopLegBtnText}>STOP LEG</Text>
              </Pressable>
            )}
            <Pressable style={styles.deleteSmall} onPress={() => removeLeg(l)}>
              <Text style={styles.deleteSmallText}>Delete leg</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.addLegBtn} onPress={addLeg}>
        <Text style={styles.addLegBtnText}>+ Add leg (starts now)</Text>
      </Pressable>
      <Text style={styles.expHint}>
        Experience ratings — A: experienced &amp; current · B: experienced, not current · C: inexperienced
      </Text>

      <Text style={styles.section}>EXPORT</Text>
      <Text style={styles.hint}>
        One ZIP with the sightings CSV, conditions CSV, and GPX tracklog — workbook columns exact.
      </Text>
      <Pressable style={styles.exportBtn} onPress={doExport}>
        <Text style={styles.exportBtnText}>EXPORT ALL DATA</Text>
      </Pressable>

      <Text style={styles.section}>NEW SURVEY</Text>
      <Pressable style={styles.newSurveyBtn} onPress={startNewSurvey}>
        <Text style={styles.newSurveyBtnText}>Close out this survey and start a new one</Text>
      </Pressable>

      <Text style={styles.section}>PAST SURVEYS</Text>
      <Pressable
        style={styles.pastBtn}
        onPress={() => {
          setPastList(listSessions());
          setShowPast(true);
        }}
      >
        <Text style={styles.pastBtnText}>Manage past surveys…</Text>
      </Pressable>
      <Text style={styles.expHint}>Load, export, or delete previous surveys. Closed surveys are read-only once loaded.</Text>

      <Modal visible={showPast} animationType="fade" transparent onRequestClose={() => setShowPast(false)}>
        <Pressable style={styles.pastBackdrop} onPress={() => setShowPast(false)}>
          <Pressable style={styles.pastPanel} onPress={() => undefined}>
            <Text style={styles.pastTitle}>Manage past surveys</Text>
            <ScrollView style={{ alignSelf: "stretch" }} contentContainerStyle={{ gap: 6 }}>
              {pastList.map((s) => {
                const t = mstParts(new Date(s.started_at));
                const label = `${t.year}-${pad2(t.month)}-${pad2(t.day)} ${pad2(t.hour)}:${pad2(t.minute)}`;
                const current = s.id === session.id;
                return (
                  <View key={s.id} style={[styles.pastRow, current && styles.pastRowCurrent]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pastRowText}>{label}</Text>
                      <Text style={styles.pastRowMeta}>
                        {s.n} waypoints · {s.ended_at ? "closed" : "open"}
                        {current ? " · loaded" : ""}
                      </Text>
                    </View>
                    <View style={styles.pastActions}>
                      <Pressable
                        style={[styles.pastAction, styles.pastActionLoad]}
                        onPress={() => {
                          setShowPast(false);
                          if (!current) onPastSurveySelected(s.id);
                        }}
                      >
                        <Text style={styles.pastActionText}>LOAD</Text>
                      </Pressable>
                      <Pressable style={[styles.pastAction, styles.pastActionExport]} onPress={() => exportPast(s.id)}>
                        <Text style={styles.pastActionText}>EXPORT</Text>
                      </Pressable>
                      <Pressable style={[styles.pastAction, styles.pastActionDelete]} onPress={() => deletePast(s)}>
                        <Text style={[styles.pastActionText, { color: COLORS.bad }]}>DELETE</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Pressable style={styles.pastClose} onPress={() => setShowPast(false)}>
              <Text style={styles.pastCloseText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Field({
  value,
  onChange,
  numeric,
}: {
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
}) {
  // local draft; commits only when the field loses focus
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextInput
      style={styles.field}
      value={text}
      onChangeText={setText}
      onEndEditing={() => onChange(text)}
      keyboardType={numeric ? "numeric" : "default"}
      placeholder="—"
      placeholderTextColor={COLORS.muted}
      selectTextOnFocus
    />
  );
}

/** Temperature: the same digits pad as other numbers, plus a ± toggle for
 *  below-zero entries (Android's numeric pad has no minus key). */
function TempField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const toggleSign = () => {
    const next = text.trim().startsWith("-") ? text.trim().slice(1) : text.trim() === "" ? text : `-${text}`;
    setText(next);
    onChange(next);
  };
  return (
    <View style={styles.signRow}>
      <Pressable style={styles.signBtn} onPress={toggleSign} accessibilityLabel="Toggle sign">
        <Text style={styles.signBtnText}>±</Text>
      </Pressable>
      <TextInput
        style={styles.field}
        value={text}
        onChangeText={setText}
        onEndEditing={() => onChange(text)}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={COLORS.muted}
        selectTextOnFocus
      />
    </View>
  );
}

/** Editable HH:MM field backed by an ISO timestamp; commits on blur/enter. */
function TimeField({ value, onCommit }: { value: string; onCommit: (text: string) => boolean }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]); // external updates (STOP LEG etc.) refresh the field
  return (
    <TextInput
      style={styles.field}
      value={text}
      onChangeText={setText}
      onEndEditing={() => {
        if (!onCommit(text)) setText(value);
      }}
      placeholder="HH:MM"
      placeholderTextColor={COLORS.muted}
      selectTextOnFocus
      keyboardType="numbers-and-punctuation"
    />
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.segRow}>
        {options.map((o) => (
          <Pressable key={o} style={[styles.segBtn, value === o && styles.segOn]} onPress={() => onChange(o)}>
            <Text style={[styles.segText, value === o && { color: COLORS.bg }]}>{o}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SegmentedMini({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segRow}>
      {options.map((o) => (
        <Pressable key={o} style={[styles.miniBtn, value === o && styles.segOn]} onPress={() => onChange(o)}>
          <Text style={[styles.miniText, value === o && { color: COLORS.bg }]}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { color: COLORS.muted, fontSize: 13, fontWeight: "800", letterSpacing: 1.5, marginTop: 10 },
  subsection: { color: COLORS.accent, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 4 },
  expLabel: { color: COLORS.muted, fontSize: 11, alignSelf: "flex-end", marginRight: 2 },
  expHint: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  card: {
    alignSelf: "stretch",
    backgroundColor: COLORS.panel,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  signRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  signBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  signBtnText: { color: COLORS.accent, fontSize: 20, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowLabel: { color: COLORS.text, fontSize: 15, flex: 1 },
  field: {
    width: 170,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 16,
    padding: 8,
    textAlign: "center",
  },
  segRow: { flexDirection: "row", gap: 8 },
  segBtn: {
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: COLORS.bg,
  },
  segOn: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  segText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  miniBtn: {
    borderWidth: 2,
    borderColor: COLORS.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.bg,
  },
  miniText: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  legHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  legTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  legMeta: { color: COLORS.muted, fontSize: 13 },
  crewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  crewLabel: { color: COLORS.text, fontSize: 14, width: 170 },
  crewName: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 8,
    backgroundColor: COLORS.bg,
    color: COLORS.text,
    fontSize: 15,
    padding: 6,
  },
  legActions: { flexDirection: "row", gap: 10, marginTop: 4, alignItems: "center" },
  stopLegBtn: {
    backgroundColor: COLORS.warn,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
    minWidth: 150,
    alignItems: "center",
  },
  stopLegBtnText: { color: COLORS.bg, fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  deleteSmall: { borderWidth: 1, borderColor: COLORS.bad, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  deleteSmallText: { color: COLORS.bad, fontSize: 14, fontWeight: "700" },
  addLegBtn: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  addLegBtnText: { color: COLORS.accent, fontSize: 16, fontWeight: "800" },
  newSurveyBtn: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: COLORS.warn,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 24,
  },
  newSurveyBtnText: { color: COLORS.warn, fontSize: 16, fontWeight: "800" },
  hint: { color: COLORS.muted, fontSize: 13, maxWidth: 560 },
  exportBtn: { backgroundColor: COLORS.ok, borderRadius: 12, paddingVertical: 18, paddingHorizontal: 40, alignSelf: "flex-start" },
  exportBtnText: { color: COLORS.bg, fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  loadedLine: { color: COLORS.muted, fontSize: 13 },
  pastBtn: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  pastBtnText: { color: COLORS.accent, fontSize: 16, fontWeight: "800" },
  pastBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center" },
  pastPanel: {
    width: "70%",
    maxHeight: "80%",
    borderRadius: 16,
    backgroundColor: COLORS.panel,
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  pastTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  pastRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pastRowCurrent: { borderColor: COLORS.accent },
  pastActions: { flexDirection: "row", gap: 6 },
  pastAction: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pastActionLoad: { borderColor: COLORS.accent },
  pastActionExport: { borderColor: COLORS.ok },
  pastActionDelete: { borderColor: COLORS.bad },
  pastActionText: { color: COLORS.text, fontSize: 11, fontWeight: "800" },
  pastRowText: { color: COLORS.text, fontSize: 16, fontWeight: "700" },
  pastRowMeta: { color: COLORS.muted, fontSize: 13 },
  pastClose: { paddingVertical: 8 },
  pastCloseText: { color: COLORS.muted, fontSize: 15, fontWeight: "600" },
});
