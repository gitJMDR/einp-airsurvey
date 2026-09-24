# Air Survey — Handoff & Session Summary

*Written 2026-09-20 by Claude Code for future sessions. Read this and `PROJECT-BRIEF.md` before touching anything. The user (Jonathan DeMoor, Elk Island-area park) is a first-time app developer on Windows 11 — explain decisions plainly, he drives everything through Claude Code.*

## Current situation (why you're probably here)

**APK launch crash: DIAGNOSED & FIXED 2026-09-21 (pending device verification).** Build details:

- EAS build `2e0f1071-eca5-4e7a-92a3-225d1137a838` (2026-09-20), profile `preview` (internal distribution, APK) — crashed on launch
- Account `jonathandemoor`, project `@jonathandemoor/airsurvey` (ID `361c2305-3231-43c4-911f-7572faddfdcc`, already linked in app.json)
- **The Android signing keystore lives in the Expo account — NEVER regenerate it**, or installed tablets will refuse updates
- Build command: `cd app && npx eas-cli build --platform android --profile preview` (login already cached on this machine)

**Actual crash reason (via adb logcat, crash buffer):** JS error `Element type is invalid: … got: undefined at LibreMap`. `LibreMap.tsx` was written against the **v10-era API** (`MapLibreGL.MapView`/`ShapeSource`/`LineLayer` off a default export) but the installed `@maplibre/maplibre-react-native` is **v11.3.10**, which exports *named* components with different props: `Map mapStyle`, `Camera center/zoom/duration`, `UserLocation heading`, `GeoJSONSource data`, one generic `Layer type + paint` (kebab-case paint keys). `MapLibreGL.MapView` was `undefined` → React crashed on render. Not a native/init problem at all.

**Fix:** LibreMap.tsx rewritten to the v11 API with real typed imports (so `tsc` now checks the usage) — commit `531239b`. Verification loop that worked: `adb shell am start -n com.einp.airsurvey/.MainActivity` → `adb shell pidof com.einp.airsurvey` (empty = died) → `adb logcat -d -b crash`.

**Debug setup (working, keep):** platform-tools installed at `C:\Users\Jonathan\AppData\Local\Android\Sdk\platform-tools\adb.exe`; tablet `R9WNB009GDJ` has USB debugging authorized on the XPS13. The app can be launched, killed, and crash-read entirely from the PC — no touching the tablet needed.

## What exists (all verified working in Expo Go unless noted)

- **Stack:** Expo SDK 57, React Native 0.86.3, TypeScript, in `app/` (a git repo — 2 commits; commit before builds, EAS requires clean-ish tree)
- **Screens:** map (MARK flow, HUD, 2×2 rail: Σ TOTALS / ☰ REVIEW / ▦ DATA / ⚙ SETUP), Settings, Totals, Review & 9001+ missed obs, Data (metadata/legs/export/sessions)
- **MarkModal** (one editor, three modes: mark/edit/missed): species buttons bottom-left, notes+chips top, count strip + keypad right. Interaction contract is settled and user-confirmed — see "Settled contracts" below
- **Database:** SQLite (`app/src/db.ts`) — sessions, waypoints, tracklog (leg-tagged), legs, settings. Migrations are try/catch ALTERs
- **Exports** (`app/src/export.ts`): one ZIP (jszip) with sightings CSV + conditions CSV + GPX tracklog, dated+timed filenames. Column orders verified against the actual workbook cell refs
- **Sessions:** open/closed; closed = read-only (MARK/prompts/missed-obs gated, dimmed + explained); "Manage past surveys" (load/export/delete); loaded-session pointer in the setting table survives restarts
- **Map:** schematic SVG (pinch/pan/zoom buttons/N↑-H↑-recenter/label toggle/tap-to-edit waypoints) in Expo Go; MapLibre in builds with offline satellite/road basemaps (see loose thread 3), same control cluster via shared `MapControls.tsx` (2×3 grid: SAT N↑ H↑ | 🏭 + −), waypoint labels + tap-to-edit. Transects numbered N→S from #1 (`src/transects.ts` merges same-line segments; validated against the file's own 1..46 names) and labelled along each line. Default zoom = five lines filling the screen (flown + two either side; z≈14.0 for the 500 m spacing — beware, that formula once shipped with a 2π units error); double-tap N↑/H↑ re-orients, re-centres and resets to it. **H↑ verified rotating in a moving vehicle 2026-09-22.**
- **Logo:** flying beaver (app/assets/flying-beaver-logo.png, 1254²) — legacy icon + favicon. Adaptive launcher icon uses `flying-beaver-foreground.png` (art at 62% on a transparent 1024² canvas — the circular mask was clipping ears/tail at full bleed; fixed + verified on-device 2026-09-24). Regenerate the padded foreground whenever the logo art changes

