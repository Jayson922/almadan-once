import { PHONE_PRICE_TABLE } from "@/lib/phonePrices";

export interface ExtractedListing {
  modelId: string | null;
  price: number | null;
  confidence: number | null;
}

export async function extractListing(image: File): Promise<ExtractedListing> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY bulunamadı.");
  }
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-flash-latest";

  const modelList = PHONE_PRICE_TABLE.map(
    (item) => `${item.id} = ${item.name} ${item.storage}`,
  ).join("\n");

  const prompt = [
    "Bu görsel, Türkiye'deki bir ikinci el telefon ilanının ekran görüntüsü.",
    "Yalnızca görselde yazanı oku, tahmin yapma.",
    "Sadece şu JSON'u döndür:",
    '{"modelId": string | null, "price": number | null, "confidence": number | null}',
    "modelId yalnızca aşağıdaki listedeki kimliklerden biri olabilir.",
    "Telefon bu listede yoksa ya da net değilse null yaz.",
    modelList,
    "price ilan fiyatıdır: TL cinsinden, nokta ve para birimi olmadan düz sayı. Görünmüyorsa null.",
    "confidence okumanın güvenilirliği, 0 ile 1 arası bir sayı.",
  ].join("\n");

  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: image.type, data: base64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini isteği başarısız oldu (${response.status}).`);
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";

  let parsed: { modelId?: unknown; price?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { modelId: null, price: null, confidence: null };
  }

  const knownIds = PHONE_PRICE_TABLE.map((item) => item.id);
  const modelId =
    typeof parsed.modelId === "string" && knownIds.includes(parsed.modelId)
      ? parsed.modelId
      : null;
  const price =
    typeof parsed.price === "number" &&
    Number.isFinite(parsed.price) &&
    parsed.price > 0 &&
    parsed.price <= 1_000_000
      ? parsed.price
      : null;
  const confidence =
    typeof parsed.confidence === "number" &&
    parsed.confidence >= 0 &&
    parsed.confidence <= 1
      ? parsed.confidence
      : null;

  return { modelId, price, confidence };
}