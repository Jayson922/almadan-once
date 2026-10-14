"use client";

// src/app/page.tsx
// Ana sayfa: form, otomatik tanıma, ekspertiz isteği ve rapor ekranı.
// Gereksinim: src/components/CockpitPanels.tsx ve src/components/ReportView.tsx

import {
  Component, useCallback, useEffect, useMemo, useRef, useState,
  type ChangeEvent, type ComponentProps, type Dispatch, type DragEvent, type ErrorInfo,
  type FormEvent, type KeyboardEvent, type ReactNode, type SetStateAction,
} from "react";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import ReportView from "@/components/ReportView";
import { CockpitAside } from "@/components/CockpitPanels";

const displayFont = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], variable: "--font-display", display: "swap" });
const bodyFont = Manrope({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });

type ReportData = ComponentProps<typeof ReportView>["report"];

interface ApiResponse { success?: boolean; report?: unknown; error?: string }
interface ExtractResponse {
  success?: boolean;
  data?: { extractedTitle?: string; model?: string; brand?: string; storage?: string; extractedPrice?: unknown; sellerNote?: string };
  error?: string;
}

const REQUEST_TIMEOUT_MS = 90_000;
const EXTRACT_TIMEOUT_MS = 45_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_DATA_URL_CHARS = 6_000_000;
const MAX_EXTRA_PHOTOS = 3;
const MIN_PRICE = 1000;
const MAX_PRICE = 1_000_000;
const MIN_BATTERY = 50;
const MAX_BATTERY = 100;
const MAX_USAGE_MONTHS = 120;
const MAX_PURPOSES = 3;

const AVAILABLE_TAGS: string[] = [
  "Kutulu & Faturalı", "Pil %85+", "Değişensiz / Orijinal", "Garantisi Var",
  "Face ID / True Tone Aktif", "Çizikler Var", "Ufak Çizikler Var", "Pil Değişmiş",
];
const EXCLUSIVE_TAGS: Record<string, string> = { "Çizikler Var": "Ufak Çizikler Var", "Ufak Çizikler Var": "Çizikler Var" };

const STORAGE_OPTIONS = ["64GB", "128GB", "256GB", "512GB", "1TB"];
const RAM_OPTIONS = ["3", "4", "6", "8", "12", "16"];

const PURPOSES: string[] = [
  "Günlük kullanım", "Oyun", "Kamera ve fotoğraf", "İş ve okul", "Çocuk / yedek telefon", "Kısa süre kullanıp satmak",
];

/* Teknik kondisyon seçenekleri. Sunucuya mevcut not alanında "[Teknik]" satırları olarak gider. */
const SCREEN_OPTIONS = ["Kusursuz", "Hafif çizik", "Kırık / çatlak", "Ölü piksel", "Ekran yanığı", "Ekran değişmiş"];
const BODY_OPTIONS = ["Kusursuz", "Hafif çizik", "Ezik / darbe", "Çatlak", "Kasa değişmiş"];
const REPAIR_OPTIONS = ["Ekran", "Batarya", "Arka kamera", "Ön kamera", "Anakart", "Arka cam", "Şarj soketi", "Su teması izi"];
const TECH_TABS = [
  { id: "yuzey", label: "Ekran ve kasa" },
  { id: "parca", label: "Parçalar" },
  { id: "fonk", label: "Fonksiyonlar" },
  { id: "guvence", label: "Güvence" },
] as const;
type TechTab = (typeof TECH_TABS)[number]["id"];

function functionOptions(brand: string | null): string[] {
  return [
    "Dokunmatik", brand === "Apple" ? "Face ID / Touch ID" : "Parmak izi / yüz tanıma", "Hoparlör ve mikrofon",
    "Wi-Fi ve Bluetooth", "GPS", "Şarj girişi", "Titreşim", "Tuşlar", "Ön kamera", "Arka kamera", "Flaş", "Sensörler",
  ];
}
function lockOptions(brand: string | null): string[] {
  const account = brand === "Apple" ? "iCloud kilidi yok" : brand ? "Google / hesap kilidi yok" : "Hesap kilidi yok";
  return ["IMEI kayıtlı ve temiz", account, "Operatör kilidi yok", "Çalıntı / kayıp kaydı yok"];
}

const POPULAR_MODELS: string[] = [
  "iPhone 11", "iPhone 12", "iPhone 12 Pro", "iPhone 13", "iPhone 13 mini", "iPhone 13 Pro", "iPhone 13 Pro Max",
  "iPhone 14", "iPhone 14 Plus", "iPhone 14 Pro", "iPhone 14 Pro Max", "iPhone 15", "iPhone 15 Plus", "iPhone 15 Pro",
  "iPhone 15 Pro Max", "iPhone 16", "iPhone 16 Pro",
  "Samsung Galaxy S21", "Samsung Galaxy S22", "Samsung Galaxy S23", "Samsung Galaxy S23 Ultra", "Samsung Galaxy S24",
  "Samsung Galaxy S24 Ultra", "Samsung Galaxy S25", "Samsung Galaxy A54", "Samsung Galaxy A34", "Samsung Galaxy A55",
  "Xiaomi Redmi Note 12", "Xiaomi Redmi Note 13", "Xiaomi Redmi Note 13 Pro", "Xiaomi 13T", "Xiaomi 14", "Poco X6 Pro",
  "Poco F5", "Google Pixel 7", "Google Pixel 8",
];

/* iPhone modellerinde RAM sabittir, depolama seçenekleri modele göre değişir. */
const S3 = ["64GB", "128GB", "256GB"];
const S3b = ["128GB", "256GB", "512GB"];
const S4 = ["128GB", "256GB", "512GB", "1TB"];
const IPHONE_INFO: Record<string, { ram: number; storage: string[] }> = {
  "iphone 11": { ram: 4, storage: S3 },
  "iphone 12": { ram: 4, storage: S3 },
  "iphone 12 pro": { ram: 6, storage: S3b },
  "iphone 13": { ram: 4, storage: S3b },
  "iphone 13 mini": { ram: 4, storage: S3b },
  "iphone 13 pro": { ram: 6, storage: S4 },
  "iphone 13 pro max": { ram: 6, storage: S4 },
  "iphone 14": { ram: 6, storage: S3b },
  "iphone 14 plus": { ram: 6, storage: S3b },
  "iphone 14 pro": { ram: 6, storage: S4 },
  "iphone 14 pro max": { ram: 6, storage: S4 },
  "iphone 15": { ram: 6, storage: S3b },
  "iphone 15 plus": { ram: 6, storage: S3b },
  "iphone 15 pro": { ram: 8, storage: S4 },
  "iphone 15 pro max": { ram: 8, storage: ["256GB", "512GB", "1TB"] },
  "iphone 16": { ram: 8, storage: S3b },
  "iphone 16 pro": { ram: 8, storage: S4 },
};

type Brand = "Apple" | "Samsung" | "Xiaomi / Poco" | "Google" | "Diğer";
const BRANDS: Brand[] = ["Apple", "Samsung", "Xiaomi / Poco", "Google", "Diğer"];

function brandOf(model: string): Brand | null {
  const m = model.trim().toLowerCase();
  if (!m) return null;
  if (m.startsWith("iphone")) return "Apple";
  if (m.startsWith("samsung") || m.startsWith("galaxy")) return "Samsung";
  if (m.startsWith("xiaomi") || m.startsWith("redmi") || m.startsWith("poco")) return "Xiaomi / Poco";
  if (m.startsWith("google") || m.startsWith("pixel")) return "Google";
  return null;
}
function modelsOfBrand(brand: Brand): string[] {
  return POPULAR_MODELS.filter((m) => brandOf(m) === brand);
}

const SCAN_STEPS = ["Görsel okunuyor", "Marka ve model aranıyor", "Depolama ve fiyat çözümleniyor"];
const ANALYSIS_STEPS = [
  "İlan bilgileri okunuyor", "Cihaz kimliği doğrulanıyor", "Canlı piyasa taranıyor",
  "Aykırı fiyatlar süzülüyor", "Risk ve teknik rapor hazırlanıyor",
];

/* ---------- Alan doğrulama tipleri ---------- */

type FieldKey = "model" | "price" | "budget" | "battery" | "usage" | "url";
type FieldErrors = Partial<Record<FieldKey, string>>;
const FIELD_DOM_ID: Record<FieldKey, string> = {
  model: "model", price: "price", budget: "budget", battery: "battery", usage: "usage", url: "listing-url",
};
const FIELD_ORDER: FieldKey[] = ["model", "price", "budget", "battery", "usage", "url"];

/* ---------- Otomatik tanıma durumu ---------- */

type ExtractStatus = "idle" | "running" | "filled" | "empty" | "failed" | "skipped";
interface ExtractState { status: ExtractStatus; message: string | null }
const IDLE_EXTRACT: ExtractState = { status: "idle", message: null };
interface FilledFields { model: boolean; price: boolean; note: boolean }
const NO_FILLED: FilledFields = { model: false, price: false, note: false };
interface TouchedFields { model: boolean; price: boolean; note: boolean }
const NO_TOUCHED: TouchedFields = { model: false, price: false, note: false };

/* ---------- Yardımcılar ---------- */

