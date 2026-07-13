"use strict";

/* ============================================================
   Crack & Rack — trad gear sizing trainer
   ============================================================ */

// ISO/IEC 7810 ID-1 card, shown in PORTRAIT (short side across, long side tall).
const CARD_SHORT_MM = 53.98;         // horizontal dimension in portrait
const CARD_LONG_MM = 85.6;           // vertical dimension in portrait
const DEFAULT_PX_PER_MM = 96 / 25.4; // ~3.78, a 96-dpi guess used only if uncalibrated
const LS_KEY = "cc_pxPerMm";

const state = {
  pxPerMm: null,        // null => uncalibrated
  calMethod: "card",
  view: "calibrate",
  difficulty: "easy",
  score: 0,
  streak: 0,
  target: null,         // { width, fitting:[cam], best:cam, angle }
  answered: false,
  lastBestIdx: -1,      // index (into CAMS) of the previous round's best cam
  simRun: 0,            // how many consecutive rounds have been "similar" size
  counts: CAMS.map(() => 0), // times each cam (by index) has been the answer this session
};

// Anti-repetition: allow a short run of similar sizes, then force a jump.
const SIMILAR_SPREAD = 1;    // cams within this many indices count as "similar"
const MAX_SIMILAR_RUN = 3;   // most consecutive similar rounds before we force variety
const HARD_ANGLE_MAX = 35;   // hard-mode cracks tilt up to ±this many degrees

// Streak "heats up" like a blackbody: dark → dull red → orange → yellow → white-hot,
// indexed by streak (clamped to 10). At 10 a flame appears. [bg, dark-text?]
const STREAK_HEAT = [
  ["rgba(0,0,0,0.45)", false], // 0  (neutral, matches other HUD pills)
  ["#4a0f0f", false],          // 1  ember
  ["#701600", false],          // 2
  ["#93200a", false],          // 3  dull red
  ["#bd3500", false],          // 4
  ["#dd5600", false],          // 5  orange
  ["#f2760f", true],           // 6
  ["#ff961f", true],           // 7  bright orange
  ["#ffb84d", true],           // 8  amber-yellow
  ["#ffd982", true],           // 9  yellow-white
  ["#fff1c4", true],           // 10 white-hot 🔥
];

/* ---------- tiny DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};
const round1 = (n) => Math.round(n * 10) / 10;

/* ---------- cam fit logic ---------- */
function fittingCams(width) {
  return CAMS.filter((c) => width >= c.min && width <= c.max);
}
// "best fit": crack nearest the middle of the cam's range (normalised).
function bestCam(width) {
  const fits = fittingCams(width);
  const pool = fits.length ? fits : CAMS;
  let best = pool[0];
  let bestScore = Infinity;
  for (const c of pool) {
    const half = (c.max - c.min) / 2;
    const d = Math.abs(width - c.center) / half; // 0 = dead centre
    if (d < bestScore) { bestScore = d; best = c; }
  }
  return best;
}

/* ---------- precompute per-difficulty width pools ---------- */
// Sample the rack at 0.1 mm, group each width under the cam that is its answer.
//  - hard: every width across the whole rack (edges included → tougher, plus tilt).
//  - easy: only widths near the MIDDLE of the answer cam's range (the clear cases).
//    Note this puts small-cam centres (0.3 blue, 0.4 silver) inside overlap zones,
//    which is expected — the middle of their range simply is shared with a neighbour.
const EASY_MARGIN = 0.3; // easy widths lie within the central (1 - 2*margin) of a range
function buildPools() {
  const easy = CAMS.map(() => []);
  const hard = CAMS.map(() => []);
  for (let w = RACK_MIN; w <= RACK_MAX; w = round1(w + 0.1)) {
    const idx = CAMS.indexOf(bestCam(w));
    hard[idx].push(w);
    const c = CAMS[idx];
    const R = c.max - c.min;
    if (w >= c.min + EASY_MARGIN * R && w <= c.max - EASY_MARGIN * R) easy[idx].push(w);
  }
  return { easy, hard };
}
const BYCAM = buildPools();
// Cam indices that can actually appear in each difficulty (non-empty pool).
const ACHIEVABLE = {
  easy: BYCAM.easy.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0),
  hard: BYCAM.hard.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0),
};

