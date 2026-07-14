"use strict";

/* ============================================================
   Crack & Rack — trad gear sizing trainer
   ============================================================ */

// ISO/IEC 7810 ID-1 card, shown in PORTRAIT (short side across, long side tall).
const CARD_SHORT_MM = 53.98;         // horizontal dimension in portrait
const CARD_LONG_MM = 85.6;           // vertical dimension in portrait
const DEFAULT_PX_PER_MM = 96 / 25.4; // ~3.78, a 96-dpi guess used only if uncalibrated
const LS_KEY = "cc_pxPerMm";
const LS_RACK = "cc_rackIndex";
const LS_SEEN_INTRO = "cc_seenIntro"; // "1" once the visitor has seen the intro view
const LS_PINNED = "cc_pinnedCams";    // JSON array of cams retained on the Study page

// All cam sets, loaded once from data/cams.json (the single source of truth).
let CAM_SETS = [];

// The active rack's derived data. Rebuilt by loadRack() whenever the set changes.
let CAMS = [];              // cams of the current set, augmented with center/label
let RACK_MIN = 0, RACK_MAX = 0;
let BYCAM = { easy: [], hard: [] };
let ACHIEVABLE = { easy: [], hard: [] };

const state = {
  pxPerMm: null,        // null => uncalibrated
  calMethod: "card",
  view: "calibrate",
  difficulty: "easy",
  rackIndex: 0,         // index into CAM_SETS (the active Play rack)
  studyIndex: 0,        // index into CAM_SETS (the set shown on the Study page)
  pinned: [],           // cams retained for comparison: {setName,size,color,colorHex,min,max,label}
  score: 0,
  streak: 0,
  target: null,         // { width, fitting:[cam], best:cam, angle }
  answered: false,
  lastBestIdx: -1,      // index (into CAMS) of the previous round's best cam
  simRun: 0,            // how many consecutive rounds have been "similar" size
  counts: [],           // times each cam (by index) has been the answer this session
};

// Anti-repetition: allow a short run of similar sizes, then force a jump.
const SIMILAR_SPREAD = 1;    // cams within this many indices count as "similar"
const MAX_SIMILAR_RUN = 3;   // most consecutive similar rounds before we force variety
const HARD_ANGLE_MAX = 35;   // hard-mode cracks tilt up to ±this many degrees
const DISPLAY_MARGIN = 0.82; // fraction of the wall a crack may span (leaves rock on both edges)

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

// Switch the active cam set: augment its cams, recompute rack range + pools, and
// reset the per-session selection bookkeeping. Persists the choice.
function loadRack(index) {
  index = Math.max(0, Math.min(index, CAM_SETS.length - 1));
  state.rackIndex = index;
  CAMS = CAM_SETS[index].cams.map((c) => ({
    ...c, center: (c.min + c.max) / 2, label: "#" + c.size,
  }));
  RACK_MIN = Math.min(...CAMS.map((c) => c.min));
  RACK_MAX = Math.max(...CAMS.map((c) => c.max));
  BYCAM = buildPools();
  ACHIEVABLE = {
    easy: BYCAM.easy.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0),
    hard: BYCAM.hard.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0),
  };
  state.counts = CAMS.map(() => 0);
  state.lastBestIdx = -1;
  state.simRun = 0;
  localStorage.setItem(LS_RACK, String(index));
}

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

