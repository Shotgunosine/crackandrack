// Wild Country Friends 2026 cam data.
// Loaded as a plain script (global `CAMS`) so the game works from file://
// without fetch/CORS issues. Canonical copy lives in data/cams.json.
// Expansion ranges in millimetres.
const CAMS = [
  { size: "0.3",  color: "Blue",   colorHex: "#2f6fb0", min: 15.1, max: 21.1 },
  { size: "0.4",  color: "Silver", colorHex: "#b8bcc2", min: 16.9, max: 23.6 },
  { size: "0.5",  color: "Purple", colorHex: "#7a4fb0", min: 22.0, max: 31.0 },
  { size: "0.75", color: "Green",  colorHex: "#3f9b46", min: 27.5, max: 38.7 },
  { size: "1",    color: "Red",    colorHex: "#cc3333", min: 33.9, max: 48.1 },
  { size: "2",    color: "Gold",   colorHex: "#e0a91b", min: 44.2, max: 62.3 },
  { size: "3",    color: "Blue",   colorHex: "#2f6fb0", min: 56.2, max: 79.2 },
  { size: "4",    color: "Grey",   colorHex: "#8a8f96", min: 71.3, max: 100.8 },
];

// Derived helpers shared by the game.
CAMS.forEach((c) => {
  c.center = (c.min + c.max) / 2;
  c.label = "#" + c.size;
});

// Full span of the rack, used for scaling the reference chart.
const RACK_MIN = Math.min(...CAMS.map((c) => c.min));
const RACK_MAX = Math.max(...CAMS.map((c) => c.max));
