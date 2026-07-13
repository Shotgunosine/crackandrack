// Cam data for the game — mirrored from data/cams.json (the canonical copy).
// Loaded as a plain script (global CAM_SETS) so the game works from file://
// without fetch/CORS issues. If you edit the sets, update BOTH this file and
// data/cams.json.
//
// Each set: brand / family / year / source / units / displayname, plus a cams[]
// list with size, color, colorHex, and expansion range min/max (millimetres).
const CAM_SETS = [
  {
    brand: "Wild Country", family: "Friends", year: 2026,
    source: "https://hownot2.com/products/friend",
    units: "mm", displayname: "Friends (2026)",
    cams: [
      { size: "0.3",  color: "Blue",   colorHex: "#2f6fb0", min: 15.1, max: 21.1 },
      { size: "0.4",  color: "Silver", colorHex: "#b8bcc2", min: 16.9, max: 23.6 },
      { size: "0.5",  color: "Purple", colorHex: "#7a4fb0", min: 22.0, max: 31.0 },
      { size: "0.75", color: "Green",  colorHex: "#3f9b46", min: 27.5, max: 38.7 },
      { size: "1",    color: "Red",    colorHex: "#cc3333", min: 33.9, max: 48.1 },
      { size: "2",    color: "Gold",   colorHex: "#e0a91b", min: 44.2, max: 62.3 },
      { size: "3",    color: "Blue",   colorHex: "#2f6fb0", min: 56.2, max: 79.2 },
      { size: "4",    color: "Grey",   colorHex: "#8a8f96", min: 71.3, max: 100.8 },
    ],
  },
  {
    brand: "Wild Country", family: "Friends", year: 2025,
    source: "https://hownot2.com/products/friend-closeout",
    units: "mm", displayname: "Friends (2025)",
    cams: [
      { size: "0.4",  color: "Silver", colorHex: "#b8bcc2", min: 15.8, max: 26.4 },
      { size: "0.5",  color: "Purple", colorHex: "#7a4fb0", min: 20.6, max: 34.5 },
      { size: "0.75", color: "Green",  colorHex: "#3f9b46", min: 25.8, max: 40.3 },
      { size: "1",    color: "Red",    colorHex: "#cc3333", min: 31.7, max: 53.6 },
      { size: "2",    color: "Gold",   colorHex: "#e0a91b", min: 41.5, max: 69.3 },
      { size: "3",    color: "Blue",   colorHex: "#2f6fb0", min: 52.7, max: 88.0 },
      { size: "4",    color: "Grey",   colorHex: "#8a8f96", min: 66.8, max: 112.1 },
    ],
  },
  {
    brand: "Black Diamond", family: "Camalot C4", year: 2019,
    source: "https://hownot2.com/products/camalot-c4-cams-black-diamond",
    units: "mm", displayname: "Camalot C4",
    cams: [
      { size: "0.3",  color: "Blue",   colorHex: "#2f6fb0", min: 13.8, max: 23.4 },
      { size: "0.4",  color: "Silver", colorHex: "#b8bcc2", min: 15.5, max: 26.7 },
      { size: "0.5",  color: "Purple", colorHex: "#7a4fb0", min: 19.6, max: 33.5 },
      { size: "0.75", color: "Green",  colorHex: "#3f9b46", min: 23.9, max: 41.2 },
      { size: "1",    color: "Red",    colorHex: "#cc3333", min: 30.2, max: 52.1 },
      { size: "2",    color: "Gold",   colorHex: "#e0a91b", min: 37.2, max: 64.9 },
      { size: "3",    color: "Blue",   colorHex: "#2f6fb0", min: 50.7, max: 87.9 },
      { size: "4",    color: "Grey",   colorHex: "#8a8f96", min: 66.0, max: 114.7 },
      { size: "5",    color: "Purple", colorHex: "#7a4fb0", min: 85.4, max: 148.5 },
    ],
  },
  {
    brand: "Metolius", family: "Ultralight Power Cams", year: 2014,
    source: "https://hownot2.com/products/metolius-ultralight-power-cams",
    units: "mm", displayname: "Power Cams",
    cams: [
      { size: "00", color: "Grey",     colorHex: "#b8bcc2", min: 8.5,  max: 12.0 },
      { size: "0",  color: "Purple",   colorHex: "#7a4fb0", min: 10.0, max: 15.0 },
      { size: "1",  color: "Blue",     colorHex: "#2f6fb0", min: 12.5, max: 18.0 },
      { size: "2",  color: "Yellow",   colorHex: "#e0a91b", min: 15.5, max: 22.5 },
      { size: "3",  color: "Orange",   colorHex: "#FF8A05", min: 18.5, max: 26.5 },
      { size: "4",  color: "Red",      colorHex: "#cc3333", min: 23.5, max: 33.5 },
      { size: "5",  color: "Black",    colorHex: "#000000", min: 28.0, max: 39.5 },
      { size: "6",  color: "Green",    colorHex: "#3f9b46", min: 32.5, max: 48.0 },
      { size: "7",  color: "Lt. Blue", colorHex: "#ADD8E6", min: 40.0, max: 57.5 },
      { size: "8",  color: "Purple",   colorHex: "#7a4fb0", min: 48.5, max: 71.5 },
    ],
  },
];