// Cap the card slider so the true-size card can never grow wider than the viewport
// (a real 54 mm card always fits, so this only prevents it running off-screen and
// appearing to grow only vertically). Returns the clamped value.
function clampCardSlider() {
  const s = $("cardSlider");
  const max = Math.max(120, Math.min(600, Math.floor(window.innerWidth - 8)));
  s.max = String(max);
  if (parseInt(s.value, 10) > max) s.value = String(max);
}
// Nudge the card slider by delta px (used by the ‹ Smaller / Bigger › buttons).
function stepCard(delta) {
  const s = $("cardSlider");
  const min = parseInt(s.min, 10), max = parseInt(s.max, 10);
  s.value = String(Math.max(min, Math.min(max, parseInt(s.value, 10) + delta)));
  updateCardPreview();
}
// Press-and-hold repeat: one step on tap, then accelerates while held.
function holdRepeat(btn, delta) {
  let toStart = null, iv = null;
  const stop = () => { clearTimeout(toStart); clearInterval(iv); toStart = iv = null; };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    stepCard(delta);
    toStart = setTimeout(() => { iv = setInterval(() => stepCard(delta), 60); }, 350);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    btn.addEventListener(ev, stop));
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
  holdRepeat($("cardSmaller"), -2);
  holdRepeat($("cardBigger"), 2);

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

  clampCardSlider();
  updateCardPreview();
}

/* ============================================================
   View switching
   ============================================================ */
function setView(name) {
  state.view = name;
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.view === name));
  ["intro", "play", "rack", "study", "calibrate"].forEach((v) =>
    ($("view-" + v).hidden = v !== name));
  if (name === "rack") renderRackMenu();
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

// Largest crack (mm) whose full width fits the wall with rock visible on both edges.
// Returns Infinity if the wall isn't laid out yet (e.g. play view hidden).
function maxDisplayableMm() {
  const wallPx = $("crack").parentElement.clientWidth;
  if (!wallPx) return Infinity;
  return (wallPx * DISPLAY_MARGIN) / effectivePxPerMm();
}
// A cam is "in play" on this screen if any of its answer-widths fits the wall.
function camDisplayable(camIdx, maxMm) {
  return BYCAM[state.difficulty][camIdx].some((w) => w <= maxMm);
}

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
  // Restrict to widths that actually fit the wall; fall back to the unrestricted
  // pool only if the screen is too small to show even the narrowest crack.
  const maxMm = maxDisplayableMm();
  let pools = BYCAM[diff].map((list) => list.filter((w) => w <= maxMm));
  let achievable = pools.map((l, i) => (l.length ? i : -1)).filter((i) => i >= 0);
  if (!achievable.length) { pools = BYCAM[diff]; achievable = ACHIEVABLE[diff]; }
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
  const width = pick(pools[camIdx]);
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
  hideGearNote();
}

function answer(cam) {
  if (state.answered) return;
  state.answered = true;
  const { width, fitting, best } = state.target;
  const fits = fitting.includes(cam);
  const isBest = cam === best;

  // Any cam that actually fits the crack earns full points and keeps the streak;
  // the "best" fit just gets a slightly different message.
  let pts = 0, tag = "wrong", label = "Not a fit";
  if (fits) {
    pts = 10; tag = "full"; state.streak += 1;
    label = isBest ? "Best fit! +10" : "It fits! +10";
  } else {
    pts = 0; tag = "wrong"; label = "Won't hold — wrong size"; state.streak = 0;
  }

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
  const maxMm = maxDisplayableMm();
  CAMS.forEach((cam, i) => {
    const btn = el("button", "gear-btn");
    // Grey out cams too large to display on this screen — they're never an answer.
    const unavailable = !camDisplayable(i, maxMm);
    btn.title = cam.color;
    btn.innerHTML =
      `<span class="swatch" style="background:${cam.colorHex}"></span>` +
      `<span class="gsize">#${cam.size}</span>`;
    if (unavailable) {
      // Not truly disabled (disabled buttons swallow hover/click), so we can
      // explain why on hover or tap instead of just ignoring the press.
      btn.classList.add("unavailable");
      btn.setAttribute("aria-disabled", "true");
      const msg = `#${cam.size} (${cam.color}) won't fit on this screen at true size — ` +
        `rotate to landscape or use a wider window to include it.`;
      btn.addEventListener("mouseenter", () => showGearNote(msg));
      btn.addEventListener("mouseleave", hideGearNote);
      btn.addEventListener("click", () => showGearNote(msg, true));
    } else if (state.answered) {
      btn.disabled = true;
      if (cam === best) btn.classList.add("correct");
      else if (fitting.includes(cam)) btn.classList.add("fits");
      if (cam === chosen && cam !== best && !fitting.includes(cam))
        btn.classList.add("chosen-bad");
    } else {
      btn.addEventListener("click", () => answer(cam));
    }
    grid.appendChild(btn);
  });
}

