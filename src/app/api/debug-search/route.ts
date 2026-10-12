// src/app/api/debug-search/route.ts
// GEÇİCİ TANI ARACI: yalnızca geliştirme ortamında çalışır, üretimde 404 döner.
// Arama adımının neden ilan getirmediğini ayırt etmek için kullanılır. F2 sonrası kaldırılacak.

import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

interface StepResult {
  ok: boolean;
  ms: number;
  error?: string;
  textLength?: number;
  textPreview?: string;
  hasListingHeader?: boolean;
  priceLikeCount?: number;
  groundingChunks?: number;
  hosts?: string[];
}

function hostOf(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "iPhone 13 128GB").slice(0, 80);

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Kapalı" }, { status: 404 });
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY tanımlı değil" }, { status: 500 });
  }

  const primary = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  const fallback = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";
  const searchModel = process.env.GEMINI_SEARCH_MODEL || primary;
  const ai = new GoogleGenAI({ apiKey });

  const safeError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    return raw.split(apiKey).join("***").slice(0, 500);
  };

  // Adım 1: araçsız basit çağrı. Model adı ve anahtar çalışıyor mu?
  async function plainCall(model: string): Promise<StepResult> {
    const t0 = Date.now();
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: "Sadece 'tamam' yaz.",
        config: { temperature: 0 },
      });
      const text = resp.text ?? "";
      return { ok: true, ms: Date.now() - t0, textLength: text.length, textPreview: text.slice(0, 100) };
    } catch (err) {
      return { ok: false, ms: Date.now() - t0, error: safeError(err) };
    }
  }

  // Adım 2: Google Search araçlı çağrı. Rotadaki arama istemine benzer.
  async function searchCall(model: string): Promise<StepResult> {
    const t0 = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Bugünün tarihi ${today}. Türkiye'deki ikinci el pazarında şu cihaz için güncel ilanları Google Search ile ara: "${q}".
Kurallar:
- Sadece gerçek ve güncel ilanları listele. Uydurma veri ekleme.
- Cevabın ilk satırı tam olarak "İLANLAR:" olsun, altında her ilan için tek satır yer alsın.
- Satır formatı: - [Kaynak] Başlık | Fiyat TL | Tarih | Bağlantı
- En fazla 15 satır döndür.`;
    try {
      const resp = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], temperature: 0.1 },
      });
      const text = resp.text ?? "";
      const chunks = resp.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const hosts: string[] = [];
      for (const c of chunks) {
        const uri = c.web?.uri;
        if (!uri) continue;
        const h = hostOf(uri);
        const label = h.includes("vertexaisearch") ? c.web?.title || h : h;
        if (label && !hosts.includes(label)) hosts.push(label);
        if (hosts.length >= 8) break;
      }
      return {
        ok: true,
        ms: Date.now() - t0,
        textLength: text.length,
        textPreview: text.slice(0, 1500),
        hasListingHeader: /İLANLAR/i.test(text),
        priceLikeCount: (text.match(/\d{1,3}[.\s]?\d{3}/g) ?? []).length,
        groundingChunks: chunks.length,
        hosts,
      };
    } catch (err) {
      return { ok: false, ms: Date.now() - t0, error: safeError(err) };
    }
  }

  const plain = await plainCall(primary);
  const search = await searchCall(searchModel);
  const searchFallback = search.ok ? null : await searchCall(fallback);

  return NextResponse.json({
    query: q,
    models: { primary, fallback, searchModel },
    plainCall: plain,
    searchCall: search,
    searchCallWithFallbackModel: searchFallback,
  });
}