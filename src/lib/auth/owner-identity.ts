/**
 * Permanent Laptops HUB owner identity (Auth + merchant notifications).
 * The Auth user UUID was preserved when the login email cut over; do not treat any
 * prior mailbox as an active owner login identity in application code.
 */
export const OWNER_EMAIL = "infolaptopshub@gmail.com";

export function isActiveOwnerEmail(email: string | null | undefined): boolean {
  return (email || "").trim().toLowerCase() === OWNER_EMAIL;
}
