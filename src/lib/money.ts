/** PKR money helpers — integer paisa only. Never use floats for totals. */

export type Paisa = number;

export function pkrMajorToPaisa(major: number | string): Paisa {
  const n = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("invalid_pkr_amount");
  }
  return Math.round(n * 100);
}

export function paisaToMajor(paisa: Paisa): number {
  return paisa / 100;
}

export function formatPkr(paisa: Paisa, locale = "en-PK"): string {
  const major = paisaToMajor(paisa);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
    .format(major)
    .replace("PKR", "Rs")
    .trim();
}

export function formatPkrMajor(major: number, locale = "en-PK"): string {
  return formatPkr(pkrMajorToPaisa(major), locale);
}
