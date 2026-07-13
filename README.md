# Crack & Rack — Trad Gear Sizing Trainer

A single-page browser game for building intuition about which cam fits which crack.
It shows a crack at its **true real-world width** on your screen and asks you to pick
the right piece of gear. First pass uses the **Wild Country Friends 2026** range.

## How it works

1. **Calibrate** — tell the game how many pixels equal a millimetre on your screen,
   using either a credit card (held **portrait**, 54 × 85.6 mm) or a ruler held against
   the display. Saved in your browser (`localStorage`) so you only do it once per device;
   saving jumps you straight into the game.
2. **Play** — a crack appears at true size. Pick the cam you'd place.
   - **Best fit** (crack near the middle of the cam's range) → full points, green ✓.
   - A cam that fits but isn't ideal → partial points, amber ✓.
   - A cam that won't hold → no points, red ✗.
   - **Difficulty** (in the header): **Easy** shows widths near the middle of a cam's
     range (clear answers); **Hard** draws from anywhere across the full rack and tilts
     the crack to a random angle.
   - Score and streak show in the top corners of the crack window; tap the yellow **❯**
     to advance.
3. **Study** — a reference chart of every cam's range and where they overlap.

## Run locally

No build step, no dependencies. Just open the file:

```
open index.html          # macOS
```

Or double-click `index.html`. (Data is loaded from `cams.js` as a plain script, so it
works over `file://` — no local server needed.)

## Deploy to GitHub Pages

1. Create a repo and push these files to the default branch:
   ```
   git init && git add . && git commit -m "Crack & Rack trainer"
   git branch -M main
   git remote add origin git@github.com:<you>/<repo>.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**,
   pick `main` / `/ (root)`, save.
3. Your game will be live at `https://<you>.github.io/<repo>/`.

## Files

| File            | Purpose                                                        |
|-----------------|----------------------------------------------------------------|
| `index.html`    | Page structure (calibrate / play / study panels)              |
| `style.css`     | Rock-wall and UI styling                                       |
| `cams.js`       | Cam data as a global `CAMS` (runtime source)                  |
| `data/cams.json`| Canonical, human-readable copy of the cam data                |
| `game.js`       | Calibration, rounds, scoring, rendering, study mode           |

## Cam data (Wild Country Friends 2026)

| Size | Colour | Range (mm)     |
|------|--------|----------------|
| 0.3  | Blue   | 15.1 – 21.1    |
| 0.4  | Silver | 16.9 – 23.6    |
| 0.5  | Purple | 22.0 – 31.0    |
| 0.75 | Green  | 27.5 – 38.7    |
| 1    | Red    | 33.9 – 48.1    |
| 2    | Gold   | 44.2 – 62.3    |
| 3    | Blue   | 56.2 – 79.2    |
| 4    | Grey   | 71.3 – 100.8   |

To update or add gear later, edit both `cams.js` (used at runtime) and `data/cams.json`
(kept in sync as the canonical record).