/* ============================================================
   Calibration
   ============================================================ */
function loadCalibration() {
  const saved = parseFloat(localStorage.getItem(LS_KEY));
  if (saved && saved > 0) state.pxPerMm = saved;
}
function saveCalibration(pxPerMm) {
  state.pxPerMm = pxPerMm;
  localStorage.setItem(LS_KEY, String(pxPerMm));
  refreshCalStatus();
}
function effectivePxPerMm() {
  return state.pxPerMm || DEFAULT_PX_PER_MM;
}
function refreshCalStatus() {
  $("calBanner").hidden = !!state.pxPerMm;
}

// live px/mm computed from whichever calibration control is active
let pendingPxPerMm = null;
function updateCardPreview() {
  const widthPx = parseInt($("cardSlider").value, 10); // portrait: short side across
  const card = $("creditCard");
  card.style.width = widthPx + "px";
  card.style.height = Math.round(widthPx * (CARD_LONG_MM / CARD_SHORT_MM)) + "px";
  pendingPxPerMm = widthPx / CARD_SHORT_MM;
  showPending();
}
function updateRulerPreview() {
  const widthPx = parseInt($("rulerSlider").value, 10);
  const lenMm = Math.max(1, parseFloat($("rulerLen").value) || 100);
  $("rulerLine").style.width = widthPx + "px";
  pendingPxPerMm = widthPx / lenMm;
  showPending();
}
function showPending() {
  $("pxPerMmOut").textContent = round1(pendingPxPerMm);
  $("dpiOut").textContent = "(≈ " + Math.round(pendingPxPerMm * 25.4) + " dpi)";
}

function initCalibration() {
  // method switcher
  document.querySelectorAll(".seg-btn").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      state.calMethod = b.dataset.method;
      const card = state.calMethod === "card";
      $("method-card").hidden = !card;
      $("method-ruler").hidden = card;
      card ? updateCardPreview() : updateRulerPreview();
    });
  });
  $("cardSlider").addEventListener("input", updateCardPreview);
  $("rulerSlider").addEventListener("input", updateRulerPreview);
  $("rulerLen").addEventListener("input", updateRulerPreview);

  $("saveCal").addEventListener("click", () => {
    if (pendingPxPerMm > 0) {
      saveCalibration(pendingPxPerMm);
      setView("play"); // jump straight into the game after saving
    }
  });
  $("resetCal").addEventListener("click", () => {
    localStorage.removeItem(LS_KEY);
    state.pxPerMm = null;
    refreshCalStatus();
  });

  updateCardPreview();
}

/* ============================================================
   View switching
   ============================================================ */
function setView(name) {
  state.view = name;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === name));
  ["play", "study", "calibrate"].forEach((v) =>
    ($("view-" + v).hidden = v !== name));
  if (name === "study") renderStudy();
  if (name === "play" && !state.target) newRound();
}
function initTabs() {
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => setView(t.dataset.view)));
  document.querySelectorAll("[data-goto]").forEach((a) =>
    a.addEventListener("click", (e) => { e.preventDefault(); setView(a.dataset.goto); }));
}

/* ============================================================
   Rounds
   ============================================================ */
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Weighted-random cam index, biased toward the least-shown sizes (1/(count+1)).
// This self-balances over a session while still allowing occasional repeats.
function weightedCam(achievable) {
  let total = 0;
  const w = achievable.map((i) => { const x = 1 / (state.counts[i] + 1); total += x; return x; });
  let r = Math.random() * total;
  for (let k = 0; k < achievable.length; k++) { r -= w[k]; if (r <= 0) return achievable[k]; }
  return achievable[achievable.length - 1];
}

