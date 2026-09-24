// Shared color palette — dark cockpit theme, high contrast for glare.
export const COLORS = {
  bg: "#111418",
  panel: "#1b2027",
  line: "#2c343f",
  text: "#f2f5f8",
  muted: "#8a94a3",
  accent: "#4da3ff",
  ok: "#7cfc98",
  warn: "#ffd54a",
  bad: "#ff6b6b",
  mark: "#e53935",
};

/** Comment chips, laid out as rows. Keys are SightingDraft boolean fields;
 *  labels are what the crew sees. Order mirrors the historical vocabulary. */
export const NOTE_TOGGLE_ROWS: { key: "circled" | "photographed" | "captive" | "collared" | "recheck" | "duplicate" | "notDup"; label: string }[][] = [
  [
    { key: "circled", label: "CIRCLED" },
    { key: "photographed", label: "PHOTOS" },
    { key: "captive", label: "CAPTIVE" },
    { key: "collared", label: "COLLARED" },
  ],
  [
    { key: "recheck", label: "CHECK" },
    { key: "duplicate", label: "DUP?" },
    { key: "notDup", label: "NOT DUP" },
  ],
];
