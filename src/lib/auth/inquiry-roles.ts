import type { StaffRole } from "@/lib/auth/staff";

/** Customer inquiries contain names, phones and emails: only roles that handle customers see or update them. */
export const INQUIRY_STAFF_ROLES: StaffRole[] = ["owner", "admin", "manager", "fulfillment"];
