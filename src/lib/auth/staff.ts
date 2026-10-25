import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
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

/** Read membership for the current user (user-scoped client; RLS applies). */
export async function getStaffMembership(): Promise<StaffSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("admin_memberships")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: data.role as StaffRole,
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new StaffAuthError("unauthenticated", "Sign in required", 401);
  }

  const { data, error } = await supabase
    .from("admin_memberships")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) {
    throw new StaffAuthError("forbidden", "Staff membership required", 403);
  }

  const role = data.role as StaffRole;
  if (!roleAllowed(role, allowedRoles)) {
    throw new StaffAuthError("forbidden_role", "Insufficient staff role", 403);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role,
  };
}

/** For admin pages: redirect unauthenticated → login; non-staff → forbidden. */
export async function requireStaffPage(allowedRoles?: StaffRole[]): Promise<StaffSession> {
  try {
    return await requireStaff(allowedRoles);
  } catch (e) {
    if (e instanceof StaffAuthError && e.status === 401) {
      redirect("/admin/login");
    }
    redirect("/admin/forbidden");
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
  await assertMerchantMutationAllowedAsync("admin_write");
  return createAuthorizedStaffClient(allowedRoles);
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
