"use client";

import { useEffect, useRef, useState } from "react";
import ReportView, { type Report } from "../components/ReportView";

const FEATURES = [
  "Kutulu & Faturalı",
  "Pil %85+",
  "Değişensiz / Orijinal",
  "Garantisi Var",
  "Face ID / True Tone Aktif",
  "Çizikler Var",
  "Ufak Çizikler Var",
  "Pil Değişmiş",
];

const MODELS = [
  "Apple iPhone 11 64 GB",
  "Apple iPhone 12 64 GB",
  "Apple iPhone 13 128 GB",
  "Apple iPhone 14 128 GB",
  "Apple iPhone 15 128 GB",
  "Samsung Galaxy S22 128 GB",
  "Samsung Galaxy S23 256 GB",
  "Xiaomi Redmi Note 12 128 GB",
];

const STEPS = [
  "Görsel ve ilan bilgileri okunuyor",
  "Model ve kondisyon değerlendiriliyor",
  "Piyasa aralığı hesaplanıyor",
  "Teknik ve risk raporu hazırlanıyor",
  "Kontrol listesi ve pazarlık planı yazılıyor",
];

async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => no(new Error("Görsel okunamadı."));
      i.src = url;
    });
    const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function Home() {
  const [tab, setTab] = useState<"image" | "text">("image");
  const [model, setModel] = useState("");
  const [price, setPrice] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Report | null>(null);
  const [listingPrice, setListingPrice] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.files ?? []).find((x) => x.type.startsWith("image/"));
      if (f) {
        setTab("image");
        compress(f).then(setImage).catch(() => setError("Görsel okunamadı."));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => {
    if (status === "done") resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [status]);

  const toggle = (f: string) =>
    setFeatures((p) => (p.includes(f) ? p.filter((x) => x !== f) : [...p, f]));

  function pick(f?: File | null) {
    if (!f || !f.type.startsWith("image/")) return;
    compress(f).then(setImage).catch(() => setError("Görsel okunamadı."));
  }

  async function submit() {
    if (status === "loading") return;
    const p = Number(price.replace(/\D/g, ""));
    if (!model.trim() || !p) {
      setError("Cihaz modelini ve ilan fiyatını girin.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError("");
    setResult(null);
    setListingPrice(p);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch("/api/ekspertiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ model, price: p, features, note, link, image }),
      });
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("application/json")) {
        throw new Error(
          `Sunucu beklenmeyen bir yanıt döndürdü (HTTP ${res.status}). Dev terminalindeki hatayı kontrol edin.`
        );
      }
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Sunucu hatası (HTTP ${res.status}).`);
      setResult(data.result as Report);
      setStatus("done");
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === "AbortError";
      setError(
        aborted
          ? "İstek 90 saniyede tamamlanmadı. Tekrar deneyin."
          : e instanceof TypeError
          ? "Sunucuya ulaşılamadı. 'npm.cmd run dev' çalışıyor mu?"
          : e instanceof Error
          ? e.message
          : "Bilinmeyen hata."
      );
      setStatus("error");
    } finally {
      clearTimeout(timer);
    }
  }

  const input =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100";

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-slate-900">
          ALMADAN ÖNCE
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-slate-500">
          İlanı yükleyin, yapay zeka cihazı inceleyip fiyatın makul olup olmadığını ve nelere dikkat
          etmeniz gerektiğini göstersin.
        </p>

        <section className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-100/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">
                Otomatik AI ekspertiz &amp; sorgulama motoru
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Cihaz İnceleme ve Pazar Taraması</h2>
            </div>
            <div className="flex shrink-0 rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              {(["image", "text"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={
                    "rounded-lg px-3 py-2 transition " +
                    (tab === t ? "bg-white text-indigo-700 shadow" : "text-slate-500 hover:text-slate-700")
                  }
                >
                  {t === "image" ? "Görsel Yükle" : "İlan Bağlantısı / Metin"}
                </button>
              ))}
            </div>
          </div>

          {tab === "image" ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files?.[0]);
              }}
              className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-4 text-center"
            >
              {image ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt="İlan görseli" className="mx-auto max-h-64 rounded-xl object-contain" />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    className="absolute right-2 top-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-200"
                  >
                    Kaldır
                  </button>
                  <p className="mt-2 text-xs text-indigo-600">✓ Görsel analize hazır (optimize edildi)</p>
                </div>
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()} className="w-full py-8">
                  <span className="block text-sm font-semibold text-slate-700">
                    Görseli sürükleyin, tıklayın veya Ctrl+V ile yapıştırın
                  </span>
                  <span className="mt-1 block text-xs text-slate-400">
                    Çizik ve kozmetik durum analizi için net bir fotoğraf yükleyin
                  </span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                İlan bağlantısı (isteğe bağlı)
              </label>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
                className={input + " mt-1"}
              />
              <p className="mt-1 text-xs text-slate-400">
                İlan siteleri sunucudan erişimi engellediği için bağlantı içeriği çekilmez. İlan metnini
                aşağıdaki &quot;Satıcı notu&quot; alanına yapıştırın.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                İncelenecek cihaz modeli
              </label>
              <input
                list="models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Apple iPhone 13 128 GB"
                className={input + " mt-1"}
              />
              <datalist id="models">
                {MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                İlandaki istenen fiyat (TL)
              </label>
              <input
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="25000"
                className={input + " mt-1"}
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Cihazın bilinen özellikleri</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FEATURES.map((f) => {
                const on = features.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggle(f)}
                    className={
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                      (on
                        ? "border-slate-800 bg-slate-800 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300")
                    }
                  >
                    {on ? "✓ " : "+ "}
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Satıcı notu / ilan açıklaması (yapıştırın)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Satıcının yazdığı açıklamayı buraya yapıştırın..."
              className={input + " mt-1 resize-none"}
            />
          </div>

          {status === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={status === "loading"}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 px-4 py-4 text-sm font-bold tracking-wide text-white shadow-lg shadow-indigo-200 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-80"
          >
            {status === "loading" ? "ANALİZ EDİLİYOR..." : "⚡ YAPAY ZEKA EKSPERTİZ & PAZAR TARAMASINI BAŞLAT"}
          </button>

          {status === "loading" && (
            <ul className="space-y-2 rounded-xl bg-indigo-50 p-4 text-sm">
              {STEPS.map((s, i) => (
                <li
                  key={s}
                  className={
                    "flex items-center gap-2 transition " +
                    (i < step ? "text-emerald-700" : i === step ? "font-semibold text-indigo-700" : "text-slate-400")
                  }
                >
                  <span className={i === step ? "animate-pulse" : ""}>{i < step ? "✓" : i === step ? "●" : "○"}</span>
                  {s}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div ref={resultRef}>
          {result && <ReportView result={result} listingPrice={listingPrice} />}
        </div>
      </div>
    </main>
  );
}