function detectStorage(model: string): string | null {
  const m = model.match(/(\d{2,4})\s?(gb|tb)/i);
  return m ? `${m[1]}${m[2].toUpperCase()}` : null;
}
function baseModelName(model: string): string {
  return model.replace(/\s*\d{2,4}\s?(gb|tb)\b/gi, "").trim();
}
function applyStorage(model: string, storage: string): string {
  const base = baseModelName(model);
  return base ? `${base} ${storage}` : storage;
}
function formatDigits(digits: string): string {
  return digits ? new Intl.NumberFormat("tr-TR").format(Number(digits)) : "";
}
function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** Fiyat metnini ya da sayısını rakam dizisine çevirir. Aralık dışıysa null döner. */
function parsePriceValue(raw: unknown): string | null {
  let n: number;
  if (typeof raw === "number") {
    n = Math.round(raw);
  } else if (typeof raw === "string") {
    n = Number(raw.split(",")[0].replace(/\D/g, ""));
  } else {
    return null;
  }
  if (!Number.isFinite(n) || n < MIN_PRICE || n > MAX_PRICE) return null;
  return String(n);
}

function describeHttpError(status: number, serverMessage?: string): string {
  const msg = serverMessage?.trim();
  if (status === 429) return "Yapay zeka kullanım kotası şu an dolu. Birkaç dakika sonra tekrar dene.";
  if (status === 413) return "Gönderilen görseller çok büyük. Ek fotoğrafları kaldırıp tekrar dene.";
  if (status === 408 || status === 504) return "Sunucu yanıt vermekte gecikti. Tekrar dene.";
  if (status >= 400 && status < 500) return msg || "Girilen bilgiler doğrulanamadı. Alanları kontrol edip tekrar dene.";
  return msg || `Sunucuda geçici bir sorun oluştu (${status}). Birkaç saniye sonra tekrar dene.`;
}

function describeExtractError(status: number, serverMessage?: string): string {
  const msg = serverMessage?.trim();
  if (status === 429) return "Yapay zeka kotası şu an dolu, görselden otomatik tanıma yapılamadı. Model ve fiyatı elle girebilirsin.";
  if (status === 413) return "Görsel tanıma için çok büyük. Daha küçük bir ekran görüntüsüyle dene ya da bilgileri elle gir.";
  return msg
    ? `Otomatik tanıma yapılamadı: ${msg} Model ve fiyatı elle girebilirsin.`
    : "Otomatik tanıma yapılamadı. Model ve fiyatı elle girebilirsin ya da tekrar deneyebilirsin.";
}

/** Sunucudan gelen rapor, arayüzün zorunlu tuttuğu alanları taşıyor mu? Eksikse ekran çökmesin diye reddedilir. */
function isUsableReport(value: unknown): value is ReportData {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const isObj = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v);
  const arrays = [
    "warnings", "checklist", "riskAnalysis", "technicalItems", "hardwareMetrics",
    "betterAlternatives", "imageFindings", "strengths", "missingData",
  ];
  return (
    typeof r.generatedAt === "string" &&
    typeof r.productName === "string" &&
    typeof r.listingPrice === "number" &&
    isObj(r.basis) && isObj(r.identity) && isObj(r.priceDeviation) && isObj(r.bargainingPlan) &&
    arrays.every((k) => Array.isArray(r[k]))
  );
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
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

const MAIN_ATTEMPTS: Array<[number, number]> = [[1280, 0.82], [1280, 0.7], [1024, 0.6], [800, 0.55]];
const EXTRA_ATTEMPTS: Array<[number, number]> = [[960, 0.7], [800, 0.6], [640, 0.55]];

async function compressImage(file: File, attempts: Array<[number, number]> = MAIN_ATTEMPTS): Promise<string> {
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

/* ---------- SVG ikonlar ---------- */

const svgBase = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

function IconPhoneScan({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" strokeWidth="1.6" {...svgBase} className={className}>
      <rect x="14" y="5" width="20" height="38" rx="4" />
      <path d="M21 9h6" />
      <path d="M8 18V12a4 4 0 0 1 4-4M40 18V12a4 4 0 0 0-4-4M8 30v6a4 4 0 0 0 4 4M40 30v6a4 4 0 0 1-4 4" opacity=".55" />
      <path d="M18 24h12" />
    </svg>
  );
}
function IconLink({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...svgBase} className={className}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </svg>
  );
}
function IconImage({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...svgBase} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 18 5-5 4 4 3-3 4 4" />
    </svg>
  );
}
function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" strokeWidth="2.4" {...svgBase} className={className}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}
function IconShield({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...svgBase} className={className}>
      <path d="M12 3 5 6v5c0 4.5 2.8 8.3 7 10 4.2-1.7 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...svgBase} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconAlert({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="2" {...svgBase} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </svg>
  );
}
function IconWrench({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth="1.8" {...svgBase} className={className}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.1-.6-.6-2.1 2.4-2.4Z" />
    </svg>
  );
}

/* ---------- Ortak stiller ve arka plan ---------- */

const PAGE_CSS = `
.ao-root{
  --ink:#020617;
  --panel:#0E1527;
  --field:#0A1120;
  --line:rgba(255,255,255,.08);
  --line-strong:rgba(255,255,255,.15);
  --cyan:#FBBF24;
  --coral:#10B981;
  font-family: var(--font-body), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.ao-display{ font-family: var(--font-display), var(--font-body), system-ui, sans-serif; letter-spacing:-0.02em; }

/* Sabit, katmanlı zemin: derinlik, ince ızgara, tane ve vinyet. Kaydırmada yerinde durur. */
.ao-backdrop{
  position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden;
  background:
    radial-gradient(1100px 640px at 8% -12%, rgba(245,158,11,.13), transparent 62%),
    radial-gradient(900px 560px at 104% 6%, rgba(112,104,255,.09), transparent 62%),
    radial-gradient(880px 640px at 92% 112%, rgba(16,185,129,.09), transparent 62%),
    linear-gradient(180deg, #030816 0%, #020617 100%);
}
.ao-backdrop::before{
  content:""; position:absolute; inset:0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 78%);
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 20%, transparent 78%);
}
.ao-backdrop::after{
  content:""; position:absolute; inset:0; opacity:.07; mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
}
.ao-vignette{
  position:absolute; inset:0;
  background: radial-gradient(ellipse 120% 90% at 50% 40%, transparent 55%, rgba(2,4,10,.65) 100%);
}

/* Üst bar */
.ao-topbar{
  position:sticky; top:0; z-index:30;
  background: rgba(2,6,23,.78);
  -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
  border-bottom:1px solid var(--line);
}
.ao-chip{
  display:inline-flex; align-items:center; gap:.4rem;
  border:1px solid var(--line); background: rgba(255,255,255,.03);
  border-radius:999px; padding:.3rem .7rem; font-size:.75rem; font-weight:600; color: rgba(255,255,255,.62);
}
.ao-chip.is-live{ border-color:rgba(16,185,129,.45); background:rgba(16,185,129,.1); color:#6ee7b7; }
.ao-chip.is-gold{ border-color:rgba(245,158,11,.4); background:rgba(245,158,11,.08); color:#fcd34d; }
.ao-chip.is-live .ao-dot{ background:#34d399; box-shadow:0 0 0 3px rgba(52,211,153,.22); }
.ao-dot{ width:.4rem; height:.4rem; border-radius:999px; background: var(--cyan); box-shadow:0 0 0 3px rgba(245,158,11,.16); }

/* Yüzey: ince altın kenarlık, üst parıltı çizgisi ve içten ışık */
.ao-card{
  position:relative; border-radius:20px;
  background: linear-gradient(180deg, rgba(19,28,52,.94), rgba(12,18,36,.94));
  border:1px solid rgba(245,158,11,.28);
  box-shadow:
    0 0 32px -10px rgba(245,158,11,.35),
    0 1px 0 rgba(255,255,255,.06) inset,
    0 0 0 1px rgba(0,0,0,.35),
    0 50px 100px -48px rgba(0,0,0,.95);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
}
.ao-card::before{
  content:""; position:absolute; top:0; left:10%; right:10%; height:1px; pointer-events:none;
  background: linear-gradient(90deg, transparent, rgba(245,158,11,.55), transparent);
}

@keyframes ao-scan { 0%{ top:6%; opacity:0 } 12%{ opacity:1 } 88%{ opacity:1 } 100%{ top:94%; opacity:0 } }
.ao-scanline{
  position:absolute; left:6%; right:6%; height:2px; border-radius:2px;
  background: linear-gradient(90deg, transparent, var(--cyan), transparent);
  box-shadow: 0 0 18px 4px rgba(245,158,11,.45);
  animation: ao-scan 1.9s ease-in-out infinite;
}
@keyframes ao-sheen { 0%{ transform:translateX(-120%) } 100%{ transform:translateX(220%) } }
.ao-cta{ position:relative; overflow:hidden; }
.ao-cta::after{
  content:""; position:absolute; inset:0; width:40%;
  background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
  transform: translateX(-120%);
}
.ao-cta:hover::after{ animation: ao-sheen .9s ease; }
@keyframes ao-bar { 0%{ background-position:0 0 } 100%{ background-position:40px 0 } }
.ao-progress{
  background-image: repeating-linear-gradient(115deg, rgba(255,255,255,.22) 0 10px, transparent 10px 20px);
  animation: ao-bar 1s linear infinite;
}
.ao-corner{ position:absolute; width:22px; height:22px; border-color: var(--cyan); opacity:.9; transition: width .2s ease, height .2s ease; }
.ao-corner.tl{ top:12px; left:12px; border-top-width:2px; border-left-width:2px; border-top-left-radius:8px; }
.ao-corner.tr{ top:12px; right:12px; border-top-width:2px; border-right-width:2px; border-top-right-radius:8px; }
.ao-corner.bl{ bottom:12px; left:12px; border-bottom-width:2px; border-left-width:2px; border-bottom-left-radius:8px; }
.ao-corner.br{ bottom:12px; right:12px; border-bottom-width:2px; border-right-width:2px; border-bottom-right-radius:8px; }
.ao-drop:hover .ao-corner, .ao-drop.is-over .ao-corner{ width:28px; height:28px; }
.ao-hscroll{ scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.18) transparent; }
.ao-fieldset{ margin:0; min-width:0; border:0; padding:0; }
@media (prefers-reduced-motion: reduce){
  .ao-scanline, .ao-progress, .ao-cta:hover::after{ animation:none !important; }
  .ao-corner{ transition:none; }
  .ao-anim{ transition:none !important; }
}
`;

