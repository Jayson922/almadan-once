import { NextResponse } from "next/server";
import { mockAnalyze } from "@/lib/mockAnalyze";
import { validateImage } from "@/lib/validateImage";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const image = formData.get("image");
  if (!image || typeof image === "string") {
    return NextResponse.json({ error: "Görsel bulunamadı." }, { status: 400 });
  }

  const validationError = validateImage(image);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const result = await mockAnalyze();
  return NextResponse.json(result);
}