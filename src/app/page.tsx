"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type DragEvent,
  type FormEvent,
} from "react";
import ReportView from "@/components/ReportView";

type ReportData = ComponentProps<typeof ReportView>["report"];

interface ApiResponse {
  success?: boolean;
  report?: ReportData;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 6_000_000;
const MIN_PRICE = 1000;
const MAX_PRICE = 1_000_000;
const MIN_BATTERY = 50;
const MAX_BATTERY = 100;
const MAX_USAGE_MONTHS = 120;

const AVAILABLE_TAGS: string[] = [
  "Kutulu & Faturalı",
  "Pil %85+",
  "Değişensiz / Orijinal",
  "Garantisi Var",
  "Face ID / True Tone Aktif",
  "Çizikler Var",
  "Ufak Çizikler Var",
  "Pil Değişmiş",
];

const EXCLUSIVE_TAGS: Record<string, string> = {
  "Çizikler Var": "Ufak Çizikler Var",
  "Ufak Çizikler Var": "Çizikler Var",
};

const STORAGE_OPTIONS = ["64GB", "128GB", "256GB", "512GB", "1TB"];

const POPULAR_MODELS: string[] = [
  "iPhone 11",
  "iPhone 12",
  "iPhone 12 Pro",
  "iPhone 13",
  "iPhone 13 mini",
  "iPhone 13 Pro",
  "iPhone 13 Pro Max",
  "iPhone 14",
  "iPhone 14 Plus",
  "iPhone 14 Pro",
  "iPhone 14 Pro Max",
  "iPhone 15",
  "iPhone 15 Plus",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  "iPhone 16",
  "iPhone 16 Pro",
  "Samsung Galaxy S21",
  "Samsung Galaxy S22",
  "Samsung Galaxy S23",
  "Samsung Galaxy S23 Ultra",
  "Samsung Galaxy S24",
  "Samsung Galaxy S24 Ultra",
  "Samsung Galaxy S25",
  "Samsung Galaxy A54",
  "Samsung Galaxy A34",
  "Samsung Galaxy A55",
  "Xiaomi Redmi Note 12",
  "Xiaomi Redmi Note 13",
  "Xiaomi Redmi Note 13 Pro",
  "Xiaomi 13T",
  "Xiaomi 14",
  "Poco X6 Pro",
  "Poco F5",
  "Google Pixel 7",
  "Google Pixel 8",
];

function detectStorage(model: string): string | null {
  const m = model.match(/(\d{2,4})\s?(gb|tb)/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : null;
}

function applyStorage(model: string, storage: string): string {
  const base = model.replace(/\s*\d{2,4}\s?(gb|tb)\b/gi, "").trim();
  return base ? `${base} ${storage}` : storage;
}

function formatDigits(digits: string): string {
  return digits ? new Intl.NumberFormat("tr-TR").format(Number(digits)) : "";
}

function drawToJpeg(source: CanvasImageSource, w: number, h: number, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(source, 0, 0, cw, ch);
  return canvas.toDataURL("image/jpeg", quality);
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

async function compressImage(file: File): Promise<string> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
  } catch {
    const img = await loadHtmlImage(file);
    source = img;
    width = img.naturalWidth;
    height = img.naturalHeight;
  }

  try {
    const attempts: Array<[number, number]> = [
      [1280, 0.82],
      [1280, 0.7],
      [1024, 0.6],
      [800, 0.55],
    ];
    let last = "";
    for (const [side, quality] of attempts) {
      last = drawToJpeg(source, width, height, side, quality);
      if (last.length <= MAX_DATA_URL_CHARS) return last;
    }
    return last;
  } finally {
    bitmap?.close();
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"image" | "text">("image");
  const [model, setModel] = useState("");
  const [priceDigits, setPriceDigits] = useState("");
  const [batteryDigits, setBatteryDigits] = useState("");
  const [usageDigits, setUsageDigits] = useState("");
  const [sellerNote, setSellerNote] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const timedOutRef = useRef(false);

  const detectedStorage = useMemo(() => detectStorage(model), [model]);

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Lütfen geçerli bir görsel dosyası (JPG, PNG, WebP) seçin.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setImageError("Görsel boyutu çok büyük (en fazla 15 MB).");
      return;
    }
    setImageError(null);
    setImageBusy(true);
    try {
      const dataUrl = await compressImage(file);
      if (dataUrl.length > MAX_DATA_URL_CHARS) {
        setImageError("Görsel çok büyük kaldı.");
      } else {
        setImageDataUrl(dataUrl);
        setImageName(file.name || "Yüklenen görsel");
        setAutoFilled(false);

        try {
          const extractRes = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });
          const extractJson = await extractRes.json();
          if (extractRes.ok && extractJson.success && extractJson.data) {
            const ext = extractJson.data;
            let filled = false;
            if (ext.extractedTitle || ext.model) {
              setModel(ext.extractedTitle || `${ext.brand || ""} ${ext.model} ${ext.storage || ""}`.trim());
              filled = true;
            }
            if (ext.extractedPrice) {
              const digits = String(ext.extractedPrice).replace(/\D/g, "").slice(0, 7);
              if (digits) {
                setPriceDigits(digits);
                filled = true;
              }
            }
            if (ext.sellerNote) {
              setSellerNote(ext.sellerNote);
              filled = true;
            }
            setAutoFilled(filled);
          }
        } catch {
          // Otomatik doldurma opsiyoneldir
        }
      }
    } catch {
      setImageError("Görsel okunamadı.");
    } finally {
      setImageBusy(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const img = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        void handleFile(img);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const removeImage = () => {
    setImageDataUrl(null);
    setImageName("");
    setImageError(null);
    setAutoFilled(false);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      const opposite = EXCLUSIVE_TAGS[tag];
      return [...prev.filter((t) => t !== opposite), tag];
    });
  };

  const resetAll = () => {
    setReport(null);
    setModel("");
    setPriceDigits("");
    setBatteryDigits("");
    setUsageDigits("");
    setSellerNote("");
    setSelectedTags([]);
    setImageDataUrl(null);
    setImageName("");
    setImageError(null);
    setAutoFilled(false);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  const cancelAnalysis = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (loading || imageBusy) return;

    const trimmedModel = model.trim();
    if (trimmedModel.length < 2) {
      setError("Lütfen cihaz modelini girin. Örn: iPhone 13 128GB");
      return;
    }
    const price = Number(priceDigits);
    if (!priceDigits || !Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
      setError("Lütfen 1.000 TL ile 1.000.000 TL arasında geçerli bir fiyat girin.");
      return;
    }

    const battery = batteryDigits === "" ? null : Number(batteryDigits);
    if (battery !== null && (!Number.isFinite(battery) || battery < MIN_BATTERY || battery > MAX_BATTERY)) {
      setError(`Pil sağlığı %${MIN_BATTERY} ile %${MAX_BATTERY} arasında olmalı. Bilmiyorsanız boş bırakın.`);
      return;
    }
    const usageMonths = usageDigits === "" ? null : Number(usageDigits);
    if (usageMonths !== null && (!Number.isFinite(usageMonths) || usageMonths > MAX_USAGE_MONTHS)) {
      setError(`Kullanım süresi en fazla ${MAX_USAGE_MONTHS} ay olabilir. Bilmiyorsanız boş bırakın.`);
      return;
    }

    setError(null);
    setElapsed(0);
    setLoading(true);
    cancelledRef.current = false;
    timedOutRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/ekspertiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: trimmedModel,
          listingPrice: price,
          tags: selectedTags,
          sellerNote: sellerNote.trim(),
          image: imageDataUrl,
          batteryHealthPct: battery,
          usageMonths,
        }),
      });

      let json: ApiResponse | null = null;
      try {
        json = (await res.json()) as ApiResponse;
      } catch {
        json = null;
      }

      if (res.ok && json?.success && json.report) {
        setReport(json.report);
        window.scrollTo({ top: 0 });
      } else {
        setError(json?.error || `Sunucu hatası (${res.status}). Lütfen tekrar deneyin.`);
      }
    } catch {
      if (timedOutRef.current) {
        setError("Analiz 90 saniyede tamamlanamadı. Lütfen tekrar deneyin.");
      } else if (!cancelledRef.current) {
        setError("Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.");
      }
    } finally {
      window.clearTimeout(timer);
      abortRef.current = null;
      setLoading(false);
    }
  };

  if (report) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-6 md:py-10">
        <div className="max-w-4xl mx-auto space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-widest text-indigo-400 uppercase">Almadan Önce — Yapay Zeka Ekspertiz</p>
              <h1 className="text-base font-bold text-white truncate">{model.trim()}</h1>
              <p className="text-xs text-zinc-400">İstenen fiyat: {formatDigits(priceDigits)} TL</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setReport(null);
                  window.scrollTo({ top: 0 });
                }}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-xl text-xs font-semibold transition"
              >
                ← Formu Düzenle
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold transition shadow-md shadow-indigo-600/20"
              >
                Yeni Analiz Başlat
              </button>
            </div>
          </div>
          <ReportView report={report} />
        </div>
      </main>
    );
  }

  const inputClass =
    "w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl px-4 py-3.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner";

  return (
    <main
      className="min-h-screen text-zinc-100 px-4 py-8 md:py-14 relative overflow-hidden"
      style={{
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(70rem 35rem at 50% -15%, rgba(99,102,241,0.22), transparent 65%), radial-gradient(50rem 30rem at 100% 0%, rgba(139,92,246,0.12), transparent 60%)",
      }}
    >
      <div className="max-w-2xl mx-auto space-y-8 relative z-10">
        
        {/* Başlık Bölümü */}
        <header className="text-center space-y-4 pt-2">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 shadow-sm backdrop-blur-md">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-black text-white shadow-md">
              AÖ
            </span>
            <span className="text-xs font-bold tracking-wider text-indigo-300 uppercase">Almadan Önce Terminali</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
            İkinci el telefonu almadan önce <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">30 saniyede</span> kontrol edin
          </h1>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            İlan fiyatını canlı ilanlarla karşılaştırır, aykırı fiyatları IQR süzgeciyle eler ve dolandırıcılık işaretlerini tarar. Yeterli canlı ilan bulunamazsa bunu açıkça söyler.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-1 text-[11px] font-medium text-zinc-300">
            <span className="px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm">⚡ Canlı İlan Karşılaştırması</span>
            <span className="px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm">🛡️ IQR Aykırı Fiyat Süzgeci</span>
            <span className="px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 shadow-sm">🎯 Gerçek İlan Alternatifleri</span>
          </div>
        </header>

        {/* Ana Form Kartı */}
        <form
          onSubmit={handleSubmit}
          aria-busy={loading}
          className="space-y-6 bg-zinc-900/80 p-6 md:p-8 rounded-3xl border border-zinc-800/90 shadow-2xl backdrop-blur-xl relative"
        >
          {/* Sekmeler */}
          <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800/80 w-full sm:w-fit" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "image"}
              onClick={() => setActiveTab("image")}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "image" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-zinc-400 hover:text-white"
              }`}
            >
              📸 Görsel Yükle (Otomatik Tanıma)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "text"}
              onClick={() => setActiveTab("text")}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "text" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-zinc-400 hover:text-white"
              }`}
            >
              📝 İlan Notu / Açıklama
            </button>
          </div>

          {/* Görsel Yükleme Alanı */}
          {activeTab === "image" && (
            <div className="space-y-3">
              {imageDataUrl ? (
                <div className="flex items-center gap-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageDataUrl} alt="Önizleme" className="w-20 h-20 object-cover rounded-xl border border-zinc-800 shadow-md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{imageName}</p>
                    {autoFilled ? (
                      <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                        ✓ Görsel yüklendi. Model, fiyat veya not otomatik dolduruldu, alanları kontrol edin.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-300 font-medium mt-0.5">
                        Görsel yüklendi. Otomatik doldurma yapılamadı, alanları elle girin.
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-2 rounded-xl transition font-medium"
                  >
                    Kaldır
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  className={`cursor-pointer text-center rounded-2xl border-2 border-dashed p-8 transition-all group ${
                    dragOver
                      ? "border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                      : "border-zinc-700/80 bg-zinc-950/60 hover:border-indigo-500/50 hover:bg-zinc-950/90"
                  }`}
                >
                  {imageBusy ? (
                    <div className="flex flex-col items-center space-y-2 py-2">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-indigo-400 border-t-transparent" />
                      <p className="text-xs font-semibold text-indigo-300">Görsel taranıyor, model ve fiyat çözümleniyor...</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400 group-hover:scale-110 transition-transform">
                        📤
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">İlan ekran görüntüsü veya cihaz fotoğrafı ekleyin</p>
                      <p className="text-xs text-zinc-400">Sürükleyip bırakın, tıklayın ya da <span className="text-indigo-400 font-medium">Ctrl+V</span> ile yapıştırın</p>
                    </div>
                  )}
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileInput} className="hidden" />
              {imageError && <p className="text-xs text-rose-400 font-medium">{imageError}</p>}
            </div>
          )}

          {activeTab === "text" && (
            <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-400 space-y-1.5">
              <p className="font-semibold text-zinc-200 text-sm">💡 İpucu</p>
              <p className="leading-relaxed">
                İlan bağlantıları çoğu zaman güvenilir okunamaz. En doğru sonuç için ilandaki açıklamayı kopyalayıp aşağıdaki <span className="text-indigo-300 font-medium">Satıcı Notu</span> alanına yapıştırın.
              </p>
            </div>
          )}

          {/* Model ve Fiyat Izgarası */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="model" className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase block">
                CİHAZ MODELİ *
              </label>
              <input
                id="model"
                type="text"
                list="model-list"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Örn: iPhone 13 128GB"
                autoComplete="off"
                maxLength={120}
                className={inputClass}
              />
              <datalist id="model-list">
                {POPULAR_MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>

              {/* Hızlı Depolama Seçim Rozetleri */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STORAGE_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setModel((prev) => applyStorage(prev, s))}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-xl border transition ${
                      detectedStorage === s
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-sm"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="price" className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase block">
                İLANDAKİ FİYAT (TL) *
              </label>
              <div className="relative">
                <input
                  id="price"
                  type="text"
                  inputMode="numeric"
                  value={formatDigits(priceDigits)}
                  onChange={(e) => setPriceDigits(e.target.value.replace(/\D/g, "").slice(0, 7))}
                  placeholder="Örn: 25.000"
                  autoComplete="off"
                  className={`${inputClass} pr-14 text-base font-semibold`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">TL</span>
              </div>
              <p className="text-[11px] text-zinc-500 pt-1">Bulunabilen canlı ilanların medyanıyla kıyaslanır.</p>
            </div>
          </div>

          {/* Pil Sağlığı ve Kullanım Süresi (isteğe bağlı) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label htmlFor="battery" className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase flex justify-between">
                <span>PİL SAĞLIĞI (%)</span>
                <span className="text-zinc-500 font-normal normal-case">isteğe bağlı</span>
              </label>
              <div className="relative">
                <input
                  id="battery"
                  type="text"
                  inputMode="numeric"
                  value={batteryDigits}
                  onChange={(e) => setBatteryDigits(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Örn: 87"
                  autoComplete="off"
                  className={`${inputClass} pr-12`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">%</span>
              </div>
              <p className="text-[11px] text-zinc-500">iPhone: Ayarlar → Pil → Pil Sağlığı. Bilmiyorsanız boş bırakın.</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="usage" className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase flex justify-between">
                <span>KULLANIM SÜRESİ (AY)</span>
                <span className="text-zinc-500 font-normal normal-case">isteğe bağlı</span>
              </label>
              <div className="relative">
                <input
                  id="usage"
                  type="text"
                  inputMode="numeric"
                  value={usageDigits}
                  onChange={(e) => setUsageDigits(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="Örn: 18"
                  autoComplete="off"
                  className={`${inputClass} pr-14`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">ay</span>
              </div>
              <p className="text-[11px] text-zinc-500">Cihazın kaç aydır kullanıldığı, biliniyorsa.</p>
            </div>
          </div>

          {/* Beyan Edilen Özellikler (Etiketler) */}
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase">CİHAZIN BİLİNEN ÖZELLİKLERİ (Seçmek için tıklayın)</p>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`text-xs px-3.5 py-2 rounded-xl border font-medium transition-all ${
                      isSelected
                        ? "bg-indigo-600/30 border-indigo-500 text-indigo-200 shadow-sm shadow-indigo-500/20"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Satıcı Notu */}
          <div className="space-y-2">
            <label htmlFor="note" className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase flex justify-between">
              <span>SATICI NOTU / İLAN AÇIKLAMASI</span>
              <span className="text-zinc-500 font-normal">{sellerNote.length}/2000</span>
            </label>
            <textarea
              id="note"
              rows={3}
              value={sellerNote}
              onChange={(e) => setSellerNote(e.target.value)}
              maxLength={2000}
              placeholder="Satıcının ilan açıklamasını buraya yapıştırın (Dolandırıcılık ve kapora uyarıları otomatik taranır)..."
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Hata Mesajı */}
          {error && (
            <div role="alert" className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-2xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Gönder Butonu / Yüklenme Durumu */}
          {loading ? (
            <div className="bg-indigo-600/15 border border-indigo-500/40 p-5 rounded-2xl text-center space-y-3 shadow-inner" aria-live="polite">
              <div className="inline-block animate-spin rounded-full h-7 w-7 border-2 border-indigo-400 border-t-transparent" />
              <p className="text-sm font-semibold text-indigo-200">Canlı ilanlar aranıyor ve rapor hazırlanıyor...</p>
              <p className="text-xs text-zinc-400">
                Geçen süre: {elapsed} sn. Aykırı fiyat süzgeci ve mühendislik motoru çalışıyor.
              </p>
              <button
                type="button"
                onClick={cancelAnalysis}
                className="text-xs text-zinc-300 hover:text-white underline underline-offset-2 font-medium pt-1"
              >
                İptal Et
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={imageBusy}
              className="w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-4.5 rounded-2xl shadow-xl shadow-indigo-600/25 transition-all active:scale-[0.99] text-sm tracking-wider uppercase"
            >
              ⚡ YAPAY ZEKA EKSPERTİZ & PAZAR TARAMASINI BAŞLAT
            </button>
          )}
        </form>

        <footer className="text-center text-[11px] text-zinc-500 space-y-1 pb-8">
          <p>Bu araç yapay zeka ve açık web verilerine dayanan profesyonel bir karar destek sistemidir.</p>
        </footer>
      </div>
    </main>
  );
}