// Explanation shown when an unavailable (too-large) cam is hovered or tapped.
let gearNoteTimer = null;
function showGearNote(msg, autoHide) {
  clearTimeout(gearNoteTimer);
  const note = $("gearNote");
  note.textContent = "ℹ " + msg;
  note.hidden = false;
  // On tap (no hover-out on touch) auto-dismiss after a few seconds.
  if (autoHide) gearNoteTimer = setTimeout(hideGearNote, 4000);
}
function hideGearNote() {
  clearTimeout(gearNoteTimer);
  $("gearNote").hidden = true;
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

// Low-level bar renderer. `rows` = [{ label, colorHex, min, max, isBest?, pinned? }];
// bars are positioned as a % of the shared [min, max] span so different sets can
// be compared on one axis. `opts.marker` (mm) draws the crack-width line.
function drawRangeBars(container, rows, min, max, opts = {}) {
  container.innerHTML = "";
  const span = (max - min) || 1;
  const pct = (mm) => ((mm - min) / span) * 100;
  for (const r of rows) {
    const row = el("div", "rc-row" +
      (r.isBest ? " is-best" : "") + (r.pinned ? " is-pinned" : ""));
    row.appendChild(el("div", "rc-label",
      `<span class="swatch" style="background:${r.colorHex}"></span>${r.label}`));
    const track = el("div", "rc-track");
    const bar = el("div", "rc-bar");
    bar.style.left = pct(r.min) + "%";
    bar.style.width = (pct(r.max) - pct(r.min)) + "%";
    bar.style.background = r.colorHex;
    track.appendChild(bar);
    if (opts.marker != null && opts.marker >= r.min - span && opts.marker <= r.max + span) {
      const m = el("div", "rc-marker");
      m.style.left = pct(opts.marker) + "%";
      track.appendChild(m);
    }
    row.appendChild(track);
    container.appendChild(row);
  }
}

// In-game / active-rack range chart (scaled to the current rack's own span).
function renderRangeChart(container, marker, best) {
  const rows = CAMS.map((cam) => ({
    label: "#" + cam.size, colorHex: cam.colorHex,
    min: cam.min, max: cam.max, isBest: cam === best,
  }));
  drawRangeBars(container, rows, RACK_MIN, RACK_MAX, { marker });
}

/* ============================================================
   Rack selection
   ============================================================ */
function updateRackName() {
  $("rackName").textContent = CAM_SETS[state.rackIndex].displayname;
}
function renderRackMenu() {
  const list = $("rackList");
  list.innerHTML = "";
  CAM_SETS.forEach((set, i) => {
    const lo = Math.min(...set.cams.map((c) => c.min));
    const hi = Math.max(...set.cams.map((c) => c.max));
    const btn = el("button", "rack-item" + (i === state.rackIndex ? " active" : ""));
    btn.innerHTML =
      `<span class="rack-item-name">${set.displayname}</span>` +
      `<span class="rack-item-meta">${set.brand} · ${set.cams.length} cams · ` +
      `${round1(lo)}–${round1(hi)} mm</span>`;
    btn.addEventListener("click", () => selectRack(i));
    list.appendChild(btn);
  });
}
function selectRack(i) {
  loadRack(i);
  updateRackName();
  state.target = null;   // force a fresh round with the new set
  setView("play");
}

/* ============================================================
   Study mode + cam comparison
   ============================================================ */
function loadPinned() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_PINNED));
    state.pinned = Array.isArray(v) ? v : [];
  } catch { state.pinned = []; }
}
function savePinned() {
  localStorage.setItem(LS_PINNED, JSON.stringify(state.pinned));
}
const pinKey = (setName, size) => setName + " #" + size;
function isPinned(setName, size) {
  return state.pinned.some((p) => pinKey(p.setName, p.size) === pinKey(setName, size));
}
function togglePin(cam, setName) {
  const key = pinKey(setName, cam.size);
  const i = state.pinned.findIndex((p) => pinKey(p.setName, p.size) === key);
  if (i >= 0) state.pinned.splice(i, 1);
  else state.pinned.push({
    setName, size: cam.size, color: cam.color, colorHex: cam.colorHex,
    min: cam.min, max: cam.max, label: setName + " #" + cam.size,
  });
  savePinned();
  renderStudy();
}