// Size-balanced selection: choose the cam first, then a width within its band.
// The run rule still caps consecutive similar sizes at MAX_SIMILAR_RUN; the first
// draw is kept as a guaranteed fallback so the loop always terminates.
function chooseTarget(diff) {
  const achievable = ACHIEVABLE[diff];
  let camIdx = null, run = 1, fbIdx = null, fbRun = 1;
  for (let tries = 0; tries < 60; tries++) {
    const i = weightedCam(achievable);
    const similar = state.lastBestIdx >= 0 &&
      Math.abs(i - state.lastBestIdx) <= SIMILAR_SPREAD;
    const r = similar ? state.simRun + 1 : 1;
    if (fbIdx === null) { fbIdx = i; fbRun = r; }
    if (r <= MAX_SIMILAR_RUN) { camIdx = i; run = r; break; }
  }
  if (camIdx === null) { camIdx = fbIdx; run = fbRun; }
  state.lastBestIdx = camIdx;
  state.simRun = run;
  state.counts[camIdx] += 1;
  const width = pick(BYCAM[diff][camIdx]);
  const angle = diff === "hard" ? (Math.random() * 2 - 1) * HARD_ANGLE_MAX : 0;
  return { width, best: CAMS[camIdx], angle };
}

function newRound() {
  state.answered = false;
  state.difficulty = $("difficulty").value;
  const { width, best, angle } = chooseTarget(state.difficulty);
  state.target = {
    width,
    fitting: fittingCams(width),
    best,
    angle,
  };
  renderCrack();
  renderGear();
  $("feedback").hidden = true;
  $("verdict").hidden = true;
  $("wallNext").hidden = true;
}

function answer(cam) {
  if (state.answered) return;
  state.answered = true;
  const { width, fitting, best } = state.target;
  const fits = fitting.includes(cam);
  const isBest = cam === best;

  let pts = 0, tag = "wrong", label = "Not a fit";
  if (isBest) { pts = 10; tag = "full"; label = "Best fit! +10"; state.streak += 1; }
  else if (fits) { pts = 5; tag = "partial"; label = "It fits, but not ideal +5"; } // marginal: keeps streak
  else { pts = 0; tag = "wrong"; label = "Won't hold — wrong size"; state.streak = 0; }

  state.score += pts;
  $("score").textContent = state.score;
  updateStreak();

  renderGear(cam);       // lock buttons + colour them
  showVerdict(tag);      // ✓ / ✗ over the crack + in-wall next arrow
  showFeedback(cam, tag, label);
}

// Paint the streak badge along the blackbody ramp; add a flame at 10.
function updateStreak() {
  const s = state.streak;
  const [bg, darkText] = STREAK_HEAT[Math.min(s, STREAK_HEAT.length - 1)];
  const badge = $("streakBadge");
  $("streak").textContent = s;
  badge.style.background = bg;
  badge.style.color = darkText ? "#1a1a1a" : "rgba(255,255,255,0.9)";
  // Glow ramps up with heat; flame + pulse at the top of the scale.
  badge.style.boxShadow = s >= 4
    ? `0 0 ${s * 1.6}px ${Math.floor(s / 4)}px rgba(255, ${90 + s * 14}, 0, 0.65)`
    : "none";
  $("streakFlame").textContent = s >= 10 ? " 🔥" : "";
  badge.classList.toggle("streak-max", s >= 10);
}

// Big check / cross over the crack, plus the yellow next arrow, so a phone user
// gets the result and can advance without scrolling past the cam chart.
function showVerdict(tag) {
  const v = $("verdict");
  v.textContent = tag === "wrong" ? "✗" : "✓";
  v.className = "verdict " + tag;
  v.hidden = false;
  $("wallNext").hidden = false;
}

/* ============================================================
   Rendering — crack
   ============================================================ */
function renderCrack() {
  const px = state.target.width * effectivePxPerMm();
  const crack = $("crack");
  crack.style.width = Math.max(2, px) + "px";
  // Rotating a rectangle preserves its short dimension, so the true perpendicular
  // gap (px) is unchanged by the tilt — only the orientation differs.
  crack.style.transform =
    `translate(-50%, -50%) rotate(${state.target.angle}deg)`;
}

