import { NextResponse } from "next/server";
import { analyzeListing } from "@/lib/analyzeListing";
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

  const modelId = formData.get("modelId");
  const priceValue = formData.get("price");
  if (typeof modelId !== "string" || typeof priceValue !== "string") {
    return NextResponse.json(
      { error: "Model ve ilan fiyatı gerekli." },
      { status: 400 },
    );
  }

  const price = Number(priceValue);
  if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) {
    return NextResponse.json(
      { error: "Geçerli bir ilan fiyatı gir." },
      { status: 400 },
    );
  }

  const result = analyzeListing(modelId, price);
  if (!result) {
    return NextResponse.json({ error: "Bilinmeyen model." }, { status: 400 });
  }

  return NextResponse.json(result);
}