function renderStudy() {
  const set = CAM_SETS[state.studyIndex];
  const setName = set.displayname;
  const studyCams = set.cams.map((c) => ({ ...c, center: (c.min + c.max) / 2 }));
  const smin = Math.min(...studyCams.map((c) => c.min));
  const smax = Math.max(...studyCams.map((c) => c.max));

  $("studyTitle").textContent = setName + " — reference";

  // set picker + "make current rack" (disabled when already the active rack)
  $("studySet").innerHTML = CAM_SETS.map((s, i) =>
    `<option value="${i}"${i === state.studyIndex ? " selected" : ""}>${s.displayname}</option>`
  ).join("");
  const isCurrentRack = state.studyIndex === state.rackIndex;
  const useBtn = $("studyUseRack");
  useBtn.disabled = isCurrentRack;
  useBtn.textContent = isCurrentRack ? "✓ Current rack" : "Make current rack";
  useBtn.classList.toggle("is-current", isCurrentRack);

  // range chart, scaled to this set's own span
  drawRangeBars($("studyChart"),
    studyCams.map((c) => ({ label: "#" + c.size, colorHex: c.colorHex, min: c.min, max: c.max })),
    smin, smax);

  // table with a per-cam pin toggle
  const table = $("camTable");
  table.innerHTML =
    "<tr><th>Size</th><th>Colour</th><th>Range (mm)</th><th>Sweet spot</th><th>Compare</th></tr>";
  for (const cam of studyCams) {
    const pinned = isPinned(setName, cam.size);
    const tr = el("tr", null,
      `<td><strong>#${cam.size}</strong></td>` +
      `<td><span class="swatch" style="background:${cam.colorHex}"></span>${cam.color}</td>` +
      `<td>${cam.min} – ${cam.max}</td>` +
      `<td>${round1(cam.center)} mm</td>` +
      `<td></td>`);
    const btn = el("button", "pin-btn" + (pinned ? " active" : ""), pinned ? "📌" : "＋");
    btn.title = pinned ? "Remove from comparison" : "Pin for comparison";
    btn.setAttribute("aria-label", btn.title);
    btn.addEventListener("click", () => togglePin(cam, setName));
    tr.lastElementChild.appendChild(btn);
    table.appendChild(tr);
  }

  renderCompare();
}

// Editable list of pinned cams + the shared-scale comparison chart.
function renderCompare() {
  const panel = $("comparePanel");
  panel.hidden = state.pinned.length === 0;
  if (panel.hidden) { $("pinnedList").innerHTML = ""; $("compareChart").innerHTML = ""; return; }

  const list = $("pinnedList");
  list.innerHTML = "";
  state.pinned.forEach((p, i) => {
    const rowEl = el("div", "pinned-row");
    const sw = el("span", "swatch");
    sw.style.background = p.colorHex;
    rowEl.appendChild(sw);
    const input = el("input", "pinned-label");
    input.type = "text";
    input.value = p.label;
    input.addEventListener("input", () => {
      state.pinned[i].label = input.value;
      savePinned();
      refreshCompareChart();
    });
    rowEl.appendChild(input);
    rowEl.appendChild(el("span", "pinned-src", `${p.setName} · ${p.min}–${p.max} mm`));
    const rm = el("button", "pin-remove", "×");
    rm.title = "Remove";
    rm.setAttribute("aria-label", "Remove " + p.label);
    rm.addEventListener("click", () => { state.pinned.splice(i, 1); savePinned(); renderStudy(); });
    rowEl.appendChild(rm);
    list.appendChild(rowEl);
  });

  refreshCompareChart();
}

