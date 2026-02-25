import { NextResponse } from "next/server";

import { isDashboardPublicReadEnabled, requireDashboardSession } from "@/lib/dashboardAuth";
import { isAllowedRequestOrigin } from "@/lib/origin";
import { extractTextFromWalmartPdf } from "@/lib/walmartPdf";

function hasPdfSignature(buffer: Buffer) {
  return buffer.slice(0, 5).toString("utf8") === "%PDF-";
}

export async function POST(request: Request) {
  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  if (!isDashboardPublicReadEnabled()) {
    const hasSession = await requireDashboardSession();
    if (!hasSession) {
      return NextResponse.json({ error: "Login required." }, { status: 401 });
    }
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid multipart payload." }, { status: 400 });
  }

  const source = String(formData.get("source") ?? "walmart")
    .trim()
    .toLowerCase();
  if (source !== "walmart") {
    return NextResponse.json(
      { error: "PDF parsing is currently available only for source=walmart." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing PDF file." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!hasPdfSignature(bytes)) {
    return NextResponse.json({ error: "Invalid PDF file." }, { status: 400 });
  }

  try {
    const extracted = await extractTextFromWalmartPdf(bytes);
    const text = extracted.replace(/\f/g, "\n\n").trim();
    if (!text) {
      return NextResponse.json({ error: "PDF text extraction returned empty output." }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF extraction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
