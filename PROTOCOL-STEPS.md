# Air Survey app — protocol insert

*Steps for insertion into the Aerial Ungulate Monitoring Survey Protocol (field procedure) and the data management protocol (data handling). Written 2026-09-24 against app version 0.1.0. Companion documents: USER-GUIDE.md (full operating detail), REBUILD-SPEC.md (feature specification).*

---

## A. Survey protocol insert — using the tablet in flight

### One-time tablet setup (well before the survey)

1. Install the Air Survey app from the shared APK.
2. On Wi-Fi: app → ⚙ SETUP → OFFLINE MAPS → Download *Satellite imagery* (~1 GB, high-resolution) and *Road map* (~50 MB). One-time per tablet; after this no connection is needed in the field. (Updating from an app version before 0.2.0? Remove and re-download each pack once.)
3. In SETUP, confirm the species list, units (km/h · m or kt · ft), and target speed/altitude with tolerances.
4. Verify the tablet obtains a GPS fix outdoors and that flight lines #1–#46 display on the map.

### Pre-flight

5. Confirm the tablet is charged and on a charger mount for the flight; the screen stays awake automatically.
6. Open the app; a new survey session starts automatically. Check the HUD reads a GPS fix.
7. ▦ DATA: enter the survey-level fields — snow depth/amount/hours-since, air charter company, aircraft, pilot — and the crew for the first leg (names + A/B/C ratings, Observer 1 = navigator side, Observer 2 = pilot side). Set **Area (North/South)** for the leg — this is a manual entry each leg.
8. When surveying starts, ensure a leg is running (HUD shows `LEG n · ON`). Press STOP LEG / add a leg at every crew, area, or condition change, and update the new leg's fields.

### In flight

9. On each observation call: press **MARK** (the waypoint number is shown large — announce it for the audio record), tap the species, tap the total, SAVE. Add class counts (Bulls/Yearlings/Cows/Calves) when called — Total auto-fills, Unknown is derived.
10. For circling, photos, captive, collared, or duplicate-check calls, toggle the matching chips in the entry sheet.
11. The map shows flight lines with numbers (#1 = north), the live track (green on-leg / red off-survey), and every marked waypoint. N↑ / H↑ set north-up / heading-up (double-tap either to also reset the zoom to the five-line view).
12. If a sighting needs correcting, tap its pin on the map (or ☰ REVIEW) — edit or delete.

### Post-flight (before leaving the aircraft area)

13. ☰ REVIEW: scan the waypoint list against memory and the audio as time allows; add **missed observations** (9001+, position entered manually) for anything heard but not marked.
14. ▦ DATA: complete leg end times (STOP LEG), temperature, light, cloud %, and notes for each leg; fields auto-save.
15. ▦ DATA → **EXPORT · SAVE TO DEVICE** (or EXPORT · SHARE if a connection is available) → save the ZIP (sightings CSV + conditions CSV + tracklog GPX) to the agreed folder or share it. Works with no connection.

---

## B. Data management protocol insert — replacing the manual data-entry steps

*(Replaces: DNRGPS download, UTC→MST conversion, and manual transcription into the workbooks. DotDotGoose photo counting, the pivot refresh, and the R scripts are unchanged.)*

1. Copy the exported ZIP from the tablet into the annual Data folder (e.g. `...\Aerial Surveys\Data\2026-2027 Aerial Survey`). Unzip — it contains the sightings CSV, the conditions CSV, and the tracklog GPX, all named `airsurvey_DATE_TIME_*`.
2. Open the sightings CSV and paste it at the bottom of the **UngulateSpatial** worksheet (or import the file). No reformatting is required: columns match the sheet exactly; times are already MST; species are lowercase; Unknown, RecruitmentYear, and ManagementYear are already calculated; crew columns are filled from the leg covering each waypoint's time; 9001+ rows are the audio-only missed observations. **Area is only present if it was entered on the leg — fill down manually where blank.** Transcriber and QC remain for manual entry as always.
3. Open the conditions CSV and paste it into the **SurveyConditions** worksheet — one row per survey leg, columns matching exactly.
4. Review the GPX tracklog and waypoints in Google Earth to confirm accuracy and completeness, as before.
5. QC as before: second-person check against the audio; inspect the tracklog and waypoints for possible double-counting (same-size groups, same area, different transects); review photos of large groups in DotDotGoose where needed.
6. Proceed with the summary steps (population workbook pivot, R scripts) unchanged.