/* ---------- gear buttons ---------- */
function renderGear(chosen) {
  const grid = $("gearGrid");
  grid.innerHTML = "";
  const { fitting, best } = state.target;
  for (const cam of CAMS) {
    const btn = el("button", "gear-btn");
    btn.title = cam.color;
    btn.innerHTML =
      `<span class="swatch" style="background:${cam.colorHex}"></span>` +
      `<span class="gsize">#${cam.size}</span>`;
    if (state.answered) {
      btn.disabled = true;
      if (cam === best) btn.classList.add("correct");
      else if (fitting.includes(cam)) btn.classList.add("fits");
      if (cam === chosen && cam !== best && !fitting.includes(cam))
        btn.classList.add("chosen-bad");
    } else {
      btn.addEventListener("click", () => answer(cam));
    }
    grid.appendChild(btn);
  }
}

/* ---------- feedback + range chart ---------- */
function showFeedback(chosen, tag, label) {
  const { width, best } = state.target;
  $("feedbackText").innerHTML =
    `<span class="tag ${tag}">${label}.</span> ` +
    `The crack is <strong>${round1(width)} mm</strong>. ` +
    `Best fit is <strong>#${best.size} ${best.color}</strong> ` +
    `(range ${best.min}–${best.max} mm).`;
  renderRangeChart($("rangeChart"), width, best);
  $("feedback").hidden = false;
}

function renderRangeChart(container, marker, best) {
  container.innerHTML = "";
  const span = RACK_MAX - RACK_MIN;
  const pct = (mm) => ((mm - RACK_MIN) / span) * 100;
  for (const cam of CAMS) {
    const row = el("div", "rc-row" + (cam === best ? " is-best" : ""));
    row.appendChild(el("div", "rc-label",
      `<span class="swatch" style="background:${cam.colorHex}"></span>#${cam.size}`));
    const track = el("div", "rc-track");
    const bar = el("div", "rc-bar");
    bar.style.left = pct(cam.min) + "%";
    bar.style.width = (pct(cam.max) - pct(cam.min)) + "%";
    bar.style.background = cam.colorHex;
    track.appendChild(bar);
    if (marker != null && marker >= cam.min - span && marker <= cam.max + span) {
      const m = el("div", "rc-marker");
      m.style.left = pct(marker) + "%";
      track.appendChild(m);
    }
    row.appendChild(track);
    container.appendChild(row);
  }
}

/* ============================================================
   Study mode
   ============================================================ */
function renderStudy() {
  renderRangeChart($("studyChart"), null, null);
  const table = $("camTable");
  table.innerHTML =
    "<tr><th>Size</th><th>Colour</th><th>Range (mm)</th><th>Sweet spot</th></tr>";
  for (const cam of CAMS) {
    const tr = el("tr", null,
      `<td><strong>#${cam.size}</strong></td>` +
      `<td><span class="swatch" style="background:${cam.colorHex}"></span>${cam.color}</td>` +
      `<td>${cam.min} – ${cam.max}</td>` +
      `<td>${round1(cam.center)} mm</td>`);
    table.appendChild(tr);
  }
}

/* ============================================================
   Boot
   ============================================================ */
function init() {
  loadCalibration();
  refreshCalStatus();
  updateStreak();
  initCalibration();
  initTabs();
  $("difficulty").addEventListener("change", () => {
    // Fresh coverage sweep + run state when switching difficulty.
    state.counts = CAMS.map(() => 0);
    state.lastBestIdx = -1;
    state.simRun = 0;
    newRound();
  });
  $("nextRound").addEventListener("click", newRound);
  $("wallNext").addEventListener("click", newRound);
  initHeaderCollapse();
  // Start on calibration if never calibrated, otherwise go straight to play.
  setView(state.pxPerMm ? "play" : "calibrate");
}

/* ---------- collapsible header ---------- */
const LS_HEADER = "cc_headerCollapsed";
function setHeaderCollapsed(collapsed) {
  document.body.classList.toggle("header-collapsed", collapsed);
  localStorage.setItem(LS_HEADER, collapsed ? "1" : "0");
}
function initHeaderCollapse() {
  $("collapseBtn").addEventListener("click", () => setHeaderCollapsed(true));
  $("expandBtn").addEventListener("click", () => setHeaderCollapsed(false));
  setHeaderCollapsed(localStorage.getItem(LS_HEADER) === "1");
}
document.addEventListener("DOMContentLoaded", init);
