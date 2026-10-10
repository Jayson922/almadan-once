import { NextResponse } from "next/server";
import { PHONE_PRICE_TABLE } from "@/lib/phonePrices";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    if (!apiKey) {
      return NextResponse.json(
        { error: "API anahtarı yapılandırılmamış." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json(
        { error: "Görsel yüklenmedi." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const mimeType = image.type || "image/jpeg";
    const base64Data = buffer.toString("base64");

    const modelListPrompt = PHONE_PRICE_TABLE.map(
      (p) => `- "${p.id}": ${p.name} ${p.storage}`
    ).join("\n");

    const promptText = `
Sen bir ikinci el telefon ilan analiz asistanısın. Sana verilen ekran görüntüsünden telefon modelini ve fiyatını çıkar.

Aşağıdaki model listesinden görseldeki telefona en uygun olan modelId değerini seç:
${modelListPrompt}

Sadece ve sadece aşağıdaki JSON formatında yanıt ver:
{
  "modelId": "seçtiğin_model_id_veya_null",
  "price": number_veya_null
}

Fiyatı sadece sayı olarak yaz (örn: 25000). Eğer model veya fiyat okunamıyorsa null ver. Başka hiçbir açıklama yazma.
    `;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ modelId: null, price: null });
    }

    const result = await response.json();
    const responseText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ modelId: null, price: null });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({
      modelId: parsed.modelId ?? null,
      price: typeof parsed.price === "number" ? parsed.price : null,
    });
  } catch {
    return NextResponse.json({ modelId: null, price: null });
  }
}