import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { VerifiedUser } from "@/lib/supabase/verified-user";
import {
  assertMerchantMutationAllowedAsync,
  MerchantWriteBlockedError,
} from "@/lib/security/merchant-write-guard";

export type StaffRole = "owner" | "admin" | "manager" | "editor" | "fulfillment";

export type StaffSession = {
  userId: string;
  email: string | null;
  role: StaffRole;
};

export class StaffAuthError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 403) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function extractAuthUser(supabase: Awaited<ReturnType<typeof createClient>>): Promise<VerifiedUser | null> {
  try {
    const reqHeaders = await headers();
    const authHeader = reqHeaders.get("authorization");
    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        const res = await supabase.auth.getUser(token);
        if (res.data?.user) return { id: res.data.user.id, email: res.data.user.email ?? null };
      }
    }
  } catch {
    // headers() might not be available in non-request contexts
  }
  // Authoritative check with the Auth server (not local JWT verification): a session that was signed out — even on
  // another device — is refused immediately. Done once per request (lookupCurrentStaff is request-cached).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/**
 * The signed-in user and their membership row, looked up ONCE per server request: the admin layout and the page both
 * need it, and each lookup is two network round trips to Supabase (auth + membership). React `cache` scopes the
 * result to the current request only (outside a request it is a plain call), so nothing is shared between visitors.
 */
const lookupCurrentStaff = cache(async () => {
  const supabase = await createClient();
  const user = await extractAuthUser(supabase);
  if (!user) return { user: null, membership: null, failed: false };
  const { data, error } = await createServiceClient()
    .from("admin_memberships")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, membership: data as { role: string; is_active: boolean } | null, failed: !!error };
});

/** Read membership for the current user. */
export async function getStaffMembership(): Promise<StaffSession | null> {
  const { user, membership, failed } = await lookupCurrentStaff();
  if (!user || failed || !membership || !membership.is_active) return null;
  return {
    userId: user.id,
    email: user.email ?? null,
    role: membership.role as StaffRole,
  };
}

/** Exact role allow-list. Empty/undefined = any active staff role. */
function roleAllowed(actual: StaffRole, allowed?: StaffRole[]): boolean {
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(actual);
}

/**
 * Hard server-side gate. Prefer this over middleware alone.
 * Throws StaffAuthError for API routes; use requireStaffPage for RSC redirects.
 */
export async function requireStaff(allowedRoles?: StaffRole[]): Promise<StaffSession> {
  const { user, membership, failed } = await lookupCurrentStaff();

  if (!user) {
    throw new StaffAuthError("unauthenticated", "Sign in required", 401);
  }

  if (failed || !membership || !membership.is_active) {
    throw new StaffAuthError("forbidden", "Staff membership required", 403);
  }

  const role = membership.role as StaffRole;
  if (!roleAllowed(role, allowedRoles)) {
    throw new StaffAuthError("forbidden_role", "Insufficient staff role", 403);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
}

/** For admin pages: redirect unauthenticated → login; wrong/inactive role → forbidden with reason. */
export async function requireStaffPage(allowedRoles?: StaffRole[]): Promise<StaffSession> {
  try {
    return await requireStaff(allowedRoles);
  } catch (e) {
    if (e instanceof StaffAuthError && e.status === 401) {
      redirect("/admin/login");
    }
    const reason =
      e instanceof StaffAuthError && e.code === "forbidden_role"
        ? "role"
        : e instanceof StaffAuthError && e.code === "forbidden"
          ? "membership"
          : "denied";
    redirect(`/admin/forbidden?reason=${reason}`);
  }
}

/**
 * Elevated client ONLY after requireStaff has succeeded.
 * Prefer createClient() + RLS when possible; use this for narrow staff ops.
 * Read-only admin routes should use this (no Production Preview write guard).
 */
export async function createAuthorizedStaffClient(allowedRoles?: StaffRole[]) {
  const staff = await requireStaff(allowedRoles);
  return { staff, supabase: createServiceClient() };
}

/**
 * Staff client for routes that INSERT/UPDATE/DELETE merchant data.
 * Fail-closed against Preview→Production and localhost→hosted tunnels.
 */
export async function createAuthorizedStaffWriter(allowedRoles?: StaffRole[]) {
  const staffClient = await createAuthorizedStaffClient(allowedRoles);
  await assertMerchantMutationAllowedAsync("admin_write");
  return staffClient;
}

export function staffErrorResponse(error: unknown) {
  if (error instanceof StaffAuthError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof MerchantWriteBlockedError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(
    { error: "server_error", message: "Unexpected error" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
