import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getDashboardOwnerUserId, requireDashboardSession } from "@/lib/dashboardAuth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = "item-photos";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

export async function POST(request: Request) {
  const authed = await requireDashboardSession();
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const ownerUserId = getDashboardOwnerUserId();
  if (!supabase || !ownerUserId) {
    return NextResponse.json(
      { error: "Missing Supabase service-role or dashboard owner env." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image must be between 1 byte and 5 MB." },
      { status: 400 }
    );
  }

  const extension = extensionFromMime(file.type);
  const objectPath = `${ownerUserId}/${Date.now()}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    return NextResponse.json(
      { error: `Failed to upload image: ${error.message}` },
      { status: 500 }
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return NextResponse.json({ url: data.publicUrl, path: objectPath });
}