function Shell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <main className={`ao-root ${displayFont.variable} ${bodyFont.variable} relative min-h-screen overflow-x-clip bg-[var(--ink)] text-white`}>
      <style>{PAGE_CSS}</style>
      <div className="ao-backdrop" aria-hidden="true">
        <div className="ao-vignette" />
      </div>
      <div className="relative z-10">
        <div className="ao-topbar">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Wordmark />
            {right ?? (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="ao-chip is-live">
                  <span className="ao-dot" />
                  Canlı Veri Analizi: AKTİF
                </span>
                <span className="ao-chip is-gold">Yapay Zeka Taraması v4.2</span>
                <span className="ao-chip is-gold">BDDK &amp; KVKK Uyumlu Güvence</span>
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--cyan)] text-[var(--ink)] shadow-[0_0_24px_-4px_rgba(245,158,11,.7)]">
        <IconShield className="h-5 w-5" />
      </span>
      <span className="ao-display bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">
        Almadan Önce
      </span>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-[var(--line)] pt-6">
      <div className="space-y-1">
        <h2 className="ao-display text-lg font-bold text-amber-200">{title}</h2>
        {hint && <p className="text-sm leading-relaxed text-white/50">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-xs font-medium leading-relaxed text-rose-300">
      <IconAlert className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/** Tek ya da çoklu seçimli çip grubu. Tekrar tıklayınca seçim kalkar. */
function ChipGroup({ label, options, selected, onToggle, tone = "gold" }: {
  label: string; options: string[]; selected: string[]; onToggle: (o: string) => void; tone?: "gold" | "red";
}) {
  const on = tone === "red"
    ? "border-rose-400/70 bg-rose-400/15 text-rose-100"
    : "border-amber-300/70 bg-amber-300/15 text-amber-50";
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-white/90">{label}</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => {
          const sel = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={sel}
              onClick={() => onToggle(o)}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)] ${
                sel ? on : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              {sel && <IconCheck className="h-3.5 w-3.5" />}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Rapor çizilirken beklenmedik bir veri şekli ekranı çökertmesin diye araya girer. */
class ReportBoundary extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state: { failed: boolean } = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Rapor ekranı çizilemedi:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="ao-card space-y-3 p-6">
        <p className="ao-display text-lg font-bold text-white">Rapor ekranı açılamadı</p>
        <p className="text-sm leading-relaxed text-white/65">
          Sunucudan gelen rapor beklenmedik bir biçimde geldi. Formu düzenleyip analizi yeniden çalıştırabilirsin.
        </p>
        <button
          type="button"
          onClick={this.props.onBack}
          className="rounded-lg bg-[var(--coral)] px-4 py-2.5 text-sm font-bold text-[#03140d] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          Forma dön
        </button>
      </div>
    );
  }
}
export default function Home() {
  const [activeTab, setActiveTab] = useState<"image" | "link">("image");
  const [brandFilter, setBrandFilter] = useState<Brand | null>(null);
  const [model, setModel] = useState("");
  const [ramGb, setRamGb] = useState("");
  const [priceDigits, setPriceDigits] = useState("");
  const [budgetDigits, setBudgetDigits] = useState("");
  const [batteryDigits, setBatteryDigits] = useState("");
  const [usageDigits, setUsageDigits] = useState("");
  const [purposes, setPurposes] = useState<string[]>([]);
  const [sellerNote, setSellerNote] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  /* Teknik kondisyon */
  const [techTab, setTechTab] = useState<TechTab>("yuzey");
  const [screenState, setScreenState] = useState("");
  const [bodyState, setBodyState] = useState("");
  const [repairs, setRepairs] = useState<string[]>([]);
  const [funcs, setFuncs] = useState<string[]>([]);
  const [locks, setLocks] = useState<string[]>([]);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [extractState, setExtractState] = useState<ExtractState>(IDLE_EXTRACT);
  const [filledFields, setFilledFields] = useState<FilledFields>(NO_FILLED);
  const [scanStep, setScanStep] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const extractAbortRef = useRef<AbortController | null>(null);
  const extractSeqRef = useRef(0);
  const touchedRef = useRef<TouchedFields>({ ...NO_TOUCHED });

  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);
  const extraInputRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [report, setReport] = useState<ReportData | null>(null);
  const [submitted, setSubmitted] = useState<{ model: string; price: number } | null>(null);
  const [liveMessage, setLiveMessage] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const cancelledRef = useRef(false);
  const timedOutRef = useRef(false);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const loadingPanelRef = useRef<HTMLDivElement | null>(null);
  const reportHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const detectedStorage = useMemo(() => detectStorage(model), [model]);
  const modelInfo = useMemo(() => IPHONE_INFO[baseModelName(model).toLowerCase()] ?? null, [model]);
  const activeBrand: Brand | null = brandFilter ?? brandOf(model);
  const storageOptions = modelInfo ? modelInfo.storage : STORAGE_OPTIONS;
  const ramValue: number | null = modelInfo ? modelInfo.ram : ramGb ? Number(ramGb) : null;
  const scanning = imageBusy || extractState.status === "running";

  const functionList = useMemo(() => functionOptions(activeBrand), [activeBrand]);
  const lockList = useMemo(() => lockOptions(activeBrand), [activeBrand]);

  /* Sağdaki donanım haritası, etiketlerle birlikte teknik kondisyonu da gösterir. */
  const mapTags = useMemo(() => {
    const t = [...selectedTags];
    const worn = (s: string) => !!s && s !== "Kusursuz";
    if (worn(screenState) || worn(bodyState)) t.push("Çizikler Var");
    if (repairs.includes("Batarya")) t.push("Pil Değişmiş");
    if (bodyState === "Kusursuz" && repairs.length === 0) t.push("Değişensiz / Orijinal");
    return t;
  }, [selectedTags, screenState, bodyState, repairs]);

  const clearFieldError = (key: FieldKey) => {
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const toggleIn = (setter: Dispatch<SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  /* ---------- Görselden otomatik tanıma ---------- */

  const runExtract = useCallback(async (dataUrl: string) => {
    extractAbortRef.current?.abort();
    const seq = ++extractSeqRef.current;
    const controller = new AbortController();
    extractAbortRef.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, EXTRACT_TIMEOUT_MS);

    setExtractState({ status: "running", message: null });
    setFilledFields(NO_FILLED);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ image: dataUrl }),
      });
      let json: ExtractResponse | null = null;
      try {
        json = (await res.json()) as ExtractResponse;
      } catch {
        json = null;
      }
      if (seq !== extractSeqRef.current) return;

      if (!res.ok || !json?.success || !json.data) {
        setExtractState({ status: "failed", message: describeExtractError(res.status, json?.error) });
        return;
      }

      const ext = json.data;
      const touched = touchedRef.current;
      const flags: FilledFields = { model: false, price: false, note: false };

      const title = (ext.extractedTitle || (ext.model ? `${ext.brand || ""} ${ext.model} ${ext.storage || ""}` : ""))
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      const priceDigitsFound = parsePriceValue(ext.extractedPrice);
      const noteFound = typeof ext.sellerNote === "string" ? ext.sellerNote.trim().slice(0, 2000) : "";
      const found = !!title || !!priceDigitsFound || !!noteFound;

      if (title && !touched.model) {
        setModel(title);
        setBrandFilter(null);
        setRamGb("");
        flags.model = true;
      }
      if (priceDigitsFound && !touched.price) {
        setPriceDigits(priceDigitsFound);
        flags.price = true;
      }
      if (noteFound && !touched.note) {
        setSellerNote(noteFound);
        flags.note = true;
      }

      setFilledFields(flags);
      if (flags.model || flags.price || flags.note) {
        setFieldErrors((prev) => ({
          ...prev,
          model: flags.model ? undefined : prev.model,
          price: flags.price ? undefined : prev.price,
        }));
        setExtractState({ status: "filled", message: null });
      } else if (found) {
        setExtractState({ status: "filled", message: "Elle yazdığın alanlar değiştirilmedi." });
      } else {
        setExtractState({
          status: "empty",
          message: "Görselden cihaz ya da fiyat okunamadı. Model ve fiyatı elle girebilirsin ya da daha net bir görselle dene.",
        });
      }
    } catch {
      if (seq !== extractSeqRef.current) return;
      if (timedOut) {
        setExtractState({
          status: "failed",
          message: "Otomatik tanıma zaman aşımına uğradı. Bilgileri elle girebilirsin ya da tekrar deneyebilirsin.",
        });
      } else if (controller.signal.aborted) {
        setExtractState({ status: "skipped", message: "Otomatik tanıma atlandı. Model ve fiyatı elle girebilirsin." });
      } else {
        setExtractState({
          status: "failed",
          message: "Otomatik tanıma için sunucuya bağlanılamadı. Bilgileri elle girebilirsin ya da tekrar deneyebilirsin.",
        });
      }
    } finally {
      window.clearTimeout(timer);
      if (extractAbortRef.current === controller) extractAbortRef.current = null;
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file || loadingRef.current) return;
      if (!file.type.startsWith("image/")) {
        setImageError("Lütfen geçerli bir görsel dosyası (JPG, PNG, WebP) seç.");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setImageError("Görsel boyutu çok büyük (en fazla 15 MB).");
        return;
      }
      setImageError(null);
      setImageBusy(true);

      let dataUrl: string;
      try {
        dataUrl = await compressImage(file);
      } catch {
        setImageBusy(false);
        setImageError("Görsel okunamadı. Farklı bir dosya dene.");
        return;
      }
      setImageBusy(false);

      if (dataUrl.length > MAX_DATA_URL_CHARS) {
        setImageError("Görsel işlendikten sonra bile çok büyük kaldı. Daha küçük bir ekran görüntüsü dene.");
        return;
      }

      setImageDataUrl(dataUrl);
      setImageName(file.name || "Yüklenen görsel");
      void runExtract(dataUrl);
    },
    [runExtract],
  );

  const cancelExtract = () => {
    extractSeqRef.current += 1;
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    setExtractState({ status: "skipped", message: "Otomatik tanıma atlandı. Model ve fiyatı elle girebilirsin." });
  };

  const retryExtract = () => {
    if (imageDataUrl && !loadingRef.current) void runExtract(imageDataUrl);
  };

  const removeImage = () => {
    extractSeqRef.current += 1;
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    setImageDataUrl(null);
    setImageName("");
    setImageError(null);
    setExtractState(IDLE_EXTRACT);
    setFilledFields(NO_FILLED);
  };

  const addExtraPhotos = async (files: FileList | null) => {
    if (!files || loadingRef.current) return;
    setExtraError(null);
    const room = MAX_EXTRA_PHOTOS - extraPhotos.length;
    const picked = Array.from(files)
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_FILE_BYTES)
      .slice(0, Math.max(0, room));
    if (picked.length === 0) {
      setExtraError("Geçerli bir görsel seç (JPG, PNG, WebP, en fazla 15 MB).");
      return;
    }
    setExtraBusy(true);
    try {
      const out: string[] = [];
      for (const f of picked) {
        out.push(await compressImage(f, EXTRA_ATTEMPTS));
      }
      setExtraPhotos((prev) => [...prev, ...out].slice(0, MAX_EXTRA_PHOTOS));
    } catch {
      setExtraError("Fotoğraf okunamadı. Farklı bir dosya dene.");
    } finally {
      setExtraBusy(false);
    }
  };

  /* ---------- Efektler ---------- */

  useEffect(() => {
    if (report) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const img = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (img) {
        e.preventDefault();
        setActiveTab("image");
        void handleFile(img);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [handleFile, report]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      extractAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!loading) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [loading]);

  useEffect(() => {
    if (!scanning) return;
    setScanStep(0);
    const id = window.setInterval(() => setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)), 2200);
    return () => window.clearInterval(id);
  }, [scanning]);

  /* Analiz sürerken sekme kapatılırsa uyar. */
  useEffect(() => {
    if (!loading) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [loading]);

  /* Analiz başlayınca ilerleme paneli görünür olsun. */
  useEffect(() => {
    if (!loading) return;
    loadingPanelRef.current?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  }, [loading]);

  /* Hata çıkınca ekranda görünür olsun. */
  useEffect(() => {
    if (!error) return;
    errorRef.current?.scrollIntoView({ block: "nearest", behavior: scrollBehavior() });
  }, [error]);

  /* Rapor gelince başa dön ve başlığa odaklan (ekran okuyucu için). */
  useEffect(() => {
    if (!report) return;
    window.scrollTo({ top: 0 });
    const id = window.requestAnimationFrame(() => reportHeadingRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(id);
  }, [report]);

  /* ---------- Olay işleyicileri ---------- */

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    void handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onExtraInput = (e: ChangeEvent<HTMLInputElement>) => {
    void addExtraPhotos(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (loading) return;
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const onFormTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const next = activeTab === "image" ? "link" : "image";
    setActiveTab(next);
    window.requestAnimationFrame(() => document.getElementById(`ftab-${next}`)?.focus());
  };

  const onTechTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const i = TECH_TABS.findIndex((t) => t.id === techTab);
    const n = TECH_TABS.length;
    const j = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    const next = TECH_TABS[j].id;
    setTechTab(next);
    window.requestAnimationFrame(() => document.getElementById(`ttab-${next}`)?.focus());
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      const opposite = EXCLUSIVE_TAGS[tag];
      return [...prev.filter((t) => t !== opposite), tag];
    });
  };

  const togglePurpose = (p: string) => {
    setPurposes((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (prev.length >= MAX_PURPOSES) return prev;
      return [...prev, p];
    });
  };

  const pickModel = (name: string) => {
    touchedRef.current.model = true;
    setModel(detectedStorage ? applyStorage(name, detectedStorage) : name);
    setRamGb("");
    clearFieldError("model");
  };

  const resetAll = () => {
    extractSeqRef.current += 1;
    extractAbortRef.current?.abort();
    extractAbortRef.current = null;
    touchedRef.current = { ...NO_TOUCHED };
    setReport(null);
    setSubmitted(null);
    setLiveMessage("");
    setBrandFilter(null);
    setModel("");
    setRamGb("");
    setPriceDigits("");
    setBudgetDigits("");
    setBatteryDigits("");
    setUsageDigits("");
    setPurposes([]);
    setSellerNote("");
    setListingUrl("");
    setSelectedTags([]);
    setScreenState("");
    setBodyState("");
    setRepairs([]);
    setFuncs([]);
    setLocks([]);
    setTechTab("yuzey");
    setImageDataUrl(null);
    setImageName("");
    setImageError(null);
    setExtraPhotos([]);
    setExtraError(null);
    setExtractState(IDLE_EXTRACT);
    setFilledFields(NO_FILLED);
    setFieldErrors({});
    setError(null);
    setCanRetry(false);
    setActiveTab("image");
    window.scrollTo({ top: 0 });
  };

  const backToForm = () => {
    setReport(null);
    setLiveMessage("");
    window.scrollTo({ top: 0 });
  };

  const cancelAnalysis = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
  };

  const focusField = (key: FieldKey) => {
    if (key === "url" && activeTab !== "link") setActiveTab("link");
    window.setTimeout(
      () => {
        const el = document.getElementById(FIELD_DOM_ID[key]);
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: scrollBehavior() });
        el.focus({ preventScroll: true });
      },
      key === "url" ? 80 : 0,
    );
  };

  const validateForm = () => {
    const errs: FieldErrors = {};

    const trimmedModel = model.trim();
    if (trimmedModel.length < 2) {
      errs.model = "Cihaz modelini yaz ya da listeden seç. Örn: iPhone 13 128GB";
    }

    const price = Number(priceDigits);
    if (!priceDigits) {
      errs.price = "İlandaki fiyatı gir.";
    } else if (!Number.isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
      errs.price = "Fiyat 1.000 TL ile 1.000.000 TL arasında olmalı.";
    }

    const budget = budgetDigits === "" ? null : Number(budgetDigits);
    if (budget !== null && (!Number.isFinite(budget) || budget < MIN_PRICE || budget > MAX_PRICE)) {
      errs.budget = "Bütçe 1.000 TL ile 1.000.000 TL arasında olmalı. İstemiyorsan boş bırak.";
    }

    const battery = batteryDigits === "" ? null : Number(batteryDigits);
    if (battery !== null && (!Number.isFinite(battery) || battery < MIN_BATTERY || battery > MAX_BATTERY)) {
      errs.battery = `Pil sağlığı %${MIN_BATTERY} ile %${MAX_BATTERY} arasında olmalı. Bilmiyorsan boş bırak.`;
    }

    const usageMonths = usageDigits === "" ? null : Number(usageDigits);
    if (usageMonths !== null && (!Number.isFinite(usageMonths) || usageMonths > MAX_USAGE_MONTHS)) {
      errs.usage = `Kullanım süresi en fazla ${MAX_USAGE_MONTHS} ay olabilir. Bilmiyorsan boş bırak.`;
    }

    const trimmedUrl = listingUrl.trim();
    if (trimmedUrl && !/^https?:\/\/\S+$/i.test(trimmedUrl)) {
      errs.url = "Bağlantı http:// veya https:// ile başlamalı. Tarayıcıdan kopyalayıp yapıştır.";
    }

    return { errs, trimmedModel, price, budget, battery, usageMonths, trimmedUrl };
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (loadingRef.current) return;

    if (scanning || extraBusy) {
      setCanRetry(false);
      setError("Görsel hâlâ işleniyor. Bitmesini bekle ya da otomatik tanımayı atla.");
      return;
    }

    const v = validateForm();
    const firstInvalid = FIELD_ORDER.find((k) => v.errs[k]);
    setFieldErrors(v.errs);
    if (firstInvalid) {
      setError(null);
      focusField(firstInvalid);
      return;
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setCanRetry(true);
      setError("İnternet bağlantın yok gibi görünüyor. Bağlantıyı kontrol edip tekrar dene.");
      return;
    }

    setError(null);
    setCanRetry(false);
    setElapsed(0);
    setLoading(true);
    loadingRef.current = true;
    cancelledRef.current = false;
    timedOutRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    const profileLines = [
      purposes.length ? `[Alıcı bilgisi] Kullanım amacı: ${purposes.join(", ")}` : "",
      ramValue ? `[Alıcı bilgisi] RAM: ${ramValue} GB` : "",
      v.budget ? `[Alıcı bilgisi] Bütçe üst sınırı: ${formatDigits(budgetDigits)} TL` : "",
      v.trimmedUrl ? `İlan linki: ${v.trimmedUrl}` : "",
    ];
    const techLines = [
      screenState ? `[Teknik] Ekran durumu: ${screenState}` : "",
      bodyState ? `[Teknik] Kasa durumu: ${bodyState}` : "",
      repairs.length ? `[Teknik] Değişen ya da onarılan parçalar: ${repairs.join(", ")}` : "",
      funcs.length ? `[Teknik] Sorunsuz çalışan fonksiyonlar: ${funcs.join(", ")}` : "",
      locks.length ? `[Teknik] Kilit ve kayıt güvencesi: ${locks.join(", ")}` : "",
    ];
    const noteForServer = [...profileLines, ...techLines, sellerNote.trim()].filter(Boolean).join("\n").slice(0, 2000);

    try {
      const res = await fetch("/api/ekspertiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: v.trimmedModel,
          listingPrice: v.price,
          tags: selectedTags,
          sellerNote: noteForServer,
          image: imageDataUrl,
          batteryHealthPct: v.battery,
          usageMonths: v.usageMonths,
          extraImages: extraPhotos.length ? extraPhotos : undefined,
          profile: {
            brand: activeBrand,
            storage: detectedStorage,
            ramGb: ramValue,
            usagePurposes: purposes,
            budgetMax: v.budget,
            listingUrl: v.trimmedUrl || null,
          },
        }),
      });

      let json: ApiResponse | null = null;
      try {
        json = (await res.json()) as ApiResponse;
      } catch {
        json = null;
      }

      if (res.ok && json?.success) {
        if (isUsableReport(json.report)) {
          setSubmitted({ model: v.trimmedModel, price: v.price });
          setReport(json.report);
          setLiveMessage("Ekspertiz raporu hazır.");
        } else {
          console.error("Eksik ya da hatalı rapor yapısı:", json.report);
          setCanRetry(true);
          setError("Rapor eksik ya da beklenmedik biçimde geldi. Tekrar dene. Sorun sürerse birkaç dakika sonra yeniden başlat.");
        }
      } else {
        setCanRetry(res.status !== 400 && res.status !== 422);
        setError(describeHttpError(res.status, json?.error));
      }
    } catch {
      if (timedOutRef.current) {
        setCanRetry(true);
        setError("Analiz 90 saniyede tamamlanamadı. Tekrar dene. Görsel sayısını azaltmak süreyi kısaltabilir.");
      } else if (!cancelledRef.current) {
        setCanRetry(true);
        setError("Sunucuya bağlanılamadı. İnternet bağlantını kontrol edip tekrar dene.");
      }
    } finally {
      window.clearTimeout(timer);
      abortRef.current = null;
      loadingRef.current = false;
      setLoading(false);
    }
  };

  /* ---------- Rapor ekranı ---------- */

  if (report) {
    const headerModel = submitted?.model ?? model.trim();
    const headerPrice = submitted?.price ?? Number(priceDigits);
    return (
      <Shell right={<span className="ao-chip is-gold">Ekspertiz raporu</span>}>
        <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 md:py-10">
          <div className="sr-only" role="status" aria-live="polite">
            {liveMessage}
          </div>
          <div className="ao-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
            <div className="min-w-0 space-y-1">
              <h1
                ref={reportHeadingRef}
                tabIndex={-1}
                className="ao-display truncate bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-xl font-bold text-transparent outline-none md:text-2xl"
              >
                {headerModel}
              </h1>
              <p className="text-sm text-white/55">İstenen fiyat: {formatDigits(String(Math.round(headerPrice)))} TL</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={backToForm}
                className="rounded-lg border border-[var(--line-strong)] bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]"
              >
                Formu düzenle
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-lg bg-[var(--coral)] px-4 py-2.5 text-sm font-bold text-[#03140d] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              >
                Yeni analiz başlat
              </button>
            </div>
          </div>
          <ReportBoundary key={report.generatedAt} onBack={backToForm}>
            <ReportView report={report} />
          </ReportBoundary>
        </div>
      </Shell>
    );
  }
  /* ---------- Form ekranı ---------- */

  const inputBase =
    "w-full rounded-lg border bg-[var(--field)] px-4 py-3 text-[15px] text-white placeholder:text-white/30 outline-none transition focus:border-[var(--cyan)] focus:ring-4 focus:ring-amber-400/10";
  const inputCls = (filled: boolean, invalid = false) =>
    `${inputBase} ${
      invalid
        ? "border-rose-400/70 focus:border-rose-300 focus:ring-rose-400/15"
        : filled
          ? "border-amber-300/60"
          : "border-white/10 hover:border-white/20"
    }`;
  const labelCls = "flex items-center justify-between gap-2 text-sm font-semibold text-white/90";
  const hintCls = "text-xs leading-relaxed text-white/45";
  const optionalCls = "text-xs font-normal text-white/40";
  const chipCls = (on: boolean) =>
    `rounded-full border px-3.5 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)] ${
      on
        ? "border-amber-300/70 bg-amber-300/15 text-amber-50"
        : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white"
    }`;
  const smallChipCls = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)] ${
      on
        ? "border-amber-300/70 bg-amber-300/15 text-amber-100"
        : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"
    }`;
  const ghostBtn =
    "rounded-lg border border-[var(--line-strong)] bg-white/5 px-3.5 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]";

  const aiBadge = (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
      <IconCheck className="h-3 w-3" />
      Görselden okundu
    </span>
  );

  const stepIdx = Math.min(ANALYSIS_STEPS.length - 1, Math.floor(elapsed / 7));
  const progressPct = Math.min(94, 8 + elapsed * 2.6);

  /* Boş durum: zorunlu alanlar eksikse buton soluk görünür, nedeni yazılır, tıklanınca alan işaretlenir. */
  const missingRequired: string[] = [];
  if (model.trim().length < 2) missingRequired.push("cihaz modeli");
  if (!priceDigits) missingRequired.push("ilan fiyatı");
  const softDisabled = missingRequired.length > 0;
  const errorCount = FIELD_ORDER.filter((k) => fieldErrors[k]).length;

  /* Analiz kalitesi göstergesi (ağırlıklar toplamı 100) */
  const quality = [
    { done: model.trim().length >= 2, weight: 20, tip: "Cihaz modelini seç" },
    { done: !!detectedStorage, weight: 10, tip: "Depolamayı seç" },
    { done: !!priceDigits, weight: 20, tip: "İlan fiyatını gir" },
    { done: !!imageDataUrl || extraPhotos.length > 0, weight: 10, tip: "İlan görseli ya da cihaz fotoğrafı ekle" },
    { done: batteryDigits !== "", weight: 10, tip: "Pil sağlığını gir" },
    { done: usageDigits !== "", weight: 5, tip: "Kullanım süresini gir" },
    { done: ramValue !== null, weight: 5, tip: "RAM miktarını seç" },
    { done: purposes.length > 0, weight: 10, tip: "Kullanım amacını seç" },
    {
      done: !!screenState || !!bodyState || repairs.length > 0 || funcs.length > 0 || locks.length > 0,
      weight: 5,
      tip: "Teknik kondisyonu işaretle",
    },
    { done: !!sellerNote.trim() || !!listingUrl.trim(), weight: 5, tip: "İlan açıklaması ya da link ekle" },
  ];
  const qualityScore = quality.reduce((sum, q) => sum + (q.done ? q.weight : 0), 0);
  const missingTips = quality
    .filter((q) => !q.done)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((q) => q.tip);
  const qualityLabel = qualityScore >= 80 ? "Çok iyi" : qualityScore >= 50 ? "İyi" : "Temel";
  const qualityColor = qualityScore >= 80 ? "bg-emerald-400" : qualityScore >= 50 ? "bg-[var(--cyan)]" : "bg-amber-600";

  const techCounts: Record<TechTab, [number, number]> = {
    yuzey: [(screenState ? 1 : 0) + (bodyState ? 1 : 0), 2],
    parca: [repairs.length, REPAIR_OPTIONS.length],
    fonk: [funcs.length, functionList.length],
    guvence: [locks.length, lockList.length],
  };

  const brandModels = activeBrand && activeBrand !== "Diğer" ? modelsOfBrand(activeBrand) : [];
  const baseNow = baseModelName(model).toLowerCase();

  const showExtractNotice = !!imageDataUrl && !scanning && extractState.status !== "idle";
  const extractIsGood = extractState.status === "filled";

  return (
    <Shell>
      <div className="mx-auto max-w-6xl space-y-9 px-4 pb-16 pt-8 md:pt-12">
        {/* Başlık */}
        <header className="space-y-6">
          <div className="space-y-4">
            <h1 className="ao-display bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-[2.1rem] font-extrabold leading-[1.1] text-transparent md:text-5xl">
              İkinci el telefonun gerçek değerini 30 saniyede öğren
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-white/60">
              İlanın ekran görüntüsünü yükle. Cihazı biz tanıyalım, fiyatı canlı ilanlarla karşılaştıralım, riskli işaretleri senin yerine bulalım.
            </p>
          </div>

          <ol className="grid max-w-2xl grid-cols-3 gap-3 text-sm" aria-label="Nasıl çalışır">
            {[
              ["1", "Yükle", "İlan görseli ya da link"],
              ["2", "Tanı", "Model ve fiyat otomatik dolar"],
              ["3", "Karar ver", "Fiyat, risk ve pazarlık raporu"],
            ].map(([n, t, d]) => (
              <li key={n} className="rounded-xl border border-[var(--line)] bg-white/[0.03] p-3">
                <span className="ao-display text-sm font-bold text-[var(--cyan)]">{n}</span>
                <p className="mt-1 font-semibold text-white">{t}</p>
                <p className="mt-0.5 text-xs leading-snug text-white/50">{d}</p>
              </li>
            ))}
          </ol>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Form */}
          <form onSubmit={handleSubmit} noValidate aria-busy={loading} className="ao-card space-y-7 p-5 md:p-8">
            <fieldset disabled={loading} className="ao-fieldset space-y-7">
              <legend className="sr-only">Ekspertiz formu</legend>

              {/* Hızlı doldurma: sekmeler */}
              <div className="flex gap-6 border-b border-[var(--line)]" role="tablist" aria-label="İlan bilgisi kaynağı" onKeyDown={onFormTabKeyDown}>
                {(
                  [
                    ["image", "Görsel yükle", IconImage],
                    ["link", "İlan linki", IconLink],
                  ] as const
                ).map(([key, label, Icon]) => {
                  const active = activeTab === key;
                  return (
                    <button
                      key={key}
                      id={`ftab-${key}`}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-controls={`fpanel-${key}`}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setActiveTab(key)}
                      className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)] ${
                        active ? "border-[var(--cyan)] text-white" : "border-transparent text-white/45 hover:text-white/80"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "image" && (
                <div className="space-y-3" role="tabpanel" id="fpanel-image" aria-labelledby="ftab-image">
                  {imageDataUrl ? (
                    <div className="relative overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--field)]">
                      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageDataUrl} alt="Yüklenen ilan görseli önizlemesi" className="h-full w-full object-cover" />
                          {scanning && <div className="ao-scanline" />}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="truncate text-sm font-semibold text-white">{imageName}</p>
                          {scanning ? (
                            <p className="text-sm font-medium text-amber-200" role="status" aria-live="polite">
                              {SCAN_STEPS[scanStep]}…
                            </p>
                          ) : extractIsGood ? (
                            <p className="text-sm leading-snug text-emerald-300" role="status">
                              {extractState.message ?? "Cihaz tanındı. Model, fiyat veya not otomatik dolduruldu. Aşağıdaki alanları kontrol et."}
                            </p>
                          ) : showExtractNotice ? (
                            <p className="text-sm leading-snug text-amber-300" role="status">
                              {extractState.message}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2 pt-0.5">
                            {scanning ? (
                              <button type="button" onClick={cancelExtract} disabled={imageBusy} className={ghostBtn}>
                                Elle gireceğim
                              </button>
                            ) : (
                              <>
                                {extractState.status !== "filled" && extractState.status !== "idle" && (
                                  <button type="button" onClick={retryExtract} className={ghostBtn}>
                                    Tekrar tanı
                                  </button>
                                )}
                                <button type="button" onClick={removeImage} className={ghostBtn}>
                                  Kaldır
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!loading) setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      onClick={() => {
                        if (!imageBusy && !loading) fileInputRef.current?.click();
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !imageBusy && !loading) {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="İlan ekran görüntüsü yükle"
                      aria-busy={imageBusy}
                      className={`ao-drop relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed bg-[var(--field)] px-6 py-8 text-center transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)] ${
                        dragOver ? "is-over border-emerald-400 bg-emerald-400/[0.07]" : "border-amber-400/40 hover:border-amber-300/70"
                      }`}
                    >
                      <span className="ao-corner tl" />
                      <span className="ao-corner tr" />
                      <span className="ao-corner bl" />
                      <span className="ao-corner br" />
                      {imageBusy && <div className="ao-scanline" />}

                      {imageBusy ? (
                        <div className="space-y-2 py-4" role="status" aria-live="polite">
                          <p className="ao-display text-lg font-bold text-amber-200">Görsel hazırlanıyor…</p>
                          <p className="text-sm text-white/50">Görsel küçültülüyor, birkaç saniye sürer.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <IconPhoneScan className="mx-auto h-12 w-12 text-[var(--cyan)] drop-shadow-[0_0_14px_rgba(245,158,11,.6)]" />
                          <p className="ao-display text-xl font-bold text-white">İlan ekran görüntüsünü buraya bırak</p>
                          <p className="text-sm text-white/50">
                            Tıkla, sürükle ya da{" "}
                            <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs font-semibold text-white/80">Ctrl+V</kbd> ile
                            yapıştır. Model ve fiyatı senin yerine biz dolduralım.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileInput} className="hidden" />
                  {imageError && (
                    <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-rose-300">
                      <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{imageError}</span>
                    </p>
                  )}
                </div>
              )}

              {activeTab === "link" && (
                <div className="space-y-3" role="tabpanel" id="fpanel-link" aria-labelledby="ftab-link">
                  <label htmlFor="listing-url" className={labelCls}>
                    <span>İlan bağlantısı</span>
                    <span className={optionalCls}>isteğe bağlı</span>
                  </label>
                  <div className="relative">
                    <IconLink className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                    <input
                      id="listing-url"
                      type="text"
                      inputMode="url"
                      value={listingUrl}
                      onChange={(e) => {
                        setListingUrl(e.target.value);
                        clearFieldError("url");
                      }}
                      placeholder="https://www.sahibinden.com/ilan/..."
                      autoComplete="off"
                      aria-invalid={!!fieldErrors.url}
                      aria-describedby={fieldErrors.url ? "listing-url-error" : "listing-url-hint"}
                      className={`${inputCls(false, !!fieldErrors.url)} pl-11`}
                    />
                  </div>
                  <FieldError id="listing-url-error" message={fieldErrors.url} />
                  <p id="listing-url-hint" className={hintCls}>
                    Linki analize not olarak ekliyoruz. Linkten otomatik okuma bir sonraki güncellemede geliyor. En doğru sonuç için şimdilik model, fiyat ve ilan açıklamasını aşağıya da yaz ya da görsel yükle.
                  </p>
                </div>
              )}

              {/* Cihaz */}
              <Section title="Cihaz" hint="Markayı seç, modeli listeden al ya da yaz. Depolama ve RAM modele göre şekillenir.">
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-white/90">Marka</p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Marka">
                      {BRANDS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          aria-pressed={activeBrand === b}
                          onClick={() => setBrandFilter(activeBrand === b ? null : b)}
                          className={chipCls(activeBrand === b)}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="model" className={labelCls}>
                      <span>Cihaz modeli *</span>
                      {filledFields.model && model.trim() && aiBadge}
                    </label>
                    <input
                      id="model"
                      type="text"
                      list="model-list"
                      value={model}
                      onChange={(e) => {
                        touchedRef.current.model = true;
                        setModel(e.target.value);
                        setBrandFilter(null);
                        setRamGb("");
                        clearFieldError("model");
                      }}
                      placeholder="Örn: iPhone 13 128GB"
                      autoComplete="off"
                      maxLength={120}
                      aria-required="true"
                      aria-invalid={!!fieldErrors.model}
                      aria-describedby={fieldErrors.model ? "model-error" : undefined}
                      className={inputCls(filledFields.model && !!model.trim(), !!fieldErrors.model)}
                    />
                    <datalist id="model-list">
                      {POPULAR_MODELS.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                    <FieldError id="model-error" message={fieldErrors.model} />

                    {brandModels.length > 0 && (
                      <div className="ao-hscroll -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-2 pt-1" role="group" aria-label="Popüler modeller">
                        {brandModels.map((m) => {
                          const on = baseNow === m.toLowerCase();
                          return (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={on}
                              onClick={() => pickModel(m)}
                              className={`shrink-0 whitespace-nowrap ${chipCls(on)}`}
                            >
                              {m.replace(/^Samsung |^Google |^Xiaomi /, "")}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className={labelCls}>
                        <span>Depolama</span>
                        {modelInfo && <span className={optionalCls}>bu model için seçenekler</span>}
                      </p>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Depolama">
                        {storageOptions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            aria-pressed={detectedStorage === s}
                            onClick={() => {
                              touchedRef.current.model = true;
                              setModel((prev) => applyStorage(prev, s));
                              clearFieldError("model");
                            }}
                            className={smallChipCls(detectedStorage === s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className={labelCls}>
                        <span>RAM</span>
                        {!modelInfo && <span className={optionalCls}>isteğe bağlı</span>}
                      </p>
                      {modelInfo ? (
                        <p className="rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white/75">
                          <span className="font-bold text-white">{modelInfo.ram} GB</span>, bu modelde RAM sabittir.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5" role="group" aria-label="RAM">
                          {RAM_OPTIONS.map((r) => (
                            <button
                              key={r}
                              type="button"
                              aria-pressed={ramGb === r}
                              onClick={() => setRamGb(ramGb === r ? "" : r)}
                              className={smallChipCls(ramGb === r)}
                            >
                              {r} GB
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Fiyat ve bütçe */}
              <Section title="Fiyat ve bütçe" hint="Bütçeni yazarsan o fiyata uygun daha iyi seçenekleri ona göre değerlendirebiliriz.">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="price" className={labelCls}>
                      <span>İlandaki fiyat *</span>
                      {filledFields.price && priceDigits && aiBadge}
                    </label>
                    <div className="relative">
                      <input
                        id="price"
                        type="text"
                        inputMode="numeric"
                        value={formatDigits(priceDigits)}
                        onChange={(e) => {
                          touchedRef.current.price = true;
                          setPriceDigits(e.target.value.replace(/\D/g, "").slice(0, 7));
                          clearFieldError("price");
                        }}
                        placeholder="Örn: 25.000"
                        autoComplete="off"
                        aria-required="true"
                        aria-invalid={!!fieldErrors.price}
                        aria-describedby={fieldErrors.price ? "price-error" : "price-hint"}
                        className={`${inputCls(filledFields.price && !!priceDigits, !!fieldErrors.price)} ao-display pr-14 text-xl font-bold tabular-nums text-amber-300`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md bg-amber-400 px-1.5 py-0.5 text-xs font-extrabold text-slate-900">TL</span>
                    </div>
                    <FieldError id="price-error" message={fieldErrors.price} />
                    <p id="price-hint" className={hintCls}>
                      Bulunabilen canlı ilanların medyanıyla kıyaslanır.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="budget" className={labelCls}>
                      <span>En fazla ne kadar harcarım?</span>
                      <span className={optionalCls}>isteğe bağlı</span>
                    </label>
                    <div className="relative">
                      <input
                        id="budget"
                        type="text"
                        inputMode="numeric"
                        value={formatDigits(budgetDigits)}
                        onChange={(e) => {
                          setBudgetDigits(e.target.value.replace(/\D/g, "").slice(0, 7));
                          clearFieldError("budget");
                        }}
                        placeholder="Örn: 30.000"
                        autoComplete="off"
                        aria-invalid={!!fieldErrors.budget}
                        aria-describedby={fieldErrors.budget ? "budget-error" : "budget-hint"}
                        className={`${inputCls(false, !!fieldErrors.budget)} ao-display pr-14 text-xl font-bold tabular-nums text-amber-300`}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md bg-amber-400 px-1.5 py-0.5 text-xs font-extrabold text-slate-900">TL</span>
                    </div>
                    <FieldError id="budget-error" message={fieldErrors.budget} />
                    <p id="budget-hint" className={hintCls}>
                      Alternatif ilanlar bu üst sınıra göre aranır.
                    </p>
                  </div>
                </div>
              </Section>

              {/* Cihaz durumu */}
              <Section title="Cihaz durumu" hint="Bildiklerini yaz, bilmediklerini boş bırak. Her bilgi raporu daha isabetli yapar.">
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="battery" className={labelCls}>
                        <span>Pil sağlığı</span>
                        <span className={optionalCls}>isteğe bağlı</span>
                      </label>
                      <div className="relative">
                        <input
                          id="battery"
                          type="text"
                          inputMode="numeric"
                          value={batteryDigits}
                          onChange={(e) => {
                            setBatteryDigits(e.target.value.replace(/\D/g, "").slice(0, 3));
                            clearFieldError("battery");
                          }}
                          placeholder="Örn: 87"
                          autoComplete="off"
                          aria-invalid={!!fieldErrors.battery}
                          aria-describedby={fieldErrors.battery ? "battery-error" : "battery-hint"}
                          className={`${inputCls(false, !!fieldErrors.battery)} pr-12`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/45">%</span>
                      </div>
                      <FieldError id="battery-error" message={fieldErrors.battery} />
                      <p id="battery-hint" className={hintCls}>
                        iPhone: Ayarlar → Pil → Pil Sağlığı. Bilmiyorsan boş bırak.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="usage" className={labelCls}>
                        <span>Kullanım süresi</span>
                        <span className={optionalCls}>isteğe bağlı</span>
                      </label>
                      <div className="relative">
                        <input
                          id="usage"
                          type="text"
                          inputMode="numeric"
                          value={usageDigits}
                          onChange={(e) => {
                            setUsageDigits(e.target.value.replace(/\D/g, "").slice(0, 3));
                            clearFieldError("usage");
                          }}
                          placeholder="Örn: 18"
                          autoComplete="off"
                          aria-invalid={!!fieldErrors.usage}
                          aria-describedby={fieldErrors.usage ? "usage-error" : "usage-hint"}
                          className={`${inputCls(false, !!fieldErrors.usage)} pr-14`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/45">ay</span>
                      </div>
                      <FieldError id="usage-error" message={fieldErrors.usage} />
                      <p id="usage-hint" className={hintCls}>
                        Cihaz kaç aydır kullanılıyor, biliyorsan yaz.
                      </p>
                    </div>
                  </div>

                  <fieldset className="ao-fieldset space-y-3">
                    <legend className="mb-3 text-sm font-semibold text-white/90">Satıcının belirttiği özellikler</legend>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => toggleTag(tag)}
                            className={`inline-flex items-center gap-1.5 ${chipCls(isSelected)}`}
                          >
                            {isSelected && <IconCheck className="h-3.5 w-3.5 text-amber-200" />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
              </Section>

              {/* Teknik kondisyon (sekmeli) */}
              <Section title="Teknik kondisyon" hint="Cihazı elinde görüyorsan işaretle. Bilmediklerini boş bırak, rapor yalnızca işaretlediklerini kullanır.">
                <div className="rounded-xl border border-[var(--line)] bg-white/[0.02]">
                  <div
                    role="tablist"
                    aria-label="Teknik kondisyon"
                    onKeyDown={onTechTabKeyDown}
                    className="ao-hscroll flex overflow-x-auto border-b border-[var(--line)] px-2"
                  >
                    {TECH_TABS.map((t) => {
                      const active = techTab === t.id;
                      const [n, of] = techCounts[t.id];
                      const red = t.id === "parca" && n > 0;
                      return (
                        <button
                          key={t.id}
                          id={`ttab-${t.id}`}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          aria-controls="tpanel"
                          tabIndex={active ? 0 : -1}
                          onClick={() => setTechTab(t.id)}
                          className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)] ${
                            active ? "border-[var(--cyan)] text-white" : "border-transparent text-white/45 hover:text-white/80"
                          }`}
                        >
                          {t.label}
                          {(n > 0 || t.id !== "parca") && (
                            <span
                              className={`rounded-full px-1.5 text-[11px] tabular-nums ${
                                red ? "bg-rose-400/20 text-rose-200" : n > 0 ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/45"
                              }`}
                            >
                              {n}/{of}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div id="tpanel" role="tabpanel" aria-labelledby={`ttab-${techTab}`} className="min-h-[132px] p-4">
                    {techTab === "yuzey" && (
                      <div className="grid gap-5 sm:grid-cols-2">
                        <ChipGroup
                          label="Ekran durumu"
                          options={SCREEN_OPTIONS}
                          selected={screenState ? [screenState] : []}
                          onToggle={(o) => setScreenState((p) => (p === o ? "" : o))}
                        />
                        <ChipGroup
                          label="Kasa durumu"
                          options={BODY_OPTIONS}
                          selected={bodyState ? [bodyState] : []}
                          onToggle={(o) => setBodyState((p) => (p === o ? "" : o))}
                        />
                      </div>
                    )}
                    {techTab === "parca" && (
                      <div className="space-y-2">
                        <ChipGroup
                          label="Değişen ya da onarılan parçalar"
                          options={REPAIR_OPTIONS}
                          selected={repairs}
                          onToggle={toggleIn(setRepairs)}
                          tone="red"
                        />
                        <p className={hintCls}>İşaretlemediğin parçalar orijinal kabul edilmez, yalnızca bilinmiyor sayılır.</p>
                      </div>
                    )}
                    {techTab === "fonk" && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => setFuncs(funcs.length === functionList.length ? [] : [...functionList])}
                          className="text-sm font-semibold text-emerald-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]"
                        >
                          {funcs.length === functionList.length ? "Seçimi temizle" : "Hepsi sorunsuz"}
                        </button>
                        <ChipGroup
                          label="Sorunsuz çalışan fonksiyonlar"
                          options={functionList}
                          selected={funcs}
                          onToggle={toggleIn(setFuncs)}
                        />
                      </div>
                    )}
                    {techTab === "guvence" && (
                      <ChipGroup
                        label="Kilit ve kayıt güvencesi"
                        options={lockList}
                        selected={locks}
                        onToggle={toggleIn(setLocks)}
                      />
                    )}
                  </div>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-white/40">
                  <IconWrench className="h-3.5 w-3.5" />
                  Marka değişirse Face ID, iCloud ve hesap kilidi gibi etiketler markaya göre güncellenir.
                </p>
              </Section>

              {/* Kullanım amacı */}
              <Section
                title="Telefonu ne için kullanacaksın?"
                hint={`En fazla ${MAX_PURPOSES} seçenek seç. Rapor, kararı senin ihtiyacına göre değerlendirir.`}
              >
                <div className="flex flex-wrap gap-2" role="group" aria-label="Kullanım amacı">
                  {PURPOSES.map((p) => {
                    const on = purposes.includes(p);
                    const blocked = !on && purposes.length >= MAX_PURPOSES;
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        disabled={blocked}
                        onClick={() => togglePurpose(p)}
                        className={`inline-flex items-center gap-1.5 ${chipCls(on)} disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        {on && <IconCheck className="h-3.5 w-3.5 text-amber-200" />}
                        {p}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* Fotoğraflar */}
              <Section
                title="Cihaz fotoğrafları"
                hint="Ekran, arka kasa ve kenarların fotoğrafını ekleyebilirsin (en fazla 3). Raporun görsel bulguları bölümü bu fotoğraflardan beslenir."
              >
                <div className="flex flex-wrap gap-3">
                  {extraPhotos.map((src, i) => (
                    <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Cihaz fotoğrafı ${i + 1}`} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`Fotoğraf ${i + 1} kaldır`}
                        onClick={() => setExtraPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-sm font-bold text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {extraPhotos.length < MAX_EXTRA_PHOTOS && (
                    <button
                      type="button"
                      disabled={extraBusy}
                      onClick={() => extraInputRef.current?.click()}
                      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 bg-[var(--field)] text-xs font-semibold text-white/55 transition hover:border-amber-300/50 hover:text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]"
                    >
                      <IconPlus className="h-5 w-5" />
                      {extraBusy ? "Ekleniyor" : "Fotoğraf ekle"}
                    </button>
                  )}
                </div>
                <input ref={extraInputRef} type="file" accept="image/*" multiple onChange={onExtraInput} className="hidden" />
                {extraError && (
                  <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-rose-300">
                    <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{extraError}</span>
                  </p>
                )}
              </Section>

              {/* İlan açıklaması */}
              <Section title="İlan açıklaması">
                <div className="space-y-2">
                  <label htmlFor="note" className={labelCls}>
                    <span className="flex items-center gap-2">
                      Satıcının yazdığı metin
                      {filledFields.note && sellerNote && aiBadge}
                    </span>
                    <span className={optionalCls}>{sellerNote.length}/2000</span>
                  </label>
                  <textarea
                    id="note"
                    rows={3}
                    value={sellerNote}
                    onChange={(e) => {
                      touchedRef.current.note = true;
                      setSellerNote(e.target.value);
                    }}
                    maxLength={2000}
                    placeholder="Satıcının yazdığı açıklamayı yapıştır. Kapora ve ön ödeme gibi dolandırıcılık işaretlerini otomatik tarıyoruz."
                    className={`${inputCls(filledFields.note && !!sellerNote)} resize-none leading-relaxed`}
                  />
                </div>
              </Section>

              {/* Analiz kalitesi: geniş ekranda sağdaki göstergede, dar ekranda burada */}
              <div className="space-y-2.5 rounded-xl border border-[var(--line)] bg-white/[0.03] p-4 lg:hidden">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-white">Analiz kalitesi</p>
                  <p className="text-sm font-bold tabular-nums text-white">
                    %{qualityScore} <span className="font-medium text-white/50">{qualityLabel}</span>
                  </p>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Analiz kalitesi"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={qualityScore}
                >
                  <div className={`h-full rounded-full transition-all duration-500 ${qualityColor}`} style={{ width: `${qualityScore}%` }} />
                </div>
                {missingTips.length > 0 && (
                  <p className="text-xs leading-relaxed text-white/50">Daha isabetli rapor için: {missingTips.join(", ").toLowerCase()}.</p>
                )}
              </div>
            </fieldset>

            {/* Alan hataları özeti */}
            {errorCount > 0 && !loading && (
              <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm leading-relaxed text-rose-200">
                <p className="font-semibold">
                  {errorCount === 1 ? "1 alanı düzeltmen gerekiyor." : `${errorCount} alanı düzeltmen gerekiyor.`}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {FIELD_ORDER.filter((k) => fieldErrors[k]).map((k) => (
                    <li key={k}>
                      <button
                        type="button"
                        onClick={() => focusField(k)}
                        className="text-left underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                      >
                        {fieldErrors[k]}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Sunucu ve ağ hatası */}
            {error && !loading && (
              <div
                ref={errorRef}
                role="alert"
                className="space-y-3 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-sm leading-relaxed text-rose-200"
              >
                <p className="flex items-start gap-2 font-medium">
                  <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {canRetry && (
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      className="rounded-lg bg-rose-200 px-3.5 py-2 text-sm font-bold text-rose-950 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                    >
                      Tekrar dene
                    </button>
                  )}
                  <button type="button" onClick={() => setError(null)} className={ghostBtn}>
                    Kapat
                  </button>
                </div>
              </div>
            )}

            {/* Gönder / ilerleme */}
            {loading ? (
              <div ref={loadingPanelRef} className="space-y-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.05] p-5" role="status" aria-live="polite">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="ao-display text-lg font-bold text-white">Ekspertiz yapılıyor</p>
                  <p className="text-sm tabular-nums text-white/50">{elapsed} sn</p>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Analiz ilerlemesi"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progressPct)}
                >
                  <div className="ao-progress h-full rounded-full bg-[var(--cyan)] transition-[width] duration-700" style={{ width: `${progressPct}%` }} />
                </div>
                <ul className="space-y-1.5 text-sm">
                  {ANALYSIS_STEPS.map((s, i) => (
                    <li
                      key={s}
                      className={`flex items-center gap-2 ${
                        i < stepIdx ? "text-white/45" : i === stepIdx ? "font-semibold text-amber-100" : "text-white/25"
                      }`}
                    >
                      {i < stepIdx ? (
                        <IconCheck className="h-3.5 w-3.5 text-amber-300" />
                      ) : (
                        <span className={`h-1.5 w-1.5 rounded-full ${i === stepIdx ? "bg-amber-300" : "bg-white/20"}`} />
                      )}
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-white/45">
                  Bu işlem 90 saniyeye kadar sürebilir. Sayfayı kapatma, kapatırsan analiz yarıda kalır.
                </p>
                <button
                  type="button"
                  onClick={cancelAnalysis}
                  className="text-sm font-medium text-white/60 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cyan)]"
                >
                  İptal et
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="submit"
                  aria-disabled={softDisabled || scanning || extraBusy}
                  className={`ao-cta w-full rounded-xl bg-[var(--coral)] px-6 py-[18px] text-base font-extrabold tracking-wide text-[#03140d] shadow-[0_0_34px_-6px_rgba(16,185,129,.75)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    softDisabled || scanning || extraBusy ? "opacity-55" : "hover:brightness-110 hover:shadow-[0_0_48px_-2px_rgba(16,185,129,.9)] active:scale-[0.99]"
                  }`}
                >
                  {scanning ? "Görsel okunuyor…" : error && canRetry ? "Ekspertizi yeniden başlat" : "Ekspertizi başlat"}
                </button>
                {softDisabled && (
                  <p className="text-center text-xs leading-relaxed text-white/50" id="submit-hint">
                    Başlamak için eksik: {missingRequired.join(" ve ")}.
                  </p>
                )}
              </div>
            )}
          </form>

          {/* Sağ panel: donanım haritası ve hazırlık skoru (yalnızca geniş ekranda) */}
          <CockpitAside
            scanning={scanning}
            battery={batteryDigits === "" ? null : Number(batteryDigits)}
            tags={mapTags}
            photos={extraPhotos.length + (imageDataUrl ? 1 : 0)}
            score={qualityScore}
            label={qualityLabel}
            tips={missingTips}
          />
        </div>

        <footer className="space-y-2 text-center text-xs leading-relaxed text-white/40">
          <p>
            Almadan Önce yapay zeka ve açık web verilerine dayanan bir karar destek aracıdır. Kesin hüküm vermez, satın almadan önce cihazı elden kontrol et.
          </p>
          <p className="text-white/30">Powered by Almadan Önce Risk Assessment Engine v3.2 • Tüm verileriniz KVKK kapsamında şifrelenir.</p>
        </footer>
      </div>
    </Shell>
  );
}