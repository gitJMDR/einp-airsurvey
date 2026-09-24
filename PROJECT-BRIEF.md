# Air Survey App — Master Brief

*Status: awaiting Jonathan's approval. Compiled 2026-09-15 from the reference material, a 6-question interview, Jonathan's follow-up notes (Mark-popover detail, flight metadata fields, preliminary totals, generic deer), and the platform pivot to Android-first.*

## The job

Build an **Android app** run on the **park's Samsung tablets with built-in GPS**, used by the **navigator in the front seat of the survey helicopter** to replace the handheld Garmin GPS **and** the paper data sheet. The navigator holds it in both hands (landscape, per the mock-up `air survey app mockup.png`); observers in the back call out sightings over the radio.

What the app does:

1. **Live map** — offline-cached imagery for the park, flight lines drawn from `UngulateSurvey_FlightLines.gpx`, and every marked sighting displayed as it's recorded.
2. **Instruments** — live altitude and ground-speed readouts, with target values and tolerances for each set in Settings; a readout turns **yellow** (warning band) or **red** (outside tolerance) when the aircraft drifts off target.
3. **Sighting capture, fast** — the core flow: observer says "6 elk" (or "6 elk, 1 cow, 1 calf"); navigator presses the big **Mark** button, which opens a pop-over entry sheet:
   - **Waypoint number prominently displayed** in the pop-over — it's the cross-reference key for the audio recording and the observers' notes, so it must be visible at the moment of marking (spoken aloud if needed).
   - Big species buttons: elk, moose, bison, deer (generic — no white-tailed/mule split on this survey), coyote, dead/kill site — these are the defaults; additional species can be added in Settings. One waypoint = one species observation; a second species at the same spot gets its own waypoint.
   - Numeric keypad; **default is total count only**. An easy one-step expansion adds demographic counts (bulls/cows/yearlings/calves) when the observer calls them; the app computes *unknown = total − classes*.
   - Standard-note toggle buttons, multiple selectable: **Photographed**, **Circled**, **Check** — plus free text for anything else.
   - Target: a basic sighting in ~3 taps.
4. **Flight metadata screen** (separate from the map):
   - *Survey-level:* daily average snow depth, days since last snow, amount of last snow.
   - *Per survey leg:* pilot, navigator, observer 1 (navigator side), observer 2 (pilot side) — each with name + experience level (A: experienced & current; B: experienced, not current; C: inexperienced); leg start time, temperature, light intensity (flat / bright), cloud cover (%), end time; **first and last waypoint auto-filled**; free-text notes.
5. **Tracklog** — continuous GPS track recorded throughout, exportable as GPX alongside the data export.
6. **Preliminary totals** — a quick per-species running tally of the day's counts (clearly provisional; a mid-survey sanity check, not the official number).
7. **Settings screen** —
   - *Species:* the default list (elk, moose, bison, deer, coyote, dead/kill site) with the ability to add additional species; added species appear as buttons on the Mark pop-over and flow through to export.
   - *Survey targets:* target speed and target altitude, each with a tolerance, driving the instruments' yellow/red colour states.
   - *Units:* readout units for speed and altitude (default: knots and feet ASL, switchable to km/h and metres).
8. **Export** — CSVs matching the existing worksheets exactly:
   - *Sightings* → `UngulateSpatial` columns: waypoint #, Year/Month/Day, Hour/Minute/Second (MST), Area, Latitude, Longitude, Species (lowercase: elk, moose, bison, deer, coyote, dead/kill site), Total, Bulls, Cows, Yearlings, Calves, Unknown, Navigator, Observer1, Observer2, Comments, RecruitmentYear, ManagementYear. Post-flight, allow adding missed (audio-only) observations as 9001+ waypoints, matching current convention. Crew columns auto-fill from the leg's crew, overridable on the day.
   - *Conditions* → the `SurveyConditions` worksheet's one-row-per-leg shape, from the metadata screen (exact column mapping during build).

## The why

