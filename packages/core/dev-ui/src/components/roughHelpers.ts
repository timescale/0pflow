import rough from "roughjs";

// Single shared generator (stateless, lightweight)
export const generator = rough.generator();

// Deterministic seed from string — ensures stable sketch patterns across re-renders
export function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Pencil style presets — subtle hand-drawn, not messy
export const PENCIL = {
  nodeBorder: {
    roughness: 0.4,
    bowing: 0.3,
    strokeWidth: 1,
    stroke: "#9e9689",
    fill: "#fffef9",
    fillStyle: "solid" as const,
  },
  accentLine: {
    roughness: 0.5,
    bowing: 0.2,
    strokeWidth: 2.5,
  },
  edge: {
    roughness: 0.8,
    bowing: 0.5,
    strokeWidth: 1.2,
    stroke: "#9e9689",
  },
  loopGroup: {
    roughness: 0.6,
    bowing: 0.4,
    strokeWidth: 1.2,
    stroke: "#a89f94",
    fill: "rgba(247, 243, 238, 0.4)",
    fillStyle: "solid" as const,
  },
  badge: {
    roughness: 0.3,
    bowing: 0.15,
    strokeWidth: 0.7,
  },
  conditionBorder: {
    roughness: 0.4,
    bowing: 0.3,
    strokeWidth: 1,
    stroke: "#d4a843",
    fill: "#fffef9",
    fillStyle: "solid" as const,
  },
} as const;

// Type-specific accent colors
export const TYPE_ACCENT_COLORS: Record<string, string> = {
  node: "#4ade80",
  agent: "#a78bfa",
  workflow: "#4ade80",
  input: "#a89f94",
  output: "#a89f94",
  condition: "#fbbf24",
};

// Badge fill colors (semi-transparent)
export const TYPE_BADGE_FILLS: Record<string, string> = {
  node: "rgba(236, 253, 245, 0.8)",
  agent: "rgba(245, 243, 255, 0.8)",
  workflow: "rgba(236, 253, 245, 0.8)",
  input: "rgba(240, 235, 227, 0.8)",
  output: "rgba(240, 235, 227, 0.8)",
  condition: "rgba(255, 251, 235, 0.8)",
};

// Badge text colors
export const TYPE_BADGE_TEXT: Record<string, string> = {
  node: "#22c55e",
  agent: "#8b5cf6",
  workflow: "#22c55e",
  input: "#a8a099",
  output: "#a8a099",
  condition: "#f59e0b",
};