// Pinned cams + the current Study set, drawn on one shared mm scale.
function refreshCompareChart() {
  const setRows = CAM_SETS[state.studyIndex].cams.map((c) => ({
    label: "#" + c.size, colorHex: c.colorHex, min: c.min, max: c.max,
  }));
  const pinRows = state.pinned.map((p) => ({
    label: p.label, colorHex: p.colorHex, min: p.min, max: p.max, pinned: true,
  }));
  const rows = pinRows.concat(setRows);
  const min = Math.min(...rows.map((r) => r.min));
  const max = Math.max(...rows.map((r) => r.max));
  drawRangeBars($("compareChart"), rows, min, max);
  // Dashed separator between the retained cams and the current set's cams.
  if (pinRows.length && setRows.length) {
    $("compareChart").children[pinRows.length - 1].classList.add("pin-sep");
  }
}

/* ============================================================
   Boot
   ============================================================ */
function init() {
  loadCalibration();
  loadRack(parseInt(localStorage.getItem(LS_RACK), 10) || 0);
  state.studyIndex = state.rackIndex;
  loadPinned();
  updateRackName();
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
  // Study page: set picker, promote-to-rack, clear comparison.
  $("studySet").addEventListener("change", (e) => {
    state.studyIndex = parseInt(e.target.value, 10) || 0;
    renderStudy();
  });
  $("studyUseRack").addEventListener("click", () => {
    loadRack(state.studyIndex);
    updateRackName();
    state.target = null;   // force a fresh Play round with the new rack
    renderStudy();
  });
  $("clearPinned").addEventListener("click", () => {
    state.pinned = [];
    savePinned();
    renderStudy();
  });
  window.addEventListener("resize", handleResize);
  initHeaderCollapse();
  // First-ever visit sees the intro; afterwards go to calibration if never
  // calibrated, otherwise straight to play.
  if (localStorage.getItem(LS_SEEN_INTRO) !== "1") {
    localStorage.setItem(LS_SEEN_INTRO, "1");
    setView("intro");
  } else {
    setView(state.pxPerMm ? "play" : "calibrate");
  }
}

// Keep the crack and gear consistent with the current wall size. If a resize
// leaves the current (unanswered) crack too big to show, draw a fresh round.
let resizeTimer = null;
function handleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    clampCardSlider();
    if (state.view === "calibrate" && state.calMethod === "card") updateCardPreview();
    if (state.view !== "play" || !state.target) return;
    if (!state.answered && state.target.width > maxDisplayableMm()) { newRound(); return; }
    renderCrack();
    if (!state.answered) renderGear();
  }, 120);
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
// Load the cam data (single source of truth) from data/cams.json, then boot.
// Must be served over http(s); opening index.html as a bare file:// will fail
// the fetch and show the message below.
async function boot() {
  try {
    const res = await fetch("data/cams.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    CAM_SETS = await res.json();
  } catch (e) {
    document.body.innerHTML =
      '<p style="color:#e8ebef;font-family:sans-serif;padding:2rem;line-height:1.5">' +
      "Couldn't load cam data (<code>data/cams.json</code>): " + e.message +
      ".<br>If you opened this page as a file, serve it over http instead " +
      "(e.g. <code>python3 -m http.server</code>).</p>";
    return;
  }
  init();
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
