# Air Survey

<img src="app/assets/flying-beaver-logo.png" width="120" align="left" alt="Air Survey flying beaver logo" style="margin-right:16px;border-radius:16px;"/>

A tablet app for **aerial ungulate surveys**: the navigator in the helicopter records every sighting, the tracklog, and the survey conditions — replacing the handheld GPS **and** the paper data sheet.

Built for the park's Samsung tablets (Android, landscape, held in both hands). Everything works **fully offline** over the survey area; every entry is saved to the device the instant it's recorded; and the exports drop straight into the existing workbook and analysis pipeline with zero reformatting.

<br clear="left"/>

## Highlights

- **Fast sighting capture** — big MARK button → waypoint number → species → count. Total-only by default, one-tap expansion to bulls/yearlings/cows/calves with unknown auto-derived; quick-entry templates from historical class frequencies.
- **Offline maps** — satellite imagery and a road map, downloaded once on Wi-Fi; flight lines numbered north→south and labelled along each line; heading-up mode that rotates with your course of travel.
- **Instruments** — live speed/altitude readouts that go yellow/red outside your survey targets.
- **Survey conditions** — snow data, per-leg crew and experience ratings, times, weather; one row per leg into the conditions worksheet.
- **Faithful exports** — sightings CSV (UngulateSpatial columns, MST, workbook conventions incl. 9001+ audio-only waypoints), conditions CSV, and a GPX tracklog — all in one zipped tap.

## Getting the app

Grab the newest `.apk` from **[Releases](https://github.com/gitJMDR/einp-airsurvey/releases)**, open it on a tablet, and allow "install unknown apps" if asked. **Updating?** Install on top — never uninstall (uninstalling erases un-exported data). On a new tablet, download the offline maps once in the app (SETUP → OFFLINE MAPS).

Full operating detail: **[USER-GUIDE.md](USER-GUIDE.md)** — and a one-page printable cabin card: **[QUICK-CARD.pdf](QUICK-CARD.pdf)**.

## Documentation

| File | What it's for |
|---|---|
| [USER-GUIDE.md](USER-GUIDE.md) | Complete plain-language operating guide |
| [PROTOCOL-STEPS.md](PROTOCOL-STEPS.md) | Insert sections for the survey & data-management protocol documents |
| [REBUILD-SPEC.md](REBUILD-SPEC.md) | Implementation-neutral feature specification (re-create the app with any toolset) |
| [QUICK-CARD.pdf](QUICK-CARD.pdf) / [QUICK-CARD.html](QUICK-CARD.html) | One-page cabin quick reference (print landscape, laminate) |
| [HANDOFF.md](HANDOFF.md) | Development session notes: settled design contracts, lessons, environment |

## Repository layout

- `app/` — the app itself (Expo / React Native / TypeScript; `App.tsx` is the shell, screens and components under `src/`)
- Root `.md`/`.pdf` files — the documentation set above
- Installable builds live in [Releases](https://github.com/gitJMDR/einp-airsurvey/releases), not in the tree

## Building from source

Requires Node and an Expo account (free):

```
cd app
npm install
npx tsc --noEmit        # the type gate every change must pass
npx eas-cli build --platform android --profile preview
```

The Android signing keystore lives in the Expo project — never regenerate it, or installed tablets will refuse updates. Development context and gotchas: [HANDOFF.md](HANDOFF.md).

## License

The app scaffold incorporates Expo's MIT license (see `app/LICENSE`, from the template). The project's own code and documentation are © Jonathan DeMoor — no reuse license is granted at this time.
