# Air Survey — User Guide

*For the navigator and anyone else using the app on a survey. Written 2026-09-24 against app version 0.1.0. Plain language throughout — no technical background needed.*

---

## What this app is

Air Survey replaces the handheld Garmin GPS **and** the paper data sheet in the helicopter. You hold the tablet in landscape (both hands), the observers in back call out sightings over the radio, and you press **MARK** for each one. The app records the position, the time, and the counts; it draws your track and every sighting on an offline map as you fly; and when you land it hands you the data files that drop straight into the existing workbooks — no transcription, no UTC→MST math.

Three promises worth knowing about:

- **Nothing is lost.** Every sighting is written to the tablet's storage the instant you press SAVE. A crash, a dead battery mid-flight, or killing the app loses nothing already recorded. Paper stays aboard as the fallback you switch *to*, not the other way round.
- **It works with zero connection.** The map, flight lines, labels — everything — works in airplane mode over the park. You download the map imagery once on Wi-Fi and never again.
- **The output matches the existing system.** Export files use the exact column names and order the workbooks expect, in MST, with the same conventions (lowercase species, 9001+ for audio-only additions, etc.).

---

## Setup (one time per tablet)

1. Install the app — always the current version, no account needed:
   **github.com/gitJMDR/einp-airsurvey/releases** → newest release → download the `.apk`, open it on the tablet, and allow "install unknown apps" if asked. (A shared APK file works too.)
   **Updating an existing install: install right on top — never uninstall first** (uninstalling erases survey data that hasn't been exported).
2. Connect the tablet to Wi-Fi.
3. Open the app → **⚙ SETUP** → scroll to **OFFLINE MAPS**.
4. Tap **Download** for *Satellite imagery* (~170 MB) and again for *Road map* (~40 MB). Progress shows as a percentage; each row shows **✓ Remove** when done. Do this on a decent connection — it's a one-time download per tablet covering the flight-line area plus a margin.
5. While you're in SETUP, check the species list, units, and survey targets (see [SETUP screen](#setup-screen)).

The app asks for location permission on first launch — allow it. The screen stays awake automatically during a survey; the display is locked to landscape.

---

## The map screen

This is home base. Everything happens over the map.

### Top bar (HUD)

| Element | Meaning |
|---|---|
| **GPS chip** | Signal quality: green under 10 m accuracy, yellow under 30 m, red beyond or no fix ("GPS —"). |
| **LEG chip** | `LEG 3 · ON` (green) when a survey leg is running, `OFF SURVEY` (grey) between legs. |
| **SPD / ALT readouts** | Ground speed and altitude, coloured by your targets: green inside tolerance, yellow in the warning band, red outside. Targets are set in SETUP. |
| **Next waypoint #** | The number the next MARK will get — also shown huge in the entry sheet, since it's the cross-reference for the audio recording and observers' notes. |

### The map itself

- **Background**: satellite imagery by default. The **SAT** button switches to a road map and back; the choice is remembered.
- **Blue lines**: the survey flight lines, numbered **#1 (north) to #46 (south)**. The number labels sit along each line and repeat, so there's always one in view while you fly it; when you zoom out, extra labels are dropped automatically so they never pile up.
- **Coloured track**: where you've been — green while on a running leg, red while OFF SURVEY.
- **Yellow pins**: your sightings, each labelled `waypoint-species codetotal` (e.g. `14-E6` is waypoint 14, six elk). Grey pins are post-flight missed-observation additions (9001+).
- **Arrow + circle**: the aircraft (your live GPS position) and its accuracy.

### Map buttons (bottom-right, 2×3 grid)

| | |
|---|---|
| **SAT / ROAD** | Switch basemap (satellite ↔ road). |
| **N↑** | North-up: map stops rotating, north points up, and it re-centres on the aircraft. |
| **H↑** | Heading-up: the map rotates so your direction of travel points up, following you as you fly. (Needs movement — it can't know your heading while parked.) |
| **🏷** | Show/hide the waypoint labels. |
| **+ / −** | Zoom in / out. |

- **Double-tap N↑ or H↑** (two quick taps on the same button): re-orient, re-centre, **and** reset the zoom to the standard view — five flight lines filling the screen: the one you're on plus two either side.
- Pinch and drag work as usual.
- **Tap a waypoint pin** to reopen and fix that sighting.

### The 2×2 rail (bottom-right corner)

- **Σ TOTALS** — running per-species tallies for a mid-flight sanity check.
- **☰ REVIEW** — the full waypoint list, edits, missed-observation additions, and exports.
- **▦ DATA** — flight metadata: snow conditions, crew, legs.
- **⚙ SETUP** — species, units, targets, offline maps.

### MARK (bottom-left, big)

Press it the moment an observer calls something in. It freezes your current GPS position and opens the entry sheet.

---

## Recording a sighting (the core 3 taps)

1. Observer calls it: *"Six elk — one cow, one calf."*
2. Press **MARK**. The entry sheet opens with the **waypoint number displayed large** — say it aloud for the audio cross-reference.
3. Tap the **species button** (Bison, Elk, Moose, Deer, Coyote, Dead/kill — laid out in a thumb-friendly grid).
4. Tap the count on the **keypad** — usually just the total, e.g. `6`, then **SAVE**.

That's a basic sighting: species + total + position + time, saved instantly.

### The count strip and the total rule

Down the right side: **Bulls · Yearlings · Cows · Calves · Unk · Total**.

- **Total is all you need.** Type it on the keypad and you're done.
- **Total is authoritative once you type it.** Class counts never overwrite it.
- **If you leave Total blank, it tracks the class sum.** Tap the *Cows* cell, type `1`, tap *Calves*, type `1` — Total fills itself with `2`.
- **Unk (unknown) is always derived**: Total minus the classes you entered. You never type it.
- **The classes can't exceed the total.** If they do, you're warned and SAVE is blocked until it adds up.

### Keypad

`1 2 3 / 4 5 6 / 7 8 9` with **CANCEL · 0 · SAVE** along the bottom. There is **no backspace, by design** — gloves, bumps, and panic make backspace a liability:

- Tap a cell to select it; **typing replaces** whatever was in it.
- **Tap the selected cell again to empty it.**

### Quick-entry templates (additive)

Under the count strip: **1B · 2B · 1C · C+C · C+2C · C+Y**. One tap adds that class combination — `1B` adds one bull, `C+C` adds a cow and a calf. They stack (`1B` then `2B` = 3 bulls) and they follow the total rule above.

### Notes and toggles

Top-left of the sheet: a free-text notes box, and two rows of toggle chips:

- Row 1: **CIRCLED · PHOTOS · CAPTIVE · COLLARED**
- Row 2: **CHECK · DUP? · NOT DUP**

Any number can be on; they export into the Comments column.

### Cancelling / editing / deleting

- **CANCEL** asks for confirmation if you've entered anything (so a bump can't silently discard a sighting).
- **Tap a pin on the map** (or a row in REVIEW) to reopen the sheet in edit mode — same layout, plus a **Delete waypoint** button.
- SAVE always requires a species and a count (use `0` for a kill site with no carcass count, if that ever comes up).

---

## Legs and flight metadata (▦ DATA)

The DATA screen has two halves.

### Survey-level (fills the conditions cover sheet)

- Daily snow: average depth (cm), amount of last snow, hours since last snow
- Air charter company, aircraft, pilot name
- Whether condition photos were taken (Yes/No)

Everything auto-saves as you type or on leaving a field.

### One card per survey leg

Each leg records the crew and conditions, and becomes one row in the SurveyConditions worksheet:

- Crew: **Navigator**, **Observer 1 (navigator side)**, **Observer 2 (pilot side)** — names plus experience ratings (**A** experienced & current · **B** experienced, not current · **C** inexperienced)
- **Area** — North or South. This is a **manual entry**: the north/south division follows the highway, so the app deliberately does not guess it from position. Set it once per leg; exports leave it blank if you don't.
- Leg times (start auto-stamps when you add a leg; end when you press **STOP LEG**), temperature, light (flat/bright), cloud %, notes
- First/last waypoint numbers auto-fill from the data

**How legs work in flight**: press **add leg** (or it's started for you at session start) when surveying begins; press **STOP LEG** when you break off. While no leg is running the track draws red and the HUD shows OFF SURVEY.

### Sessions

A survey = a session. It opens when you start the app fresh (or load a past one) and **closes** from REVIEW when you're done. A closed session is read-only — you can still view and export it, but marking and editing are locked off (buttons dim, with an explanation). **Manage past surveys** at the bottom of DATA lets you load, export, or delete previous sessions; the loaded one survives an app restart.

---

## Missed observations (9001+)

Anything heard on the audio but not marked in flight gets added afterwards, using the same convention as always:

1. **☰ REVIEW** → **+ missed obs**.
2. The sheet opens in missed mode: type the **latitude/longitude** for the position (or accept current GPS).
3. Species, counts, notes as usual; SAVE.

These get waypoint numbers from 9001 upward and draw as **grey pins**. They export as normal rows, flagged by their number — same as the paper-era convention.

---

## REVIEW (☰)

The full list of waypoints with time, species, count, and flag icons (↻ circled, 📷 photographed, ⌂ captive, ◉ collared, ✓ check, ⧉ dup?, ≠ not dup). Tap any row to edit or delete it. This is also where **+ missed obs** and the **export** button live, and where you **close the survey** when it's truly done.

## TOTALS (Σ)

Per species: animals counted and number of groups, for the current survey. Clearly labelled as a **provisional mid-survey sanity check** — the official numbers come from the workbook pipeline as always.

---

## Exporting

One button (**Export** on REVIEW, or per-session in *Manage past surveys*). The app builds a ZIP:

- `airsurvey_DATE_TIME_sightings.csv` — one row per waypoint, the full UngulateSpatial column set
- `airsurvey_DATE_TIME_conditions.csv` — one row per leg for SurveyConditions
- `airsurvey_DATE_TIME_track.gpx` — waypoints + the full tracklog

Android's share sheet opens — save it, email it, copy it to USB, whatever you'd do with a photo. From there the files go into the annual data folder and the workbooks per the data management protocol (see PROTOCOL-STEPS.md).

**Conventions baked into the export** (you don't need to think about these):

- All times are **MST (UTC−7), fixed, forever** — deliberately unaffected by any future daylight-time changes. Audio/photos stamp civil time, so after any such change they'd read an hour later than the export times; that's known and accepted.
- **RecruitmentYear** = the calendar year of the previous June (calculated). **ManagementYear** = "R-R+1" (calculated).
- Species names are lowercase; Unknown is calculated; the QC, Transcriber, Distance, and Movement columns are empty by design.
- Crew columns fill from the leg covering each waypoint's time; Area comes from the leg's manual entry.

---

## SETUP (⚙)

- **Species**: the working list (default order: bison, elk, moose, deer, coyote, dead). Add your own (it gets a one-letter code), rename, reorder with ↑/↓, remove. Changes apply immediately to the entry sheet and exports.
- **Units**: km/h + metres, or knots + feet. Targets convert with you — switching units never changes what a target means.
- **Survey targets**: target speed and altitude, each with a tolerance. These drive the HUD's green/yellow/red.
- **Offline maps**: download/remove the satellite and road packs (see Setup above).

---

## If something goes wrong

- **App killed / tablet dies mid-survey**: reopen it; the session and everything saved reappear. The track resumes.
- **No map background**: if you skipped the offline download and have no connection, the map shows a dark background — flight lines, track, and pins still draw. Do the SETUP → OFFLINE MAPS download when back on Wi-Fi.
- **Buttons dimmed with an explanation**: you're in a closed session. Load or start a new one from DATA.
- **GPS red**: wait for a better fix; the app still records with whatever fix it has.
