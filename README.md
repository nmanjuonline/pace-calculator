# Pace / Calc

A single-page, client-side pace calculator for runners and race organizers. Solve pace/time/distance, generate race splits with pacing strategy, predict times across distances, and print a race-day pace band — all with no backend, no build step, and no dependencies beyond jQuery (loaded from CDN).

---

## File structure

```
.
├── index.html      # Markup — all four tool panels, no logic or styling inline
├── styles.css      # All visual styling (theme, layout, tables, print rules)
├── script.js       # All calculation logic and DOM interactivity (jQuery)
└── README.md        # This file
```

Keep all three files in the same folder. `index.html` loads the other two by relative path:

```html
<link rel="stylesheet" href="styles.css">
...
<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="script.js"></script>
```

## How to run

No installation needed. Double-click `index.html` (or open it in any browser) — it works entirely offline except for two CDN calls:

- **jQuery 3.7.1** from `cdnjs.cloudflare.com`
- **Google Fonts** (Oswald, Roboto Mono) from `fonts.googleapis.com`

If you need it fully offline, download those resources locally and update the `<link>`/`<script>` tags in `index.html` to point at local copies.

To host it, upload all four files to any static host (GitHub Pages, S3, Netlify, a plain web server) — no server-side code required.

---

## Features

### 1. Calculator tab
Solves for **pace**, **finish time**, or **distance** — pick which one you want with the "Solve For" toggle, then fill in the other two fields.

| Input | Notes |
|---|---|
| Distance | Presets: 5K, 10K, Half Marathon, Marathon, or Custom (any value) |
| Distance unit | km or mi |
| Finish time | `hh:mm:ss` or `mm:ss` |
| Pace | `mm:ss`, tagged as `/km` or `/mi` |

The result panel always shows all four derived values together: pace, finish time, distance, and speed (in both km/h and mph), so you can cross-check the numbers regardless of which one you solved for.

### 2. Splits & Strategy tab
Generates a full split table for a given distance and target finish time.

- **Split interval** — every 1 km, every 5 km, or every 1 mile.
- **Strategy** — controls how pace is distributed across the race:
  - *Even* — same pace throughout.
  - *Negative split* — starts slower, finishes faster (commonly recommended for most race distances).
  - *Positive split* — starts faster, eases off later.
  - **Strength** (%) sets how aggressive the ramp is, from the first split to the last.
- **Elevation adjustment** — enter total elevation gain (m) over the route and the calculator adds a flat pace penalty (~3.5 sec/km per 10 m of gain), spread across the race.

All splits are rescaled at the end so the cumulative time lands exactly on your target finish time — the strategy shapes the *distribution* of pace, not the total.

**Planned vs. executed** — the split table includes an editable **Actual pace** column. As you run (or afterward, from your watch), type in the pace you actually ran for each split (`mm:ss`, in the same unit — /km or /mi — as the Planned pace column):

- **Actual cumulative** updates live, computed by chaining actual paces together split by split; any split you leave blank is assumed to have been run on-plan, so it doesn't skew later rows.
- **Pace Diff** compares *that split's* actual pace to *that split's* planned pace — faster than planned in mint, slower than planned in red, on-pace in neutral gray. This is per-split, not cumulative, so a fast split shows ahead even if you're still behind overall.
- A summary line under the table separately reports your overall cumulative status — how far ahead/behind schedule you were through the last split you entered a pace for.
- **Clear Actuals** wipes all entered paces and resets the table to plan-only, without regenerating the planned splits.

