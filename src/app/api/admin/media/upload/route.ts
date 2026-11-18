import { NextResponse } from "next/server";
import { createAuthorizedStaffWriter, staffErrorResponse } from "@/lib/auth/staff";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

function extFor(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

/** Staff: upload an image into the public `cms-media` bucket and record metadata. */
export async function POST(request: Request) {
  try {
    const { staff } = await createAuthorizedStaffWriter(["owner", "admin", "manager", "editor"]);
    const form = await request.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "validation_failed", message: "Expected multipart form data." }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "validation_failed", message: "Choose an image file to upload." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "validation_failed", message: "Use a JPEG, PNG, WebP or GIF image." },
        { status: 400 },
      );
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "validation_failed", message: "Image must be under 5 MB." },
        { status: 400 },
      );
    }
    const alt = String(form.get("alt") || "").trim().slice(0, 200);
    const bytes = Buffer.from(await file.arrayBuffer());
    const path = `uploads/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extFor(file.type)}`;
    const supabase = createServiceClient();
    const { error: upErr } = await supabase.storage.from("cms-media").upload(path, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });
    if (upErr) {
      console.error("[media/upload] storage", upErr.message);
      return NextResponse.json({ error: "upload_failed", message: "Could not store the image. Try again." }, { status: 500 });
    }
    const { data: pub } = supabase.storage.from("cms-media").getPublicUrl(path);
    const publicUrl = pub.publicUrl;
    const { data: row, error: metaErr } = await supabase
      .from("cms_media_assets")
      .insert({
        path,
        public_url: publicUrl,
        alt,
        mime_type: file.type,
        byte_size: file.size,
        uploaded_by: staff.userId,
      })
      .select("id, public_url, alt, created_at")
      .single();
    if (metaErr || !row) {
      console.error("[media/upload] meta", metaErr?.message);
      return NextResponse.json({ error: "upload_failed", message: "Image stored but catalog entry failed." }, { status: 500 });
    }
    await supabase.from("audit_logs").insert({
      actor_user_id: staff.userId,
      action: "cms_media.upload",
      entity_type: "cms_media_assets",
      entity_id: row.id,
      after: { path, public_url: publicUrl },
    });
    return NextResponse.json(
      { ok: true, id: row.id, url: row.public_url, alt: row.alt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return staffErrorResponse(e);
  }
}
