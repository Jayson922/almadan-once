import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { image, text } = body; // image: base64 data url, text: optional user note

    if (!image && !text) {
      return NextResponse.json(
        { success: false, error: "Görsel veya metin bulunamadı." },
        { status: 400 }
      );
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-3.5-flash";
    const contents: any[] = [];

    // Görsel varsa Gemini Vision için hazırla
    if (image) {
      const match = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const base64Data = match[2];
        contents.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        });
      }
    }

    const prompt = `
Sen profesyonel bir ikinci el akıllı telefon ekspertiz ve yapay zeka analiz asistanısın. 
Gönderilen görseli ve/veya ek metni dikkatlice analiz et.

Aşağıdaki bilgileri kesinlikle geçerli bir JSON formatında (ekstra Markdown blokları veya açıklamalar eklemeden, sadece ham JSON) döndür:
{
  "brand": "Marka (örn: Apple, Samsung, Xiaomi)",
  "model": "Model adı ve seri (örn: iPhone 13, Galaxy S22)",
  "storage": "Depolama alanı (örn: 128GB, 256GB - bulamazsan null)",
  "condition": "Kondisyon durumu (şu değerlerden biri olmalı: 'like_new', 'good', 'fair', 'poor')",
  "extractedPrice": Sayısal fiyat değeri (eğer görselde veya metinde ilan fiyatı varsa rakam olarak, yoksa null),
  "extractedTitle": "Cihazın tam tanımlayıcı başlığı (örn: Apple iPhone 13 128GB)",
  "sellerNote": "Görselden veya metinden çıkarılan satıcı Notu / Durum açıklaması"
}

Eğer depolama veya kondisyon net değilse mantıklı varsayılanlar seç (kondisyon için varsayılan 'good'). Kesinlikle sadece JSON döndür.
`;

    contents.push(prompt);
    if (text) {
      contents.push(`Ek Not: ${text}`);
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
    });

    const rawText = response.text || "";
    // JSON temizliği (Markdown bloklarını temizle)
    const cleanedJsonText = rawText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let extractedData;
    try {
      extractedData = JSON.parse(cleanedJsonText);
    } catch (e) {
      console.error("JSON parse hatası:", rawText);
      // Fallback yapı
      extractedData = {
        brand: "Bilinmiyor",
        model: "Akıllı Telefon",
        storage: "128GB",
        condition: "good",
        extractedPrice: null,
        extractedTitle: "İkinci El Akıllı Telefon",
        sellerNote: text || "Görselden analiz edildi.",
      };
    }

    return NextResponse.json({
      success: true,
      data: extractedData,
    });
  } catch (error: any) {
    console.error("Extract API Hatası:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Görsel analiz edilemedi." },
      { status: 500 }
    );
  }
}