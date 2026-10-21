/** Pakistan mobile normalization */

export type PhoneResult =
  | { ok: true; e164: string; normalized: string; national: string }
  | { ok: false; error: string };

export function normalizePakistanMobile(input: string): PhoneResult {
  const raw = input.trim().replace(/[\s\-()]/g, "");
  if (!raw) return { ok: false, error: "Phone number is required" };

  let digits = raw.replace(/^\+/, "");
  if (digits.startsWith("0092")) digits = digits.slice(2);
  if (digits.startsWith("92") && digits.length === 12) {
    // already country code
  } else if (digits.startsWith("0") && digits.length === 11) {
    digits = "92" + digits.slice(1);
  } else if (digits.length === 10 && digits.startsWith("3")) {
    digits = "92" + digits;
  } else {
    return { ok: false, error: "Enter a valid Pakistan mobile (03XXXXXXXXX)" };
  }

  if (!/^923\d{9}$/.test(digits)) {
    return { ok: false, error: "Enter a valid Pakistan mobile (03XXXXXXXXX)" };
  }

  const national = "0" + digits.slice(2);
  return {
    ok: true,
    e164: "+" + digits,
    normalized: digits,
    national,
  };
}
