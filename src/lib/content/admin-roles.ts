import type { StaffRole } from "@/lib/auth/staff";

/** Who may manage reels, blog posts and review moderation (mirrors the RLS policies in 20261115100000). */
export const REEL_STAFF_ROLES: StaffRole[] = ["owner", "admin", "editor"];
export const POST_STAFF_ROLES: StaffRole[] = ["owner", "admin", "editor"];
export const REVIEW_STAFF_ROLES: StaffRole[] = ["owner", "admin", "manager", "editor"];
