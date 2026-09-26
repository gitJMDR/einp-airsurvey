# Air Survey — Feature Specification for Re-creation

*A complete, implementation-neutral description of what the app does, written so it could be rebuilt with any toolset or model. It covers behaviour and rules only — not design, code structure, or technology choices. Where a feature was explicitly requested by Jonathan (rather than inferred), it is marked **[J]**. Written 2026-09-24 against app version 0.1.0.*

---

## 1. Purpose and context

A data collector for aerial ungulate surveys, flown in a helicopter: two observers in the back call sightings over the radio; the navigator in the front holds a ruggedized Android tablet (landscape, both hands) and records. The app replaces a handheld Garmin GPS and a paper data sheet, and must produce data files that feed a 50+-year-old analysis pipeline **without changing that pipeline in any way**.

Users: park staff (navigator-primary), no technical training assumed. Environment: helicopter cabin — vibration, glare, gloves-off but cold fingers, no time for fiddly interactions.

Non-negotiable properties:

1. **Offline-first.** Everything works in airplane mode over the survey area, forever, after a one-time map download on Wi-Fi.
2. **Data durability.** Every entry is persisted to on-device storage the instant it is saved. Crash, power loss, or app kill mid-survey loses nothing already recorded. A partial survey exports cleanly.
3. **Downstream compatibility.** Exports load into the existing workbook sheets with zero manual reformatting, or the app is wrong.
4. **One waypoint = one species observation.** A second species at the same spot gets its own waypoint. Between-transect waypoints are fine and unflagged.

## 2. Core concepts

- **Session** = one survey (typically one flight day). Opens automatically at app start (or by loading a past session); closes deliberately when the survey is done. A closed session is read-only: view and export allowed; marking, editing, and missed-observation additions locked off (controls dimmed with a one-line explanation).
- **Waypoint** = one sighting record: number, position, timestamp, species, counts, flags, notes. Numbered sequentially from 1; **[J]** audio-only additions made post-flight are numbered from 9001 upward (matching the historical convention), drawn distinctly (grey vs yellow on the map).
- **Leg** = a time-bounded survey segment with its own crew and conditions (there may be several per session, e.g. across crew/area/condition changes). Legs become rows in the conditions export and supply crew/area values to waypoints by time.
- **Tracklog** = continuous GPS track, tagged per point as on-leg or off-survey, exportable as GPX.

## 3. Sighting entry (the core flow) — target ≤3 taps / ~5 s for a basic sighting

**[J]** Pressing the big **MARK** button freezes the current GPS position and opens an entry sheet with the **waypoint number displayed prominently** — it is the spoken cross-reference key for the audio recording and observers' notes, so it must be legible at the moment of marking.

**[J] Species buttons**: large, thumb-zone, default order bison, elk, moose, deer, coyote, dead/kill site — rendered column-major so the reading order matches the survey's mental list (B M C / E D X). One species per waypoint. The list is user-managed (add with auto one-letter code / rename / reorder / remove) and changes flow to the entry sheet and exports immediately.

**[J] Count entry is total-only by default**, with a one-step expansion into demographic classes (bulls / yearlings / cows / calves). Exact rules:

- **Total is authoritative once typed by hand.** Nothing overwrites it.
- While Total is blank — or was auto-filled by the rule below — entering class counts auto-fills Total with their sum ("1 cow, 1 calf" alone records total 2).
- **Unknown = Total − class sum**, always derived, never typed.
- Classes exceeding the total blocks SAVE, with the discrepancy shown.
- SAVE requires a species and a total (0 permitted).

