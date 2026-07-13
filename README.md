# Crack & Rack — Trad Gear Sizing Trainer

A single-page browser game for building intuition about which cam fits which crack.
It shows a crack at its **true real-world width** on your screen and asks you to pick
the right piece of gear, using real published cam ranges from several manufacturers.

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
3. **Rack** — pick which cam set you're learning (Wild Country Friends 2026 / 2025, Black
   Diamond Camalot C4, Metolius Power Cams, …). The choice is remembered per device and
   its name is shown on the play screen.
4. **Study** — a reference chart of the current set's ranges and where they overlap.

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
| `cams.js`       | Cam sets as a global `CAM_SETS` (runtime source)              |
| `data/cams.json`| Canonical, human-readable copy of the same cam sets           |
| `game.js`       | Calibration, rack switching, rounds, scoring, rendering       |

## Cam data

`data/cams.json` is an array of cam sets, each with `brand`, `family`, `year`, `source`,
`units`, a `displayname` (shown in the Rack menu and on the play screen), and a `cams`
list of `{ size, color, colorHex, min, max }` (expansion range in mm). To add or edit a
set, update **both** `data/cams.json` (canonical) and `cams.js` (loaded at runtime as a
plain script so the game works over `file://` without fetch/CORS). Keep them identical.