## Settled contracts — do not casually change

- **Counts:** Total authoritative once typed by hand; blank/auto total tracks class sum; Unknown = Total − class sum (derived only); classes never overwrite a typed total; over-count blocks Save
- **Keypad:** 123/456/789 / CANCEL-0-SAVE; NO backspace by design — selecting a cell arms replace-on-next-digit, tapping the active cell clears it
- **Templates** (additive): 1B, 2B, 1C, C+C, C+2C, C+Y — from historical frequency (`app/scripts/analyze-classes.mjs`)
- **Comment chips:** row 1 CIRCLED PHOTOS CAPTIVE COLLARED, row 2 CHECK DUP? NOT DUP (from `analyze-comments.mjs`; exported into Comments column in that order)
- **Species:** user-managed list (add/edit/reorder/remove), default order bison elk moose deer coyote dead; rendered column-major (B M C / E D X)
- **Times:** exports use fixed UTC−7 (MST) forever — deliberately immune to Alberta's move to permanent DST; audio/photos stamp civil time (1-h skew post-switch, documented decision)
- **Years:** RecruitmentYear = calendar year of previous June (computed, never typed); ManagementYear = "R-R+1"
- **Data shape:** one waypoint = one species; QC/Transcriber/Distance/Movement columns export empty by design; Area is a **manual per-leg entry only** (the north/south division follows the highway, not a latitude — Jonathan 2026-09-22; blank exports blank, no guessing); crew columns fill from the leg covering the waypoint's time
- **Metadata:** auto-saves (blur-commit for text fields); pilot/aircraft/charter are survey-level; temperature = numeric pad + ± toggle; leg times editable HH:MM MST (empty end re-opens leg); STOP LEG button; ±

## Dev environment facts

