import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getDashboardOwnerUserId, requireDashboardSession } from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";
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

function detectMimeFromBuffer(buffer: Buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") {
    const brand = buffer.toString("ascii", 8, 12);
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["heif", "heim", "heis", "mif1", "msf1"].includes(brand)) return "image/heif";
  }

  return null;
}

function isMimeTypeCompatible(claimedMimeType: string, detectedMimeType: string) {
  if (!claimedMimeType) return true;
  if (claimedMimeType === detectedMimeType) return true;

  return (
    (claimedMimeType === "image/heic" && detectedMimeType === "image/heif") ||
    (claimedMimeType === "image/heif" && detectedMimeType === "image/heic")
  );
}

function extensionFromMime(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "jpg";
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

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

  if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: "Image must be between 1 byte and 5 MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detectedMimeType = detectMimeFromBuffer(buffer);
  if (!detectedMimeType || !ALLOWED_MIME_TYPES.has(detectedMimeType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 400 });
  }

  if (!isMimeTypeCompatible(file.type, detectedMimeType)) {
    return NextResponse.json({ error: "Image type does not match file content." }, { status: 400 });
  }

  const extension = extensionFromMime(detectedMimeType);
  const objectPath = `${ownerUserId}/${Date.now()}-${randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: detectedMimeType,
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
