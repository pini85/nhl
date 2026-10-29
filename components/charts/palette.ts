// Validated with the dataviz palette checker (dark mode, surface #0d1424).
export const US = "#2f9be0";
export const THEM = "#e5506a";
export const GRID = "rgba(255,255,255,0.06)";
export const AXIS = "#7f95b5";
export const ME = "#c08a20";
// Reference line (dashed), not a category — dash pattern carries identity.
export const MATES = "#b4c3d9";
// Teammate lines on "You vs teammates", next to ME. Slots 1–2 pass the checker with ME (all pairs);
// slot 3 is the light gray drawn dashed, so the dash pattern carries its identity.
export const COMPARE = [
  { color: "#2f9be0", dashed: false },
  { color: "#d0508f", dashed: false },
  { color: MATES, dashed: true },
] as const;
