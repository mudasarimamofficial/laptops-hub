/**
 * Pakistan provinces and territories, spelled the same in checkout and in shipping-zone admin: zones match an
 * address by normalised province/city name (`norm_place`), so both sides must use one list.
 */
export const PK_PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu and Kashmir",
] as const;

export type PkProvince = (typeof PK_PROVINCES)[number];