The generated table also feeds the **Pace Band** tab (planned columns only — actuals aren't included on the printable band).

### 3. Race Predictor tab
Enter one known result (distance + finish time) and get predicted times for 5K, 10K, Half Marathon, and Marathon, using the **Riegel formula**:

```
T2 = T1 × (D2 / D1)^1.06
```

This is a standard, widely-used estimate for translating a result at one distance into an expected result at another, for a similarly-trained effort. It gets less accurate the further apart the distances are (e.g. predicting a marathon from a 5K time) or when there's a large fitness/training gap between the two efforts.

**Heart rate zone mapper** (optional, in the same tab): enter your max HR and an easy-pace reference, and it maps five effort zones — Recovery, Easy/Aerobic, Steady, Threshold, VO2 Max/Hard — to an approximate bpm range and a corresponding pace. This is a rough heuristic based on %HRmax, not a lab-tested lactate-threshold breakdown.

### 4. Training Paces (VDOT) tab
Enter one recent race result (distance + finish time) and it calculates your **VDOT** — a single number representing current running fitness, from Jack Daniels' VDOT running formula — then derives training paces for five workout types:

| Zone | Purpose | Typical %VO2max used |
|---|---|---|
| Easy (E) | Recovery runs, aerobic base, long runs | 70% |
| Marathon (M) | Goal marathon race pace | 84% |
| Threshold (T) | "Comfortably hard" tempo / cruise intervals | 88% |
| Interval (I) | Hard 3–5 min reps, builds VO2max | 98% |
| Repetition (R) | Short (≤2 min) fast reps, builds speed & economy | 105% |

Each pace is shown per km and per mile. Below that, an **Equivalent Race Times** table shows what your current VDOT predicts at 5K/10K/Half/Marathon — a physiologically-grounded alternative to the Riegel estimate in the Race Predictor tab. The two models use different curves and will diverge slightly, especially at the marathon distance.

### 5. Pace Band tab
Takes the splits generated in the **Splits & Strategy** tab and formats them into a compact, printable card:

- Race name and runner/bib label (freeform text fields)
- Distance and goal time summary
- Marker / split pace / cumulative time table

Click **Print / Save as PDF** to print just the band (everything else on the page is hidden via print CSS) — useful for handing out physical pace bands at a race expo or bib collection event.

---

## Calculation reference

| Calculation | Formula / logic |
|---|---|
| Pace | `time ÷ distance` |
| Finish time | `pace × distance` |
| Distance | `time ÷ pace` |
| Speed | `3600 ÷ pace(sec/km)` → km/h; divided by 1.609344 → mph |
| km ↔ mi | `1 mi = 1.609344 km` |
| Race prediction | Riegel: `T2 = T1 × (D2/D1)^1.06` |
| Elevation penalty | `+3.5 sec/km per 10 m of net gain`, spread across the route |
| HR zone pace multipliers | Recovery ×1.25, Easy ×1.00, Steady ×0.90, Threshold ×0.82, VO2 Max ×0.74 (relative to entered easy pace) |
| VO2 from velocity (Daniels & Gilbert) | `VO2 = -4.60 + 0.182258·v + 0.000104·v²` (v in m/min) |
| %VO2max sustainable for duration t (min) | `0.8 + 0.1894393·e^(-0.012778t) + 0.2989558·e^(-0.1932605t)` |
| VDOT | `VO2 ÷ %VO2max`, from a race performance |
| Training pace at zone intensity | Invert the VO2-from-velocity equation using `VO2 = VDOT × intensity%` (E 70%, M 84%, T 88%, I 98%, R 105%) |
| Equivalent race time at VDOT | Solved by bisection — the time at which a given distance yields the same VDOT |

All internal math is done in seconds and km, then converted to the display unit at render time — so switching units doesn't compound rounding errors.

---

## Design system

The visual language is drawn from race scoreboards and bib tags rather than a generic dashboard look:

- **Color** — dark navy/track background (`#122040`) with amber (`#FFB020`) as the primary accent, plus flag-red (`#E24A3B`) and mint (`#5FC9A8`) used sparingly. The pace band flips to a light, high-contrast print layout.
- **Typography** — [Oswald](https://fonts.google.com/specimen/Oswald) (condensed, bold) for headers and labels, echoing bib/stadium signage; [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono) for all numeric values so time/pace columns align on fixed-width digits like a digital timer.
- **Layout** — flat bordered panels (no rounded-card/drop-shadow treatment), tab navigation styled like bib-number toggles, subtle repeating vertical lines in the background evoking lane markings.
- **Motion** — intentionally minimal; panels fade in on switch, nothing animates on hover.

All theme values (colors, spacing) are defined as CSS custom properties at the top of `styles.css` under `:root` — change them there to re-theme the whole tool:

```css
:root{
  --track:#122040;   /* main background */
  --paper:#F4F2EC;   /* primary text / pace band background */
  --amber:#FFB020;   /* primary accent */
  --flag:#E24A3B;    /* secondary accent */
  --mint:#5FC9A8;    /* unused accent, available */
  ...
}
```

---

## Customization ideas

- **Branding for a specific event** — pre-fill `#bRaceName` in `index.html`, or swap `--amber`/`--track` in `styles.css` for event colors.
- **Add more distance presets** — extend the `<select>` options in `index.html` (Calculator, Splits, and Predictor tabs each have their own preset list) and mirror any new fixed distances in the predictor's `targets` array in `script.js`.
- **Change the elevation model** — the constant `3.5` (seconds per km per 10 m gain) lives in the `genSplits` handler in `script.js`.
- **Change HR zone bands** — the `zones` array in the `genZones` handler in `script.js` holds the five zone definitions and their pace multipliers.
- **Adjust VDOT training zone intensities** — the `TRAINING_ZONES` array in `script.js` holds the five zones' names, descriptions, and %VO2max intensities.

---

## Browser support & limitations

- Works in any modern browser (Chrome, Firefox, Safari, Edge). No IE support.
- Fully client-side — no data is saved between sessions; refreshing the page clears all inputs.
- Pace band printing relies on browser print styles (`@media print`); layout may vary slightly between browsers' print preview.
- Riegel predictions, VDOT, and HR zone mapping are all estimates, not physiological measurements — treat them as planning aids, not guarantees. VDOT in particular assumes the input race result reflects your current fitness (a recent, well-paced, near-maximal effort); an old or poorly-paced race will skew the training paces it derives.