**[J] Keypad**: 1-2-3 / 4-5-6 / 7-8-9 with CANCEL · 0 · SAVE. **No backspace by design**: selecting a cell arms replace-on-next-digit; tapping the already-selected cell empties it. Count strip order (matching the workbook's column order): Bulls · Yearlings · Cows · Calves · Unk · Total.

**[J] Additive class templates**: 1B, 2B, 1C, C+C, C+2C, C+Y — chosen from historical frequency analysis of past surveys; presses stack; they obey the Total rules above.

**[J] Comment toggles** (multiple selectable, free text alongside): row 1 CIRCLED · PHOTOS · CAPTIVE · COLLARED; row 2 CHECK · DUP? · NOT DUP — from historical comment frequency; exported into the Comments column in that order.

Cancelling a started entry asks for confirmation; editing reuses the same sheet (plus delete-with-confirm); missed-observation mode adds required manual latitude/longitude fields.

## 4. Map

- **[J] Offline satellite imagery and an offline road map**, downloaded once each on Wi-Fi (a SETUP-screen action with progress and remove), covering the flight-line area plus a ~5 km margin (the whole park, including road corridors). Satellite goes to zoom 17 (~1.2 m/px — one level deeper than the survey-flight default, so corridor imagery stays sharp when inspecting groups); road map to zoom 15; roughly 1 GB and 50 MB respectively. No accounts or API keys; map credit carried on-screen. Everything else (flight lines, track, waypoints, labels) is local data and always works.
- **[J] A basemap toggle button on the map** (satellite ↔ road), remembered across restarts.
- **[J] Flight lines drawn and labelled, numbered north→south from #1** (numbering computed from geometry, not file order; segments of the same physical line share a number). Labels repeat along each line so one is always in view while flying it, and declutter automatically (collision handling) when zoomed out.
- **[J] Orientation buttons N↑ (north-up) and H↑ (heading-up).** EVERY tap of either button: sets that mode, re-centres on the aircraft, and engages follow mode — the position arrow holds steady at screen centre while the map scrolls beneath it. N↑ follows position with the bearing locked level; H↑ follows and rotates to the direction of travel (GPS course, not device compass — compasses are useless in a helicopter; it only rotates while moving). A manual pan/swipe ends follow mode (arrow moves, map stays) until the next tap re-engages it. **[J] Double-tapping either button additionally snaps the zoom to the default.** Snap-back animations are near-instant (~150 ms) — smooth glides read as lag in the cabin.
- **[J] Default zoom = the five-line view**: the line being flown plus two either side, first and fifth near the screen edges (~5 line-gaps of world height; for 500 m spacing ≈ zoom 14 on a 800-unit screen).
- **[J] Zoom +/− buttons and a waypoint-label show/hide toggle**, arranged with the above as a 2×3 grid: left column basemap/N↑/H↑, right column labels/+ /−.
- Pinch-zoom and pan; waypoint pins (yellow, grey for 9001+) labelled `number-CODEtotal` (e.g. `14-E6`); **tapping a pin opens that waypoint in the editor**.
- Live aircraft position marker with accuracy indicator; the track drawn green on-leg / red off-survey.

## 5. Instruments (HUD)

Top-of-screen: GPS quality chip (green < 10 m, yellow < 30 m, red beyond/none), leg status chip, and **[J] live ground-speed and altitude readouts with target values and tolerances set in SETUP — green inside tolerance, yellow in a warning band just outside, red beyond**. **[J] Outside tolerance, a correction arrow (↑ raise / ↓ lower) appears beside the value, coloured identically to it; inside tolerance there is no arrow.** Units switchable (km/h·m ↔ kt·ft) without changing what a stored target means. The next waypoint number is always displayed.

## 6. Flight metadata (per the survey conditions cover sheet)

- Survey-level: average snow depth (cm), amount of last snow, hours since last snow; air charter company; aircraft; pilot; whether condition photos were taken.
- Per leg: crew names + experience ratings (**A** experienced & current, **B** experienced not current, **C** inexperienced) for pilot, navigator, Observer 1 (navigator side), Observer 2 (pilot side); leg start/end times (auto-stamped on start / STOP LEG); temperature; light (flat/bright); cloud %; free notes; first/last waypoint auto-filled.
- **[J] Area (North/South) is a manual per-leg entry only** — the division follows the highway, not a latitude; the app never guesses it, and exports leave it blank rather than infer.
- **[J] Input fields render as white boxes with dark ink** — high-contrast tap targets so crew can see where to enter data in bright sun.
- Fields auto-save as edited; screen stays awake during survey; orientation locked to landscape.

## 7. Review, totals, missed observations

- **Review**: every waypoint with time, species, count, and flag icons; tap to edit/delete; the missed-observation add; and survey close.
- **Totals**: running per-species animals + group counts, explicitly labelled provisional (a mid-flight sanity check, never the official number).
- **Missed observations**: post-flight additions from the audio, numbered 9001+, manual position entry, full editor otherwise identical.

## 8. Export (from the DATA screen, or per past session)

Two output paths produce the identical ZIP: **share** (OS share sheet — email/Drive/anything installed) and **[J] save-to-device** (system folder picker — Downloads, a USB stick, the park's folder — writing an ordinary file that's copyable off the tablet later with no connection at all; cancelling the picker is silent).

A ZIP named `airsurvey_YYYY-MM-DD_HHMM_export.zip` containing:

1. **Sightings CSV** — one row per waypoint, columns exactly:
   `RecruitmentYear, ManagementYear, Waypoint, Year, Month, Day, Hour, Minute, Second, Area, Latitude, Longitude, Species, Total, Bulls, Yearlings, Cows, Calves, Unknown, Distance, Movement, Comments, Navigator, Observer1, Observer2, Transcriber, QC`
2. **Conditions CSV** — one row per leg, columns exactly:
   `RecruitmentYear, ManagementYear, Year, Month, Day, Area, SurveyLeg, LegWptStart, LegWptEnd, LegTimeStart, LegTimeEnd, AirCharterCo, Aircraft, Pilot, PilotRating, Navigator, NavigatorRating, Observer1, Observer1Rating, Observer2, Observer2Rating, Temperature, LightIntensity, PercCloudCover, AvSnowDepth_cm, HrsSinceSnow, AmtLastSnow, Notes`
3. **GPX** — waypoints + tracklog.

Baked-in conventions:

- **Times are MST (UTC−7), fixed, forever** — deliberately immune to any future daylight-time change; the known 1-hour skew vs civil-stamped audio/photos post-change is accepted and documented.
- RecruitmentYear = calendar year of the previous June (Jun–Dec → this year; Jan–May → last year), computed. ManagementYear = "R-R+1", computed.
- Species lowercase; Unknown derived; Distance/Movement/Transcriber/QC empty by design; crew columns filled from the leg covering the waypoint's time; Area from the leg's manual entry.
- Export output paths: OS share sheet, or save-to-device via the system folder picker (works offline).

## 9. Settings

Species management (§3), units, speed/altitude targets + tolerances, offline map pack download/removal with live progress, basemap preference.

## 10. Explicit non-goals

Audio recording (separate hardware wired to the radio), photo counting / DotDotGoose integration, double-count detection aids, any backend/accounts/connectivity dependence, iOS distribution in v1 (keep the codebase portable).

## 11. Acceptance criteria

1. Basic sighting via MARK in ≤3 taps / ~5 s with the waypoint number visible at mark time.
2. Class entry ("6 elk, 1 cow, 1 calf") with auto-unknown via the expanded mode; over-counts blocked.
3. Metadata captures snow data and per-leg crew/conditions; first/last waypoint auto-filled.
4. A full simulated survey day on the ground: stable GPS, screen awake, zero data loss, device on charger.
5. Exports load into UngulateSpatial and SurveyConditions with no manual reformatting; second-person QC.
6. Tracklog + waypoints export as GPX per protocol expectations.
7. Map + flight lines render fully offline; speed/altitude readouts live.
8. Provisional totals match recorded data at any moment.
9. A colleague can install from a shared APK and record a sighting unaided.
10. Settings flow end-to-end: added species appears in the entry sheet and exports; targets drive the readout colours.
