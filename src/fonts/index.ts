import localFont from "next/font/local";

// V5 font set, self-hosted (see README.md). Same CSS variables as before, so tokens.css is unchanged.
export const hanken = localFont({
  src: "./hanken-grotesk-latin-var.woff2",
  weight: "100 900",
  variable: "--font-hanken",
  display: "swap",
  adjustFontFallback: "Arial",
});
export const sora = localFont({
  src: "./sora-latin-var.woff2",
  weight: "100 800",
  variable: "--font-sora",
  display: "swap",
  adjustFontFallback: "Arial",
});
export const jetbrains = localFont({
  src: "./jetbrains-mono-latin-var.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
  adjustFontFallback: false,
});

export const fontVariables = `${hanken.variable} ${sora.variable} ${jetbrains.variable}`;