- Who: Jonathan and a small group of park colleagues; the field hardware is the park's GPS-equipped Samsung tablets.
- What it enables: data is complete the moment the helicopter lands — no transcription, no waypoint↔paper↔workbook reconciliation, no UTC→MST math, fewer transcription errors (the workbook's comment history shows a decade of them) — and it costs nothing to distribute.
- Continuity: the exports feed the existing pivots, R scripts, and population workbook **unchanged**, so the 50+ year time series stays intact.

## Guardrails

- **v1 is Android-only, on the park's Samsung tablets.** The codebase stays platform-agnostic (Expo), so an iOS build can follow later if iPhones/iPads ever enter the picture (that's when the $99 USD/yr Apple Developer Program and TestFlight enter; until then, $0).
- **No backend, no accounts, no connectivity dependence.** Everything is stored on-device (SQLite) until exported after landing. App installs are direct APK sharing between the tablets — no store needed. (If update hand-out ever gets tedious, a one-time $25 Google Play developer account enables an internal-testing track; optional.)
- **Data durability is non-negotiable.** Every entry is persisted instantly; a crash or app kill mid-flight loses nothing; a partial session exports cleanly. Rationale: paper is only a fallback to *switch to* mid-flight, so the app must never give a reason to.
- **The downstream pipeline does not change.** Export must load into `UngulateSpatial` with zero manual reformatting, or it's wrong. Audio recording stays entirely external (wired into the helicopter radio) — out of scope.
- **UI follows the mock-up's shape**: landscape, map-dominant screen with the Mark button, big forgiving tap targets for a bouncy cabin, readable in glare. No gloves assumption. (Tablet held in both hands — design for that grip.)
- **Future iOS note, kept so it's not re-learned:** WiFi-only iPads have no GPS; only cellular iPads or iPhones could ever be field devices.

## Done means

Ready = the app collects and exports data reliably, has been ground-tested and refined. Jonathan tests on the ground himself (10 years of survey experience, on the actual Samsung tablets), colleagues try it in advance, and each build ships with a short test checklist.

**Exit criteria for v1:**

1. Basic sighting via Mark → pop-over in ≤3 taps / ~5 seconds, with the waypoint number visible at mark time.
2. Class breakdown entry ("6 elk, 1 cow, 1 calf") with auto-unknown remainder via the expanded keypad mode.
3. Flight metadata screen captures survey-level snow data and per-leg crew/conditions; first/last waypoint auto-filled.
4. Full simulated survey day on the ground (driving transects): stable GPS, screen stays awake, zero data loss, device on charger.
5. Export CSVs load into `UngulateSpatial` (and `SurveyConditions`) with no manual reformatting; a second person QC's it (current practice).
6. Tracklog and waypoints export as GPX, matching the protocol's file expectations.
7. Map + flight lines render fully offline; altitude/speed readouts live.
8. Preliminary totals view matches the recorded data at any moment.
9. A colleague can install the app on a park Samsung tablet from a shared APK and record a sighting unaided.
10. Settings work end-to-end: an added species shows up on the Mark pop-over and in exports; speed/altitude targets and tolerances drive the yellow/red readout states.

**Explicitly not in v1:** iOS distribution (buildable but not field-tested), photo-counting/DotDotGoose integration, double-count detection aids.

**Report-back cadence:** live preview via Expo Go on the tablets during development (free); APK builds installed directly as soon as we're past prototypes; each build accompanied by a short checklist.

## Mock-up interpretation (correct me where I've misread)

- Landscape layout; most of the screen is the map with parallel E–W flight lines and numbered marked points along them.
- Big **Mark** button opens the data-entry pop-over (species buttons + numeric keypad, waypoint number shown).
- Top-of-screen readouts for altitude and speed; a notes scribble for special cases (circling, photos).

## Open items (from the blind-spot pass)

1. ~~Conditions cover sheet fields~~ **Resolved by Jonathan's notes** (see §4 of The job). Remaining: map fields to the `SurveyConditions` worksheet's exact column names during build.
2. **Downstream sign-off** — the GIS technician / analyst who runs the pivots and R scripts hasn't blessed an app-produced file; confirm before the first committed survey.
3. **Edge-case conventions — largely resolved by Jonathan (2026-09-15):** multiple species never share a waypoint (each species gets its own); between-transect waypoints are fine, no flagging needed (transects are adjacent; precise location is not a requirement). Remaining: missed-waypoint NA rows (likely obsolete — the app can't create a waypoint without its data; to confirm), waypoint numbering restart rules, Distance/Movement column meanings.
4. ~~Apple account ownership~~ **Deferred** — no Apple account is needed until iOS support is wanted; revisit then (individual vs. organizational).
