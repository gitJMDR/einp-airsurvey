// On-device database. Everything is persisted the instant it is saved —
// a crash or app kill mid-flight must never lose a sighting (see PROJECT-BRIEF.md).
import * as SQLite from "expo-sqlite";
import type { AppSettings, LegRecord, SessionInfo, SightingDraft, GpsFix, WaypointRecord } from "./types";

const db = SQLite.openDatabaseSync("airsurvey.db");

export function initDb(): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS session (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS waypoint (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      number INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude_m REAL,
      speed_ms REAL,
      accuracy_m REAL,
      species TEXT NOT NULL,
      total INTEGER NOT NULL,
      bulls INTEGER,
      cows INTEGER,
      yearlings INTEGER,
      calves INTEGER,
      photographed INTEGER NOT NULL DEFAULT 0,
      circled INTEGER NOT NULL DEFAULT 0,
      recheck INTEGER NOT NULL DEFAULT 0,
      duplicate INTEGER NOT NULL DEFAULT 0,
      captive INTEGER NOT NULL DEFAULT 0,
      collared INTEGER NOT NULL DEFAULT 0,
      not_dup INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_waypoint_session ON waypoint(session_id);
    CREATE TABLE IF NOT EXISTS tracklog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      altitude_m REAL,
      speed_ms REAL,
      leg INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_track_session ON tracklog(session_id);
    CREATE TABLE IF NOT EXISTS leg (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      area TEXT,
      survey_leg INTEGER,
      pilot TEXT, pilot_rating TEXT,
      navigator TEXT, navigator_rating TEXT,
      observer1 TEXT, observer1_rating TEXT,
      observer2 TEXT, observer2_rating TEXT,
      air_charter_co TEXT,
      aircraft TEXT,
      temperature REAL,
      light TEXT,
      cloud_pct INTEGER,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_leg_session ON leg(session_id);
    CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `);
  // Schema has grown since v0.1 — extend existing installs column by column.
  for (const col of [
    "snow_avg_cm REAL",
    "snow_last_amt_cm REAL",
    "snow_hrs_since REAL",
    "recruitment_year TEXT",
    "management_year TEXT",
    "transcriber TEXT",
    "air_charter_co TEXT",
    "aircraft TEXT",
    "pilot TEXT",
    "pilot_rating TEXT",
    "condition_photos INTEGER",
  ]) {
    // waypoint flag columns added over time; each is a no-op once present
    for (const col of ["duplicate INTEGER NOT NULL DEFAULT 0", "captive INTEGER NOT NULL DEFAULT 0", "collared INTEGER NOT NULL DEFAULT 0", "not_dup INTEGER NOT NULL DEFAULT 0"]) {
      try {
        db.runSync(`ALTER TABLE waypoint ADD COLUMN ${col}`);
      } catch {
        // column already exists
      }
    }
    try {
      db.runSync("ALTER TABLE tracklog ADD COLUMN leg INTEGER NOT NULL DEFAULT 0");
    } catch {
      // column already exists
    }
    try {
      db.runSync(`ALTER TABLE session ADD COLUMN ${col}`);
    } catch {
      // column already exists
    }
  }
}

// ---------- settings ----------

export function loadSettingsJson(key: string): string | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM setting WHERE key = ?", [key]);
  return row?.value ?? null;
}

export function saveSettingsJson(key: string, value: string): void {
  db.runSync("INSERT INTO setting (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    key,
    value,
  ]);
}

// ---------- session ----------

/** The session to open at launch: newest not-yet-ended, else a fresh one. */
export function getOrCreateActiveSession(): SessionInfo {
  const existing = db.getFirstSync<SessionInfo>(
    "SELECT * FROM session WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1"
  );
  if (existing) return existing;
  db.runSync("INSERT INTO session (started_at) VALUES (?)", [new Date().toISOString()]);
  return db.getFirstSync<SessionInfo>("SELECT * FROM session WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1")!;
}

export function getSession(id: number): SessionInfo | null {
  return db.getFirstSync<SessionInfo>("SELECT * FROM session WHERE id = ?", [id]) ?? null;
}

export interface SessionSummary {
  id: number;
  started_at: string;
  ended_at: string | null;
  n: number;
}

export function listSessions(): SessionSummary[] {
  return db.getAllSync<SessionSummary>(
    `SELECT s.id, s.started_at, s.ended_at, COUNT(w.id) AS n
     FROM session s LEFT JOIN waypoint w ON w.session_id = s.id
     GROUP BY s.id ORDER BY s.started_at DESC`
  );
}

/** The survey the app currently has open (null → newest unfinished). */
export function getCurrentSessionId(): number | null {
  const row = db.getFirstSync<{ value: string }>("SELECT value FROM setting WHERE key = 'current-session'");
  return row && row.value !== "null" ? Number(row.value) : null;
}

export function setCurrentSessionId(id: number | null): void {
  saveSettingsJson("current-session", String(id));
}

/** Permanently remove a survey and everything in it. */
export function deleteSession(id: number): void {
  db.runSync("DELETE FROM waypoint WHERE session_id = ?", [id]);
  db.runSync("DELETE FROM tracklog WHERE session_id = ?", [id]);
  db.runSync("DELETE FROM leg WHERE session_id = ?", [id]);
  db.runSync("DELETE FROM session WHERE id = ?", [id]);
}

export function updateSession(id: number, fields: Partial<Omit<SessionInfo, "id" | "started_at">>): void {
  const sets: string[] = [];
  const vals: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    vals.push(v);
  }
  if (!sets.length) return;
  db.runSync(`UPDATE session SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
}

export function endSession(id: number): void {
  db.runSync("UPDATE session SET ended_at = ? WHERE id = ?", [new Date().toISOString(), id]);
}

// ---------- waypoints ----------

const WAYPOINT_COLS =
  "id, number, recorded_at, latitude, longitude, species, total, bulls, cows, yearlings, calves, photographed, circled, recheck, duplicate, captive, collared, not_dup, notes";

/** Next field waypoint number: 9001+ is reserved for post-flight additions. */
export function nextWaypointNumber(sessionId: number): number {
  const row = db.getFirstSync<{ n: number | null }>(
    "SELECT MAX(number) AS n FROM waypoint WHERE session_id = ? AND number < 9001",
    [sessionId]
  );
  return (row?.n ?? 0) + 1;
}

export function nextMissedNumber(sessionId: number): number {
  const row = db.getFirstSync<{ n: number | null }>("SELECT MAX(number) AS n FROM waypoint WHERE session_id = ?", [
    sessionId,
  ]);
  return Math.max(9001, (row?.n ?? 9000) + 1);
}

export function insertWaypoint(sessionId: number, number: number, fix: GpsFix, d: SightingDraft): void {
  const num = (s: string) => (s === "" ? null : Math.max(0, parseInt(s, 10) || 0));
  db.runSync(
    `INSERT INTO waypoint (
       session_id, number, recorded_at, latitude, longitude, altitude_m, speed_ms, accuracy_m,
       species, total, bulls, cows, yearlings, calves, photographed, circled, recheck, duplicate, captive, collared, not_dup, notes
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      sessionId,
      number,
      new Date(fix.timestamp).toISOString(),
      fix.latitude,
      fix.longitude,
      fix.altitude,
      fix.speed,
      fix.accuracy,
      d.species,
      parseInt(d.total, 10) || 0,
      num(d.classes.bulls),
      num(d.classes.cows),
      num(d.classes.yearlings),
      num(d.classes.calves),
      d.photographed ? 1 : 0,
      d.circled ? 1 : 0,
      d.recheck ? 1 : 0,
      d.duplicate ? 1 : 0,
      d.captive ? 1 : 0,
      d.collared ? 1 : 0,
      d.notDup ? 1 : 0,
      d.notes.trim() || null,
    ]
  );
}

/** For post-flight 9001+ additions where no live GPS fix exists. */
export function insertWaypointAtCoords(
  sessionId: number,
  number: number,
  recordedAt: Date,
  latitude: number,
  longitude: number,
  d: SightingDraft
): void {
  const fix: GpsFix = { latitude, longitude, accuracy: null, altitude: null, speed: null, heading: null, timestamp: recordedAt.getTime() };
  insertWaypoint(sessionId, number, fix, d);
}

export function updateWaypoint(id: number, d: SightingDraft): void {
  const num = (s: string) => (s === "" ? null : Math.max(0, parseInt(s, 10) || 0));
  db.runSync(
    `UPDATE waypoint SET species = ?, total = ?, bulls = ?, cows = ?, yearlings = ?, calves = ?,
       photographed = ?, circled = ?, recheck = ?, duplicate = ?, captive = ?, collared = ?, not_dup = ?, notes = ? WHERE id = ?`,
    [
      d.species,
      parseInt(d.total, 10) || 0,
      num(d.classes.bulls),
      num(d.classes.cows),
      num(d.classes.yearlings),
      num(d.classes.calves),
      d.photographed ? 1 : 0,
      d.circled ? 1 : 0,
      d.recheck ? 1 : 0,
      d.duplicate ? 1 : 0,
      d.captive ? 1 : 0,
      d.collared ? 1 : 0,
      d.notDup ? 1 : 0,
      d.notes.trim() || null,
      id,
    ]
  );
}

export function deleteWaypoint(id: number): void {
  db.runSync("DELETE FROM waypoint WHERE id = ?", [id]);
}

export function getWaypoints(sessionId: number): WaypointRecord[] {
  return db.getAllSync<WaypointRecord>(
    `SELECT ${WAYPOINT_COLS} FROM waypoint WHERE session_id = ? ORDER BY number`,
    [sessionId]
  );
}

// ---------- tracklog ----------

export function insertTrackPoint(sessionId: number, fix: GpsFix, leg = false): void {
  db.runSync(
    "INSERT INTO tracklog (session_id, recorded_at, latitude, longitude, altitude_m, speed_ms, leg) VALUES (?,?,?,?,?,?,?)",
    [sessionId, new Date(fix.timestamp).toISOString(), fix.latitude, fix.longitude, fix.altitude, fix.speed, leg ? 1 : 0]
  );
}

interface TrackPointRow {
  recorded_at: string;
  latitude: number;
  longitude: number;
  altitude_m: number | null;
  leg: number;
}
export function getTracklog(sessionId: number): TrackPointRow[] {
  return db.getAllSync<TrackPointRow>(
    "SELECT recorded_at, latitude, longitude, altitude_m, leg FROM tracklog WHERE session_id = ? ORDER BY id",
    [sessionId]
  );
}

// ---------- legs ----------

interface LegRow {
  id: number;
  session_id: number;
  started_at: string | null;
  ended_at: string | null;
  area: string | null;
  survey_leg: number | null;
  pilot: string | null;
  pilot_rating: string | null;
  navigator: string | null;
  navigator_rating: string | null;
  observer1: string | null;
  observer1_rating: string | null;
  observer2: string | null;
  observer2_rating: string | null;
  air_charter_co: string | null;
  aircraft: string | null;
  temperature: number | null;
  light: string | null;
  cloud_pct: number | null;
  notes: string | null;
}

function toLegRecord(r: LegRow): LegRecord {
  const crew = (name: string | null, exp: string | null) => ({ name: name ?? "", exp: (exp ?? "A") as LegRecord["pilot"]["exp"] });
  return {
    id: r.id,
    session_id: r.session_id,
    started_at: r.started_at,
    ended_at: r.ended_at,
    area: r.area,
    survey_leg: r.survey_leg,
    pilot: crew(r.pilot, r.pilot_rating),
    navigator: crew(r.navigator, r.navigator_rating),
    observer1: crew(r.observer1, r.observer1_rating),
    observer2: crew(r.observer2, r.observer2_rating),
    air_charter_co: r.air_charter_co,
    aircraft: r.aircraft,
    temperature: r.temperature,
    light: r.light,
    cloud_pct: r.cloud_pct,
    notes: r.notes,
  };
}

export function getLegs(sessionId: number): LegRecord[] {
  return db.getAllSync<LegRow>("SELECT * FROM leg WHERE session_id = ? ORDER BY id", [sessionId]).map(toLegRecord);
}

export function insertLeg(sessionId: number, startedAt: Date): number {
  db.runSync("INSERT INTO leg (session_id, started_at, survey_leg) VALUES (?,?,?)", [
    sessionId,
    startedAt.toISOString(),
    getLegs(sessionId).length + 1,
  ]);
  const row = db.getFirstSync<{ id: number }>("SELECT id FROM leg WHERE session_id = ? ORDER BY id DESC LIMIT 1", [
    sessionId,
  ]);
  return row!.id;
}

export function updateLeg(id: number, l: LegRecord): void {
  db.runSync(
    `UPDATE leg SET started_at = ?, ended_at = ?, area = ?, survey_leg = ?,
       pilot = ?, pilot_rating = ?, navigator = ?, navigator_rating = ?,
       observer1 = ?, observer1_rating = ?, observer2 = ?, observer2_rating = ?,
       air_charter_co = ?, aircraft = ?, temperature = ?, light = ?, cloud_pct = ?, notes = ?
     WHERE id = ?`,
    [
      l.started_at,
      l.ended_at,
      l.area,
      l.survey_leg,
      l.pilot.name || null,
      l.pilot.exp,
      l.navigator.name || null,
      l.navigator.exp,
      l.observer1.name || null,
      l.observer1.exp,
      l.observer2.name || null,
      l.observer2.exp,
      l.air_charter_co || null,
      l.aircraft || null,
      l.temperature,
      l.light,
      l.cloud_pct,
      l.notes || null,
      id,
    ]
  );
}

export function deleteLeg(id: number): void {
  db.runSync("DELETE FROM leg WHERE id = ?", [id]);
}
