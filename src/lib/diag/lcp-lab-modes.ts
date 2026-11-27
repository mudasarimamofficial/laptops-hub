/** Shared mode ids for the LCP lab (server-safe; not a client module). */
export const LAB_MODES = [
  "A",
  "A-font",
  "B",
  "C",
  "D",
  "E-transform",
  "E-blend",
  "E-isolation",
  "E-intro",
  "E-parallax",
  "E-calc-opacity",
  "E-full-hero-shell",
  "F",
] as const;

export type LabModeId = (typeof LAB_MODES)[number];

export function isLabMode(value: string): value is LabModeId {
  return (LAB_MODES as readonly string[]).includes(value);
}
