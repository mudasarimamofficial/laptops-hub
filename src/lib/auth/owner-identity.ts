/**
 * Permanent Laptops HUB owner identity (Auth + merchant notifications).
 * Legacy login `laptopshubofficial@gmail.com` was migrated onto the same Auth user UUID
 * and must not be treated as an active owner login.
 */
export const OWNER_EMAIL = "infolaptopshub@gmail.com";
export const LEGACY_OWNER_EMAIL = "laptopshubofficial@gmail.com";

export function isActiveOwnerEmail(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === OWNER_EMAIL;
}