- Windows 11, no Mac. Node v24. Python exists at `C:/msys64/ucrt64/bin/python.exe` (bare `python` hits the Store stub; can toggle aliases off)
- **Dev loop:** Expo Go on the tablet → `exp://192.168.0.209:8081` (DHCP reserved for the XPS13's Wi-Fi MAC 9C-B6-D0-96-2E-B7 at router 192.168.0.1). Gotcha: the laptop sometimes sits on the dock's **Ethernet** subnet 192.168.1.x — put it on Wi-Fi for demos
- In-terminal ASCII QR codes don't scan reliably on this tablet — always give the manual URL
- Metro's output file catches device-side errors (task output files under `C:\Users\Jonathan\AppData\Local\Temp\claude\...\tasks\`) — **read the logs before theorizing**; instrumented `[tap]` logging turned one bug hunt into arithmetic
- `npx tsc --noEmit` gates every change; `node scripts/check-sql.js` verifies INSERT placeholder counts

## Loose threads

1. **APK crash** — fixed in `531239b` (maplibre v11 API); awaiting verification on the tablet with the next build. The SvgMap-isolation rebuild was never needed — adb gave the exact answer.
2. Intermittent `NativeDatabase.execSync → NullPointerException` in Metro logs since 2026-09-16 — unexplained, app works around it; investigate if it resurfaces meaningfully
3. ~~Offline satellite imagery~~ **Done 2026-09-21** (`b539a99`): no MBTiles needed — Esri raster XYZ styles (World Imagery + World Street Map, no API key) defined in `src/offline-maps.ts`, written to Documents at first launch (with the label font, embedded base64 in `src/font-pbf.ts`), and downloaded as MapLibre OfflineManager packs over flight-line bounds + ~2 km margin (satellite z11–16 ~170 MB, roads z11–15 ~40 MB). Download UI lives on SETUP (builds only); SAT/ROAD toggle button on the map persists in settings. **Verified on device 2026-09-22: cold start with Wi-Fi+data disabled renders imagery, flight lines, waypoints, labels — screenshot `tablet-offline.png`.** Esri attribution is carried in the styles; re-check terms if the app ever goes public
4. ~~Area boundary latitude 53.567 needs verification~~ **Resolved 2026-09-22:** the division follows the highway, not a latitude — Area is manual per-leg entry only; the latitude fallback was removed from exports
5. ~~GIS/analyst sign-off~~ **Signed off 2026-09-24 — Jonathan is the GIS/analyst.** Export data verified in the workbooks; crew fill-down, "Recorded in app" transcriber stamp, and white DATA-screen input fields (bright-sun tap targets) followed from his review. App version bumped to 0.1.1 so colleagues can update over an install (same-version reinstalls can force an uninstall, which wipes data)
6. ~~MapLibre camera controls~~ **Done 2026-09-21** (`7ed679d`): shared `MapControls.tsx` cluster (🏷 +/− N↑ H↑) rendered by both maps; LibreMap drives the v11 Camera imperatively (initial view frozen once — live `center` props would fight the user's finger; H↑ = `trackUserLocation="course"`, N↑ = `easeTo` bearing 0 + recenter). Waypoint labels = symbol layer on demotiles' "Open Sans Semibold" font (re-check the font when the offline style pack lands); 9001+ pins grey; tap-a-pin opens the editor. Build 597ff676 installed; buttons/labels/toggle confirmed on-device. **H↑ rotates only while moving** (course-of-travel by design — compass is useless in a helicopter); stationary it stays north-up. Verify rotation on a drive test; if it stays north-up at driving speed, that's a real bug. Demotiles background is country-scale data — blueish-blank at park zoom is expected, not a fault

## Lessons learned (in roughly the order they cost us)

1. **Column-letter sorting:** `localeCompare` puts "AA" before "B" — nearly shipped a shuffled export order (QC in column B). Excel columns sort by length-then-letters. The header extractor `scripts/parse-workbook-headers.mjs` now does it right.
2. **Hand-written SQL drifts:** a 22-column INSERT with 21 placeholders shipped and only died on a real save. `scripts/check-sql.js` now machine-verifies every INSERT.
3. **Stale closures:** PanResponder is created once, so its handlers captured first-render positions — waypoint taps missed by 100–300 px after any pan/zoom. Route everything through refs in create-once handlers.
4. **Rebuilt-per-render props as effect deps:** `initial={draftFromWaypoint(w)}` re-fires a reset effect every GPS second, wiping in-progress edits. Read through refs on open only.
5. **Controlled inputs + per-keystroke persistence** eat intermediate states ("-", "1."). Local drafts, commit on blur (or when parseable).
6. **Screens own state at their peril:** the DATA screen updated its own leg list + DB but not the app's copy — legs "vanished" after a map visit. Push mutations up to the parent.
7. **Android 15 edge-to-edge:** system bars draw over the app. Safe-area insets everywhere; the provider must WRAP consumers (a component can't consume its own context).
8. **Silent native failures:** the Google map layer died without a word in Expo Go (browser maps + GPS fine). We shipped an SVG schematic fallback and moved real mapping to MapLibre in builds.
9. **Device testing is the only testing:** the boot-order crash, placeholder bug, SafeAreaProvider crash, and edit-wipe bug were all invisible to tsc and bundle checks.
10. **EAS first-build flow:** git repo required (EAS refuses without it), `eas init --account … --non-interactive` pre-registers the project, and the keystore can be cloud-generated without a prompt.
11. **Agent self-note:** when a tool repeatedly returns "not found," the state is already clean — stop retrying and move on. (This cost a regrettable stretch of no-op calls on 2026-09-20.)
12. **`as any` disables your smoke detector:** LibreMap's `require(...) as any` hid the maplibre API mismatch from `tsc` — v11's named-export API vs v10-style `MapLibreGL.*` calls — and the app crashed on first render in the field. Real imports + real types would have caught it at `npx tsc --noEmit` time. When a library is only reachable through an `any` escape hatch, read its installed `src/index.ts` exports before writing a line against it.

## File map

- `PROJECT-BRIEF.md` — approved scope; `MORNING-REPORT.md` — the overnight-build report + old assumption table
- `USER-GUIDE.md` — full plain-language operating guide (all screens/flows); `PROTOCOL-STEPS.md` — insert sections for the survey + data management protocol docx files; `REBUILD-SPEC.md` — implementation-neutral feature spec for re-creating the app (features only, Jonathan-requested items marked **[J]**). All written 2026-09-24 against v0.1.0 — keep them in sync with behaviour changes.
- `app/` — the Expo project (App.tsx shell; src/screens/*; src/components/{MarkModal,MapCanvas,SvgMap,LibreMap,ScreenShell}; src/{db,export,time,settings,types,theme}; scripts/)
- `reference material/` — protocol docx, blank paper sheet (PDF text won't extract), both master workbooks, flight lines GPX
- `air survey app mockup.png` — Jonathan's original sketch
