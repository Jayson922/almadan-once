import { NextResponse } from "next/server";
import { GoogleGenAI, type Part } from "@google/genai";

type Body = {
  image?: string | null;
  model?: string;
  deviceModel?: string;
  price?: number | string;
  features?: string[];
  note?: string;
  sellerNote?: string;
};

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

function fail(status: number, error: string) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return fail(500, "GEMINI_API_KEY bulunamadı. .env.local dosyasını kontrol edip sunucuyu yeniden başlatın.");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail(400, "İstek okunamadı.");
  }

  const device = (body.model ?? body.deviceModel ?? "").trim();
  const price = Number(String(body.price ?? "").replace(/\D/g, "")) || 0;
  const note = (body.note ?? body.sellerNote ?? "").slice(0, 2000);
  const features = Array.isArray(body.features) ? body.features.join(", ") : "";

  if (!device && !body.image) {
    return fail(400, "Cihaz modeli ya da görsel gerekli.");
  }

  const prompt = `Sen Türkiye ikinci el telefon piyasasını bilen dürüst bir ekspertiz uzmanısın.
Cihaz: ${device || "görselden belirle"}
İstenen fiyat: ${price ? price + " TL" : "belirtilmedi"}
Bilinen özellikler: ${features || "belirtilmedi"}
Satıcı notu: ${note || "yok"}
Görselde görmediğini uydurma. Canlı piyasa verin yok, fiyat bir tahmindir, emin değilsen null yaz.

SADECE şu JSON'u döndür:
{"extractedTitle":string,"estimatedMarketPrice":number|null,"sellerPrice":number|null,"dealScore":string,"riskAnalysis":[string],"technicalComments":string}`;

  const parts: Part[] = [{ text: prompt }];
  if (body.image && body.image.startsWith("data:image/")) {
    const comma = body.image.indexOf(",");
    const semi = body.image.indexOf(";");
    if (comma > 0 && semi > 5) {
      parts.push({
        inlineData: { mimeType: body.image.slice(5, semi), data: body.image.slice(comma + 1) },
      });
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", temperature: 0.3 },
    });

    const raw = (response.text ?? "")
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/\s*```$/, "");

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return fail(502, "Yapay zeka yanıtı okunamadı. Tekrar deneyin.");
    }
    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("[analyze] Gemini hatası:", error);
    const message = error instanceof Error ? error.message : "Analiz sırasında hata oluştu.";
    return fail(500, message);
  }
}