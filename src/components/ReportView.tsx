"use client";

// src/components/ReportView.tsx
// Ekspertiz rapor ekranı. Veri yoksa veri uydurmaz; her bölüm EkspertizReport alanlarından beslenir.

import { useRef, useState, type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode } from "react";
import type { Decision, Verdict } from "@/lib/valuation";
import type { MarketResult, Verdict as MarketVerdict } from "@/lib/marketEngine";
import type {
  AlternativeListing,
  DeliveryType,
  DeviationBand,
  EkspertizReport,
  EstimateBasis,
  MetricRisk,
  ParseMode,
  PartAvailability,
  PartEase,
  SearchStatus,
  TechStatus,
} from "@/types/ekspertiz";

interface ReportViewProps {
  report: EkspertizReport;
}

type TabId = "summary" | "technical" | "risk" | "checklist" | "deal" | "basis";
type Tone = "emerald" | "blue" | "amber" | "rose" | "zinc" | "indigo" | "violet";

/** Ekranda gösterilen her bilginin kaynağı: gerçek ilan, kullanıcı beyanı, yapay zeka tahmini ya da veri yok. */
type DataKind = "live" | "user" | "estimate" | "none";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "summary", label: "Genel Özet" },
  { id: "technical", label: "Teknik Rapor" },
  { id: "risk", label: "Risk Analizi" },
  { id: "checklist", label: "Elden Kontrol" },
  { id: "deal", label: "Pazarlık ve Alternatif" },
  { id: "basis", label: "Veri Dayanağı" },
];

const TONE_CLASS: Record<Tone, string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  blue: "border-sky-500/30 bg-sky-500/15 text-sky-300",
  amber: "border-amber-500/30 bg-amber-500/15 text-amber-300",
  rose: "border-rose-500/30 bg-rose-500/15 text-rose-300",
  zinc: "border-zinc-500/30 bg-zinc-500/15 text-zinc-300",
  indigo: "border-indigo-500/30 bg-indigo-500/15 text-indigo-300",
  violet: "border-violet-500/30 bg-violet-500/15 text-violet-300",
};

const KIND_INFO: Record<DataKind, { label: string; tone: Tone; hint: string }> = {
  live: { label: "Gerçek ilan verisi", tone: "emerald", hint: "Canlı ilanlardan hesaplandı." },
  user: { label: "Kullanıcı beyanı", tone: "blue", hint: "Sizin girdiğiniz, doğrulanmamış bilgi." },
  estimate: { label: "Yapay zeka tahmini", tone: "amber", hint: "Model bilgisinden üretildi, ölçüm değildir." },
  none: { label: "Veri yok", tone: "zinc", hint: "Bu bilgi elde edilemedi, uydurulmadı." },
};

const STATUS_BANNER: Record<SearchStatus, { tone: Tone; title: string }> = {
  ok: { tone: "amber", title: "Yeterli canlı ilan bulunamadı" },
  no_listings: { tone: "amber", title: "Arama ilan bulamadı" },
  quota: { tone: "rose", title: "Yapay zeka kotası doldu, canlı arama yapılamadı" },
  timeout: { tone: "rose", title: "Canlı arama zaman aşımına uğradı" },
  error: { tone: "rose", title: "Canlı arama başarısız oldu" },
};

const SEARCH_STATUS_INFO: Record<SearchStatus, { label: string; tone: Tone }> = {
  ok: { label: "Arama başarılı", tone: "emerald" },
  no_listings: { label: "İlan bulunamadı", tone: "amber" },
  quota: { label: "Kota doldu", tone: "rose" },
  timeout: { label: "Zaman aşımı", tone: "rose" },
  error: { label: "Arama hatası", tone: "rose" },
};

const PARSE_INFO: Record<ParseMode, string> = {
  code: "İlan satırları kural tabanlı olarak ayrıştırıldı.",
  ai: "İlanlar yapay zeka ile çıkarıldı; yalnızca fiyatı arama metninde doğrulananlar tutuldu.",
  none: "Ayrıştırılan ilan yok.",
};

const MARKET_STATUS_INFO: Record<MarketResult["status"], { label: string; tone: Tone }> = {
  ok: { label: "Yeterli veri", tone: "emerald" },
  low_data: { label: "Az veri", tone: "amber" },
  prior_only: { label: "Yalnızca fiyat tablosu", tone: "amber" },
  no_data: { label: "Veri yok", tone: "zinc" },
};

const MARKET_VERDICT_INFO: Record<MarketVerdict, { label: string; tone: Tone }> = {
  supheli_ucuz: { label: "Şüpheli derecede ucuz", tone: "rose" },
  firsat: { label: "Fırsat", tone: "emerald" },
  makul: { label: "Makul", tone: "blue" },
  biraz_pahali: { label: "Biraz pahalı", tone: "amber" },
  pahali: { label: "Pahalı", tone: "rose" },
};

const MARKET_CONFIDENCE_INFO: Record<MarketResult["confidence"]["label"], { label: string; tone: Tone }> = {
  yuksek: { label: "Yüksek", tone: "emerald" },
  orta: { label: "Orta", tone: "blue" },
  dusuk: { label: "Düşük", tone: "amber" },
};

const REJECT_LABEL: Record<string, string> = {
  fiyat_okunamadi: "Fiyatı okunamayan ilan",
  aksesuar: "Aksesuar ilanı",
  model_uyusmuyor: "Model uyuşmayan ilan",
  varyant_uyusmuyor: "Varyant uyuşmayan ilan (Pro, Max vb.)",
  arizali_parca: "Arızalı veya parça ilan",
  depolama_cok_farkli: "Depolaması çok farklı ilan",
  mukerrer: "Tekrarlanan ilan",
  aykiri_deger: "Aykırı fiyatlı ilan",
};

const VERDICT_INFO: Record<Verdict, { label: string; tone: Tone }> = {
  great_deal: { label: "Avantajlı fiyat", tone: "emerald" },
  fair: { label: "Adil fiyat", tone: "blue" },
  expensive: { label: "Pahalı", tone: "amber" },
  unknown: { label: "Fiyat değerlendirilemedi", tone: "zinc" },
};

const DECISION_INFO: Record<Decision, { badge: string; tone: Tone; text: string }> = {
  buy: {
    badge: "ALINABİLİR",
    tone: "emerald",
    text: "Fiyat ve ilan işaretleri olumlu. Yine de elden kontrol listesini uygulayın.",
  },
  negotiate: {
    badge: "PAZARLIKLA ALINIR",
    tone: "amber",
    text: "Pazarlık yapmadan ya da koşulları doğrulamadan almayın.",
  },
  avoid: {
    badge: "UZAK DURUN",
    tone: "rose",
    text: "Bu fiyattan ya da bu koşullarla almak önerilmez.",
  },
  unknown: {
    badge: "KARAR VERİLEMEDİ",
    tone: "zinc",
    text: "Canlı piyasa verisi yetersiz. Benzer ilanları elle karşılaştırın.",
  },
};

const BAND_INFO: Record<DeviationBand, { label: string; tone: Tone }> = {
  much_below: { label: "Piyasanın çok altında", tone: "amber" },
  below: { label: "Piyasanın altında", tone: "emerald" },
  near: { label: "Piyasa seviyesinde", tone: "blue" },
  above: { label: "Piyasanın üzerinde", tone: "amber" },
  much_above: { label: "Piyasanın çok üzerinde", tone: "rose" },
};

const STATUS_TONE: Record<TechStatus, Tone> = {
  "doğrulandı": "emerald",
  tahmini: "amber",
  bulunamadı: "zinc",
};

const RISK_TONE: Record<MetricRisk, Tone> = {
  "Düşük": "emerald",
  Orta: "amber",
  "Yüksek": "rose",
  Bilinmiyor: "zinc",
};

const ESTIMATE_BASIS_TONE: Record<EstimateBasis, Tone> = {
  "kullanıcı beyanı": "blue",
  "model bilgisinden tahmin": "amber",
  "doğrulanamadı": "zinc",
};

const EASE_INFO: Record<PartEase, { label: string; tone: Tone }> = {
  kolay: { label: "Kolay", tone: "emerald" },
  orta: { label: "Orta", tone: "amber" },
  zor: { label: "Zor", tone: "rose" },
  bilinmiyor: { label: "Bilinmiyor", tone: "zinc" },
};

const AVAILABILITY_INFO: Record<PartAvailability, { label: string; tone: Tone }> = {
  "yaygın": { label: "Yaygın", tone: "emerald" },
  orta: { label: "Orta", tone: "amber" },
  "sınırlı": { label: "Sınırlı", tone: "rose" },
  bilinmiyor: { label: "Bilinmiyor", tone: "zinc" },
};

const DELIVERY_LABEL: Record<DeliveryType, string> = {
  kargo: "Yalnızca kargo",
  elden: "Elden teslim",
  ikisi: "Kargo veya elden",
};

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(n)) + " TL";
}

function fmtSigned(pct: number | null): string {
  if (pct === null) return "-";
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  return `${sign}%${Math.abs(pct).toFixed(1).replace(".", ",")}`;
}

function safeHref(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("tr-TR");
}

function fmtAge(days: number | null): string {
  if (days === null) return "Tarih yok";
  if (days < 1) return "Bugün";
  return `${Math.round(days)} gün önce`;
}

// ---------------------------------------------------------------------------
// Küçük bileşenler
// ---------------------------------------------------------------------------

function Glass({ children, className = "", ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...rest}
      className={`rounded-2xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/20 backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONE_CLASS[tone]}`}
    >
      {children}
    </span>
  );
}

function KindBadge({ kind }: { kind: DataKind }) {
  return <Pill tone={KIND_INFO[kind].tone}>{KIND_INFO[kind].label}</Pill>;
}

function DataLegend() {
  const kinds: DataKind[] = ["live", "user", "estimate", "none"];
  return (
    <details className="group rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-zinc-300">
      <summary className="cursor-pointer list-none rounded font-semibold text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 [&::-webkit-details-marker]:hidden">
        Veri türleri ne anlama geliyor?
        <span aria-hidden="true" className="ml-1 inline-block transition group-open:rotate-180">
          ▾
        </span>
      </summary>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {kinds.map((k) => (
          <li key={k} className="flex items-start gap-2">
            <span className="shrink-0">
              <KindBadge kind={k} />
            </span>
            <span className="text-[11px] leading-relaxed text-zinc-400">{KIND_INFO[k].hint}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Banner({ tone, title, children }: { tone: Tone; title: string; children: ReactNode }) {
  return (
    <div role="status" className={`rounded-xl border p-4 text-xs leading-relaxed ${TONE_CLASS[tone]}`}>
      <p className="font-bold">{title}</p>
      <div className="mt-1 text-zinc-200">{children}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-300">{children}</h3>;
}

function Tile({
  label,
  children,
  hint,
  kind,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  kind?: DataKind;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</span>
        {kind ? <KindBadge kind={kind} /> : null}
      </div>
      <div className="mt-1.5 text-lg font-extrabold text-white">{children}</div>
      {hint ? <div className="mt-1 text-[11px] text-zinc-400">{hint}</div> : null}
    </div>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-center text-xs text-zinc-400">
      {children}
    </p>
  );
}

function BulletList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-200"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <EmptyNote>{empty}</EmptyNote>;
  return (
    <ol className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${i}-${item.slice(0, 24)}`}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-200"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[11px] font-bold text-indigo-300">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function DeviationGauge({ pct }: { pct: number }) {
  const clamped = Math.max(-40, Math.min(40, pct));
  const left = ((clamped + 40) / 80) * 100;
  return (
    <div aria-hidden="true">
      <div className="relative mt-3 h-2 rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-rose-500/40">
        <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-white/40" style={{ left: "50%" }} />
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-500 shadow"
          style={{ left: `${left}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-400">
        <span>-%40 ve altı</span>
        <span>Medyan</span>
        <span>+%40 ve üstü</span>
      </div>
    </div>
  );
}

function AlternativeCard({ alt, best = false }: { alt: AlternativeListing; best?: boolean }) {
  const href = safeHref(alt.url);
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        best ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10 bg-black/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {best ? <Pill tone="emerald">EN AVANTAJLI EŞDEĞER</Pill> : null}
          <Pill tone="indigo">{alt.source}</Pill>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold text-emerald-300">{fmtMoney(alt.price)}</div>
          <div className="text-[11px] font-semibold text-emerald-400">
            -{fmtMoney(alt.savingsTL)} (%{alt.savingsPct.toFixed(1).replace(".", ",")})
          </div>
        </div>
      </div>

      <h4 className="text-sm font-bold text-white">{alt.title}</h4>

      <dl className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <dt className="text-zinc-400">Satıcı güveni</dt>
          <dd className="mt-0.5 font-semibold text-zinc-200">
            {alt.sellerTrust !== null ? `${alt.sellerTrust}/100` : "İlanda belirtilmemiş"}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <dt className="text-zinc-400">Teslimat</dt>
          <dd className="mt-0.5 font-semibold text-zinc-200">
            {alt.delivery !== null ? DELIVERY_LABEL[alt.delivery] : "İlanda belirtilmemiş"}
          </dd>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-2">
          <dt className="text-zinc-400">Bağlantı doğrulaması</dt>
          <dd className={`mt-0.5 font-semibold ${alt.urlGrounded ? "text-emerald-300" : "text-amber-300"}`}>
            {alt.urlGrounded ? "Arama sonuçlarında doğrulandı" : "Doğrulanamadı, ilanı kontrol edin"}
          </dd>
        </div>
      </dl>

      <p className="text-xs leading-relaxed text-zinc-300">{alt.reason}</p>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-[11px] font-semibold text-indigo-300 transition hover:bg-indigo-500/20"
        >
          <span>İlanı yeni sekmede aç</span>
          <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </div>
  );
}

/**
 * Piyasa motoru çıktısı (report.market). Ana değerlemeyle aynı ilanlar üzerinde ayrı bir yöntemle hesaplanır,
 * bağımsız bir ikinci kaynak değildir. Motorun pazarlık planı bilerek gösterilmez (ana planla çelişmesin diye).
 */
function MarketEngineSection({ market, mainMedian }: { market: MarketResult | null | undefined; mainMedian: number | null }) {
  const range = market ? market.range : null;
  const showLiveBadge = !!market && !!range && (market.status === "ok" || market.status === "low_data");

  const rejectedRows = market
    ? Object.entries(market.rejected)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
    : [];

  const diffPct =
    market && range && mainMedian !== null && mainMedian > 0
      ? Math.round(((range.median - mainMedian) / mainMedian) * 1000) / 10
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-zinc-300">Piyasa motoru (ek analiz)</span>
        <div className="flex flex-wrap gap-1.5">
          {showLiveBadge ? <KindBadge kind="live" /> : null}
          {market ? (
            <Pill tone={MARKET_STATUS_INFO[market.status].tone}>{MARKET_STATUS_INFO[market.status].label}</Pill>
          ) : (
            <KindBadge kind="none" />
          )}
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-400">
        Aynı ilanlar üzerinde ayrı bir istatistik yöntemiyle (ağırlıklı medyan, bootstrap güven aralığı) hesaplanan ek
        analizdir. Bağımsız bir ikinci kaynak değildir ve ana değerlemeyi değiştirmez.
      </p>

      {!market ? (
        <EmptyNote>Piyasa motoru bu raporda sonuç üretemedi. Ana değerleme bundan etkilenmez.</EmptyNote>
      ) : !range ? (
        <EmptyNote>Piyasa motoru için yeterli uygun ilan yok, aralık hesaplanamadı.</EmptyNote>
      ) : (
        <div className="space-y-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {(
              [
                ["P10", range.p10],
                ["P25 (alt çeyrek)", range.p25],
                ["Medyan", range.median],
                ["P75 (üst çeyrek)", range.p75],
                ["P90", range.p90],
              ] as Array<[string, number]>
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                <div className="text-zinc-400">{label}</div>
                <div className="mt-0.5 font-bold text-white">{fmtMoney(value)}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">Fiyatlar depolama ve kondisyona göre düzeltilmiş, ilan kalitesi ve tazeliğine göre ağırlıklandırılmıştır.</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Tile
              label="Medyan için %80 güven aralığı"
              hint={market.medianCI80 ? "Bootstrap yöntemiyle hesaplandı." : "Yeterli ilan olmadığı için hesaplanamadı."}
            >
              {market.medianCI80 ? (
                <span className="text-base text-emerald-300">
                  {fmtMoney(market.medianCI80[0])} - {fmtMoney(market.medianCI80[1])}
                </span>
              ) : (
                <span className="text-base text-zinc-400">Hesaplanamadı</span>
              )}
            </Tile>
            <Tile
              label="Motor güveni"
              hint={`${MARKET_CONFIDENCE_INFO[market.confidence.label].label} güven. Ana rapordaki veri güveninden ayrı hesaplanır.`}
            >
              <span className="text-violet-300">%{market.confidence.score}</span>
            </Tile>
          </div>

          {diffPct !== null && mainMedian !== null ? (
            <p className="text-xs text-zinc-300">
              Ana değerlemenin medyanı {fmtMoney(mainMedian)}. Motorun medyanının ona göre farkı:{" "}
              <span className="font-bold text-white">{fmtSigned(diffPct)}</span>
            </p>
          ) : null}

          {market.verdict ? (
            <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-zinc-300">Motorun yorumu</span>
                <Pill tone={MARKET_VERDICT_INFO[market.verdict.verdict].tone}>
                  {MARKET_VERDICT_INFO[market.verdict.verdict].label}
                </Pill>
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">{market.verdict.message}</p>
              <p className="text-[11px] text-zinc-400">
                Bu ilan, benzer ilanların %{market.verdict.percentile}. yüzdeliğinde. Medyana göre{" "}
                {fmtSigned(market.verdict.deltaVsMedianPct)}.
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
              <div className="text-zinc-400">Gelen ilan</div>
              <div className="mt-0.5 font-bold text-white">{market.sample.received}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
              <div className="text-zinc-400">Kullanılan ilan</div>
              <div className="mt-0.5 font-bold text-white">{market.sample.used}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/30 p-2.5">
              <div className="text-zinc-400">Etkin örneklem</div>
              <div className="mt-0.5 font-bold text-white">{String(market.sample.effective).replace(".", ",")}</div>
            </div>
          </div>
          <p className="text-[11px] text-zinc-400">
            Etkin örneklem, ağırlıklar dengesizse kullanılan ilan sayısından küçük çıkar.
            {market.sample.sources.length > 0 ? ` Kaynaklar: ${market.sample.sources.join(", ")}.` : ""}
            {market.sample.priorShare > 0
              ? ` Fiyat tablosunun hesaptaki payı: %${Math.round(market.sample.priorShare * 100)}.`
              : ""}
          </p>

          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-300">Motorun elediği ilanlar</span>
            {rejectedRows.length > 0 ? (
              <ul className="overflow-hidden rounded-xl border border-white/10">
                {rejectedRows.map(([key, count], i) => (
                  <li
                    key={key}
                    className={`flex items-center justify-between px-4 py-2 text-xs text-zinc-300 ${
                      i % 2 === 0 ? "bg-black/30" : "bg-black/10"
                    }`}
                  >
                    <span>{REJECT_LABEL[key] ?? key}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>Motor hiçbir ilanı elemedi.</EmptyNote>
            )}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-300">Hesapta en etkili ilanlar</span>
            {market.topComparables.length > 0 ? (
              <ul className="space-y-1.5">
                {market.topComparables.map((c) => {
                  const href = safeHref(c.url);
                  return (
                    <li
                      key={c.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-100">{c.title}</div>
                        <div className="text-[11px] text-zinc-400">
                          {c.source} - Kalite {c.quality.grade} - {fmtAge(c.ageDays)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-bold text-emerald-300">{fmtMoney(c.price)}</div>
                        <div className="text-[11px] text-zinc-400">Düzeltilmiş: {fmtMoney(c.adjustedPrice)}</div>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-300 hover:underline"
                          >
                            Aç
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyNote>Listelenecek ilan yok.</EmptyNote>
            )}
          </div>
        </div>
      )}

      {market && market.warnings.length > 0 ? (
        <ul className="space-y-1.5">
          {market.warnings.map((w, i) => (
            <li
              key={`${i}-${w.slice(0, 24)}`}
              className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-2.5 text-xs leading-relaxed text-zinc-200"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ana bileşen
// ---------------------------------------------------------------------------

/** Yeni rapor geldiğinde sekme ve onay kutusu durumu sıfırlansın diye içerik, generatedAt ile anahtarlanır. */
export default function ReportView({ report }: ReportViewProps) {
  return <ReportViewContent key={report.generatedAt} report={report} />;
}

function ReportViewContent({ report }: ReportViewProps) {
  const [tab, setTab] = useState<TabId>("summary");
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const tabListRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const toggleCheck = (index: number) => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  /** Sekmeyi değiştirir, seçili sekmeyi çubukta ortalar, içerik ekranın üstünde kaldıysa çubuğa kaydırır. */
  const selectTab = (id: TabId, moveFocus = false) => {
    setTab(id);
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const box = tabListRef.current;
    const el = tabRefs.current[id];
    if (moveFocus) el?.focus({ preventScroll: true });
    if (box && el) {
      const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
      box.scrollTo({ left: Math.max(0, left), behavior });
    }
    if (box) {
      const top = box.getBoundingClientRect().top;
      if (top < 0) window.scrollTo({ top: window.scrollY + top - 8, behavior });
    }
  };

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    selectTab(TABS[next].id, true);
  };

  const b = report.basis;
  const decisionInfo = DECISION_INFO[report.decision];
  const verdictInfo = VERDICT_INFO[report.verdict];
  const dev = report.priceDeviation;
  const bandInfo = dev.band ? BAND_INFO[dev.band] : null;
  const warnSet = new Set(report.warnings);
  const doneCount = report.checklist.filter((_, i) => checked[i]).length;

  const marketKind: DataKind = report.marketPrice ? (report.marketPriceIsEstimate ? "estimate" : "live") : "none";
  const deviationKind: DataKind = dev.vsMedianPct !== null ? "live" : "none";
  const confidenceKind: DataKind = report.estimated ? "none" : "live";
  const mainMedian = report.marketPrice && !report.marketPriceIsEstimate ? report.marketPrice.median : null;

  const searchFailed = b.searchStatus === "quota" || b.searchStatus === "timeout" || b.searchStatus === "error";
  const statusBanner = report.estimated ? STATUS_BANNER[b.searchStatus] : null;
  const statusText = statusBanner
    ? `${(searchFailed ? b.searchNote || b.notes : b.notes) || "Ayrıntı bildirilmedi."} Bu raporda fiyat kararı verilmedi. ${
        b.searchStatus === "quota"
          ? "Teknik bölümler de üretilemedi."
          : "Aşağıdaki teknik bölümler yapay zeka değerlendirmesidir."
      }`
    : "";

  // Yapay zeka teknik metni üretilmediyse bu alanların hepsi boş kalır (kodla hesaplanan pil ve parça metrikleri hariç).
  const aiMissing =
    report.technicalItems.length === 0 &&
    !report.repairability &&
    !report.hardwareMetrics.some((m) => m.basis === "model bilgisinden tahmin");
  const aiMissingReason =
    b.searchStatus === "quota"
      ? "Yapay zeka kullanım kotası dolduğu için teknik yorumlar üretilemedi."
      : "Yapay zeka teknik yorumu üretilemedi veya okunamadı. Aşağıdaki sayısal bilgiler koddan hesaplanmış, girdiğiniz beyanlara dayanır.";

  const systemRisks = report.riskAnalysis.filter((r) => warnSet.has(r));
  const aiRisks = report.riskAnalysis.filter((r) => !warnSet.has(r));

  const offerLabel =
    marketKind === "live"
      ? "Önerilen ilk teklif"
      : marketKind === "estimate"
        ? "İlk teklif (tahmine dayalı)"
        : "Varsayılan ilk teklif";
  const offerHint =
    marketKind === "live"
      ? "Gerçek ilan medyanına göre hesaplandı."
      : marketKind === "estimate"
        ? "Doğrulanmamış yapay zeka tahmininden türetildi."
        : "Piyasa referansı değil, ilan fiyatından türetildi.";
  const walkAwayHint =
    marketKind === "live"
      ? "Bu tutarı aşarsanız pazarlıktan çekilin."
      : marketKind === "estimate"
        ? "Tahmine dayalı. Bu tutarı aşarsanız pazarlıktan çekilin."
        : "Doğrulanmış piyasa verisine dayanmıyor. Bu tutarı aşarsanız pazarlıktan çekilin.";
  const dealKind: DataKind | undefined = marketKind === "none" ? undefined : marketKind;

  const idBattery = report.identity.batteryHealthPct;
  const idUsage = report.identity.usageMonths;
  const shownWarnings = report.warnings.slice(0, 3);
  const hiddenWarnings = report.warnings.length - shownWarnings.length;

  const others = report.bestAlternative
    ? report.betterAlternatives.filter((a) => a.url !== report.bestAlternative?.url)
    : report.betterAlternatives;

  const funnel: Array<[string, number]> = [
    ["Gelen ham ilan", b.receivedCount],
    ["Geçersiz fiyat veya veri", b.invalidRemoved],
    ["Aksesuar, arızalı veya sıfır ürün", b.excludedRemoved],
    ["Tekrarlanan ilan", b.duplicatesRemoved],
    ["Eski ilan", b.staleRemoved],
    ["Model veya depolama uyuşmayan", b.mismatchRemoved],
    ["IQR aykırı değer", b.outliersRemoved],
    ["Hesaplamaya katılan ilan", b.usedCount],
  ];

  return (
    <div className="space-y-5">
      {/* Üst kart */}
      <Glass className="space-y-5 p-5 md:p-6">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-indigo-400">{report.category}</div>
            <h2 className="mt-1 text-xl font-extrabold text-white">{report.productName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Pill tone={verdictInfo.tone}>{verdictInfo.label}</Pill>
              {report.estimated ? <Pill tone="amber">CANLI VERİ YOK</Pill> : <Pill tone="emerald">CANLI İLANLARLA HESAPLANDI</Pill>}
            </div>
          </div>
          <div className="md:max-w-xs md:text-right">
            <div
              className={`inline-block rounded-full border px-4 py-1.5 text-xs font-bold ${TONE_CLASS[decisionInfo.tone]}`}
            >
              {decisionInfo.badge}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-400">{decisionInfo.text}</p>
          </div>
        </div>

        {statusBanner ? (
          <Banner tone={statusBanner.tone} title={statusBanner.title}>
            {statusText}
          </Banner>
        ) : null}
        {report.marketPriceIsEstimate ? (
          <Banner tone="amber" title="Gösterilen piyasa aralığı yapay zeka tahminidir">
            Canlı ilanlarla doğrulanmadı. Kesin bir piyasa referansı olarak kullanmayın.
          </Banner>
        ) : null}
        {report.suspiciouslyLow ? (
          <Banner tone="rose" title="Fiyat şüpheli derecede düşük">
            İlan fiyatı piyasa alt sınırının çok altında. Cihazı elden test etmeden ödeme yapmayın.
          </Banner>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="İstenen fiyat" kind="user">
            <span className="text-indigo-300">{fmtMoney(report.listingPrice)}</span>
          </Tile>
          <Tile
            label={report.marketPriceIsEstimate ? "Piyasa aralığı (tahmin)" : "Piyasa aralığı"}
            kind={marketKind}
            hint={
              report.marketPrice
                ? `Medyan: ${fmtMoney(report.marketPrice.median)}${report.marketPriceIsEstimate ? " (tahmini)" : ""}`
                : "Yeterli canlı ilan bulunamadı"
            }
          >
            {report.marketPrice ? (
              <span className="text-base text-emerald-300">
                {fmtMoney(report.marketPrice.min)} - {fmtMoney(report.marketPrice.max)}
              </span>
            ) : (
              <span className="text-base text-zinc-400">Hesaplanamadı</span>
            )}
          </Tile>
          <Tile
            label="Medyana sapma"
            kind={deviationKind}
            hint={bandInfo ? bandInfo.label : "Gerçek ilan verisi gerekir"}
          >
            <span className="text-violet-300">{fmtSigned(dev.vsMedianPct)}</span>
          </Tile>
          <Tile
            label="Veri güveni"
            kind={confidenceKind}
            hint={`${b.usedCount} ilan kullanıldı, ${b.groundedSourceCount} kaynak doğrulandı`}
          >
            {report.estimated ? (
              <span className="text-base text-zinc-400">Doğrulanmış güven yok</span>
            ) : (
              <span className="text-violet-300">%{report.confidence}</span>
            )}
          </Tile>
        </div>

        <DataLegend />

        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Alıcı için sonuç</div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-200">{report.recommendation}</p>
        </div>
      </Glass>

      {/* Sekmeler */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="Rapor bölümleri"
        onKeyDown={onTabKeyDown}
        className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={selected ? `panel-${t.id}` : undefined}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(t.id)}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-4 py-2.5 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400 ${
                selected
                  ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
                  : "border-white/10 bg-white/[0.04] text-zinc-400 backdrop-blur-xl hover:text-white"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <Glass
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
        className="min-h-[220px] space-y-5 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400/60 md:p-6"
      >
        {/* GENEL ÖZET */}
        {tab === "summary" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Ürün durumu ve piyasa özeti</SectionTitle>
              <KindBadge kind={aiMissing ? "none" : "estimate"} />
            </div>
            <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
              {report.summary}
            </p>

            <div className="flex flex-wrap gap-1.5">
              {report.identity.brand ? <Pill tone="indigo">{report.identity.brand}</Pill> : null}
              {report.identity.series ? <Pill tone="indigo">{report.identity.series}</Pill> : null}
              {report.identity.releaseYear ? <Pill tone="zinc">{report.identity.releaseYear}</Pill> : null}
              {report.identity.storage ? <Pill tone="zinc">{report.identity.storage}</Pill> : null}
              <Pill tone="blue">Kondisyon: {report.identity.conditionLabel}</Pill>
              {report.identity.hasBox ? <Pill tone="emerald">Kutulu ve faturalı</Pill> : null}
              {report.identity.hasWarranty ? <Pill tone="emerald">Garantili</Pill> : null}
            </div>

            <div className="space-y-3">
              <SectionTitle>Sizin beyan ettiğiniz bilgiler</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Tile
                  label="Pil sağlığı"
                  kind={idBattery !== null ? "user" : "none"}
                  hint={idBattery !== null ? "Doğrulanmamıştır, elden kontrol edin." : "Girilmedi, elden kontrol edin."}
                >
                  {idBattery !== null ? (
                    <span className="text-sky-300">%{idBattery}</span>
                  ) : (
                    <span className="text-base text-zinc-400">Girilmedi</span>
                  )}
                </Tile>
                <Tile
                  label="Kullanım süresi"
                  kind={idUsage !== null ? "user" : "none"}
                  hint={idUsage !== null ? "Doğrulanmamıştır, satıcıdan teyit isteyin." : "Girilmedi."}
                >
                  {idUsage !== null ? (
                    <span className="text-sky-300">{idUsage} ay</span>
                  ) : (
                    <span className="text-base text-zinc-400">Girilmedi</span>
                  )}
                </Tile>
              </div>
            </div>

            {shownWarnings.length > 0 ? (
              <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle>Sistem uyarıları</SectionTitle>
                  <button
                    type="button"
                    onClick={() => selectTab("risk")}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-300"
                  >
                    Risk Analizi sekmesinde gör
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {shownWarnings.map((w, i) => (
                    <li key={`${i}-${w.slice(0, 24)}`} className="text-xs leading-relaxed text-zinc-200">
                      {w}
                    </li>
                  ))}
                </ul>
                {hiddenWarnings > 0 ? (
                  <p className="text-[11px] text-zinc-400">ve {hiddenWarnings} uyarı daha, Risk Analizi sekmesinde.</p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
              <SectionTitle>Fiyat sapma matrisi</SectionTitle>
              {dev.vsMedianPct === null ? (
                <EmptyNote>
                  Sapma hesaplanamadı. Matris yalnızca gerçek ilanlardan çıkan piyasa aralığıyla hesaplanır.
                </EmptyNote>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Medyana göre", dev.vsMedianPct],
                        ["Alt sınıra göre", dev.vsMinPct],
                        ["Üst sınıra göre", dev.vsMaxPct],
                      ] as Array<[string, number | null]>
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-black/30 p-3">
                        <div className="text-zinc-400">{label}</div>
                        <div className="mt-0.5 text-base font-extrabold text-white">{fmtSigned(value)}</div>
                      </div>
                    ))}
                  </div>
                  {bandInfo ? <Pill tone={bandInfo.tone}>{bandInfo.label}</Pill> : null}
                  <DeviationGauge pct={dev.vsMedianPct} />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-400">Öne çıkan avantajlar</span>
                <BulletList items={report.strengths} empty="Bu ilan için doğrulanabilir bir avantaj belirtilmedi." />
              </div>
              <div className="space-y-2">
                <span className="text-xs font-bold text-rose-400">Eksik veriler</span>
                <BulletList items={report.missingData} empty="Eksik veri bildirilmedi." />
              </div>
            </div>
          </div>
        )}

        {/* TEKNİK RAPOR */}
        {tab === "technical" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Donanım ve teknik değerlendirme</SectionTitle>
              {aiMissing ? null : <KindBadge kind="estimate" />}
            </div>

            {aiMissing ? (
              <Banner tone={b.searchStatus === "quota" ? "rose" : "amber"} title="Teknik yorum üretilemedi">
                {aiMissingReason}
              </Banner>
            ) : (
              <>
                <Banner tone="blue" title="Bu bölüm ölçüm değildir">
                  Teknik maddeler modelin genel bilinen özelliklerinden yapay zeka ile üretilmiştir. Cihazınız için
                  doğrulanması gerekenleri elden kontrol listesinde bulabilirsiniz.
                </Banner>

                {report.technicalItems.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {report.technicalItems.map((it, i) => (
                      <div
                        key={`${it.area}-${i}`}
                        className="space-y-1.5 rounded-xl border border-white/10 bg-black/30 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white">{it.area}</span>
                          <Pill tone={STATUS_TONE[it.status]}>{it.status}</Pill>
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-300">{it.finding}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyNote>Teknik madde üretilemedi.</EmptyNote>
                )}

                <p className="whitespace-pre-line rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-200">
                  {report.technicalComments}
                </p>
              </>
            )}

            {report.hardwareMetrics.length > 0 || report.repairability ? (
              <div className="space-y-5">
                {report.hardwareMetrics.length > 0 ? (
                  <div className="space-y-3">
                    <SectionTitle>Donanım metrikleri</SectionTitle>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {report.hardwareMetrics.map((m) => (
                        <div key={m.id} className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{m.label}</span>
                            <div className="flex gap-1.5">
                              <Pill tone={RISK_TONE[m.risk]}>Risk: {m.risk}</Pill>
                              <Pill tone={ESTIMATE_BASIS_TONE[m.basis]}>{m.basis}</Pill>
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-indigo-200">{m.value}</div>
                          <p className="text-[11px] leading-relaxed text-zinc-400">{m.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {report.repairability ? (
                  <div className="space-y-3">
                    <SectionTitle>Tamir edilebilirlik</SectionTitle>
                    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-2xl font-extrabold text-white">
                          {report.repairability.score !== null ? `${report.repairability.score}/10` : "Belirsiz"}
                        </span>
                        <Pill tone={ESTIMATE_BASIS_TONE[report.repairability.scoreBasis]}>
                          {report.repairability.scoreBasis}
                        </Pill>
                        <Pill tone={AVAILABILITY_INFO[report.repairability.partAvailability].tone}>
                          Yedek parça: {AVAILABILITY_INFO[report.repairability.partAvailability].label}
                        </Pill>
                      </div>
                      {report.repairability.score !== null ? (
                        <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400"
                            style={{ width: `${Math.max(0, Math.min(10, report.repairability.score)) * 10}%` }}
                          />
                        </div>
                      ) : null}
                      <p className="text-xs leading-relaxed text-zinc-300">{report.repairability.summary}</p>
                      {report.repairability.partAvailabilityNote ? (
                        <p className="text-[11px] leading-relaxed text-zinc-400">
                          {report.repairability.partAvailabilityNote}
                        </p>
                      ) : null}
                      {report.repairability.modularity.length > 0 ? (
                        <ul className="space-y-1.5">
                          {report.repairability.modularity.map((mod, i) => (
                            <li
                              key={`${mod.part}-${i}`}
                              className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs"
                            >
                              <div>
                                <div className="font-semibold text-zinc-100">{mod.part}</div>
                                <div className="text-[11px] text-zinc-400">{mod.note}</div>
                              </div>
                              <Pill tone={EASE_INFO[mod.ease].tone}>{EASE_INFO[mod.ease].label}</Pill>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <EmptyNote>Bu raporda ayrıntılı donanım metriği ve tamir edilebilirlik detayı üretilmedi.</EmptyNote>
            )}

            {report.imageFindings.length > 0 ? (
              <div className="space-y-2">
                <SectionTitle>Görsel bulguları</SectionTitle>
                <BulletList items={report.imageFindings} empty="" />
              </div>
            ) : null}
          </div>
        )}

        {/* RİSK ANALİZİ */}
        {tab === "risk" && (
          <div className="space-y-6">
            <SectionTitle>Potansiyel riskler ve dikkat edilmesi gerekenler</SectionTitle>
            {report.riskAnalysis.length === 0 ? (
              <EmptyNote>Risk maddesi üretilemedi.</EmptyNote>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-rose-300">Sistem uyarıları</span>
                    <Pill tone="rose">{systemRisks.length}</Pill>
                  </div>
                  {systemRisks.length > 0 ? (
                    <ul className="space-y-2">
                      {systemRisks.map((risk, i) => (
                        <li
                          key={`${i}-${risk.slice(0, 24)}`}
                          className="rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs leading-relaxed text-zinc-200"
                        >
                          {risk}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyNote>
                      Sistem tarafından işaretlenen bir uyarı yok. Bu, risk olmadığı anlamına gelmez, elden kontrol
                      listesini uygulayın.
                    </EmptyNote>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-zinc-300">Yapay zeka değerlendirmesi</span>
                    <KindBadge kind={aiRisks.length > 0 ? "estimate" : "none"} />
                  </div>
                  {aiRisks.length > 0 ? (
                    <ul className="space-y-2">
                      {aiRisks.map((risk, i) => (
                        <li
                          key={`${i}-${risk.slice(0, 24)}`}
                          className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs leading-relaxed text-zinc-200"
                        >
                          {risk}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyNote>{aiMissing ? aiMissingReason : "Yapay zeka risk maddesi üretilemedi."}</EmptyNote>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ELDEN KONTROL */}
        {tab === "checklist" && (
          <div className="space-y-4">
            <SectionTitle>Elden teslim alırken kontrol edilecekler</SectionTitle>
            <p className="text-xs text-zinc-400">Cihazı elden teslim alırken maddeleri tek tek kontrol edip işaretleyin.</p>
            {report.checklist.length > 0 ? (
              <>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-zinc-400">
                    <span>İlerleme</span>
                    <span>
                      {doneCount} / {report.checklist.length}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${(doneCount / report.checklist.length) * 100}%` }}
                    />
                  </div>
                </div>
                <ul className="space-y-2">
                  {report.checklist.map((item, i) => {
                    const isChecked = !!checked[i];
                    return (
                      <li key={`${i}-${item.slice(0, 24)}`}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isChecked}
                          onClick={() => toggleCheck(i)}
                          className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-xs transition ${
                            isChecked
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                              : "border-white/10 bg-black/30 text-zinc-200 hover:border-white/20"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                              isChecked ? "border-emerald-400 bg-emerald-600 text-white" : "border-zinc-600"
                            }`}
                          >
                            {isChecked ? "✓" : ""}
                          </span>
                          <span className={isChecked ? "line-through opacity-80" : ""}>{item}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <EmptyNote>Kontrol maddesi üretilemedi.</EmptyNote>
            )}
          </div>
        )}

        {/* PAZARLIK VE ALTERNATİF */}
        {tab === "deal" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <SectionTitle>Pazarlık stratejisi</SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Tile label={offerLabel} kind={dealKind} hint={offerHint}>
                  <span className="text-emerald-300">{fmtMoney(report.bargainingPlan.targetOffer)}</span>
                </Tile>
                <Tile label="Vazgeçme fiyatı" kind={dealKind} hint={walkAwayHint}>
                  <span className="text-amber-300">{fmtMoney(report.bargainingPlan.walkAwayPrice)}</span>
                </Tile>
              </div>
              <NumberedList items={report.bargainingPlan.tactics} empty="Taktik üretilemedi." />
            </div>

            <div className="space-y-3 border-t border-white/10 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionTitle>
                  {report.alternativesStatus === "found"
                    ? `Daha avantajlı ${report.betterAlternatives.length} eşdeğer ilan`
                    : "Avantajlı eşdeğer ilan"}
                </SectionTitle>
                <span className="text-[11px] text-zinc-400">Yalnızca gerçek ve bağlantılı ilanlar</span>
              </div>

              {report.alternativesStatus === "insufficient_data" ? (
                <EmptyNote>
                  {searchFailed
                    ? "Canlı arama çalışmadığı için alternatif ilan aranamadı. Uydurma ilan gösterilmez."
                    : "Canlı piyasa verisi olmadığı için alternatif ilan aranamadı. Uydurma ilan gösterilmez."}
                </EmptyNote>
              ) : null}
              {report.alternativesStatus === "none_found" ? (
                <EmptyNote>
                  Bu fiyatın altında, modeli ve depolaması eşleşen, bağlantısı doğrulanabilen ilan bulunamadı.
                </EmptyNote>
              ) : null}

              {report.bestAlternative ? <AlternativeCard alt={report.bestAlternative} best /> : null}
              {others.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {others.map((alt) => (
                    <AlternativeCard key={alt.url} alt={alt} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* VERİ DAYANAĞI */}
        {tab === "basis" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Şeffaf veri dayanağı</SectionTitle>
              <div className="flex gap-1.5">
                <Pill tone={b.mode === "live" ? "emerald" : "amber"}>
                  {b.mode === "live" ? "Canlı ilan verisi" : "Tahmin modu"}
                </Pill>
                {b.fromCache ? <Pill tone="zinc">Önbellekten</Pill> : null}
              </div>
            </div>

            <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-zinc-200">
              {b.notes || "Analiz notu üretilmedi."}
            </p>

            <div className="space-y-2 rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-zinc-300">Canlı arama durumu</span>
                <Pill tone={SEARCH_STATUS_INFO[b.searchStatus].tone}>{SEARCH_STATUS_INFO[b.searchStatus].label}</Pill>
              </div>
              <p className="text-xs leading-relaxed text-zinc-300">{PARSE_INFO[b.parsedBy]}</p>
              {b.rejectedUnverified > 0 ? (
                <p className="text-xs leading-relaxed text-amber-300">
                  Fiyatı arama metninde doğrulanamadığı için atılan ilan sayısı: {b.rejectedUnverified}.
                </p>
              ) : null}
              {b.fromCache ? (
                <p className="text-xs leading-relaxed text-zinc-400">
                  Bu arama sonuçları yakın zamanda aynı model için yapılan aramadan önbellekten alındı.
                </p>
              ) : null}
              {b.searchNote && b.searchNote !== b.notes ? (
                <p className="text-xs leading-relaxed text-zinc-300">{b.searchNote}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">İlan süzme hunisi</span>
              <ul className="overflow-hidden rounded-xl border border-white/10">
                {funnel.map(([label, count], i) => (
                  <li
                    key={label}
                    className={`flex items-center justify-between px-4 py-2 text-xs ${
                      i % 2 === 0 ? "bg-black/30" : "bg-black/10"
                    } ${i === funnel.length - 1 ? "font-bold text-indigo-200" : "text-zinc-300"}`}
                  >
                    <span>{label}</span>
                    <span className="tabular-nums">{count}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-zinc-400">Eşleşen ilan sayısı süzgeç sonrası: {b.matchedCount}</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">IQR (çeyrekler açıklığı) süzgeci</span>
              {b.iqr ? (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {(
                      [
                        ["Q1 (alt çeyrek)", fmtMoney(b.iqr.q1)],
                        ["Q3 (üst çeyrek)", fmtMoney(b.iqr.q3)],
                        ["IQR", fmtMoney(b.iqr.iqr)],
                        ["Alt sınır", fmtMoney(b.iqr.lowerFence)],
                        ["Üst sınır", fmtMoney(b.iqr.upperFence)],
                        ["Çarpan", `x${String(b.iqr.multiplier).replace(".", ",")}`],
                      ] as Array<[string, string]>
                    ).map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-black/30 p-2.5">
                        <div className="text-zinc-400">{label}</div>
                        <div className="mt-0.5 font-bold text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-zinc-300">
                    Süzgeç öncesi {b.iqr.beforeCount} ilan, sonrası {b.iqr.afterCount} ilan.{" "}
                    {b.iqr.applied
                      ? b.iqr.removed.length === 0
                        ? "Sınırların dışında ilan çıkmadı."
                        : "Sınırların dışındaki ilanlar elendi."
                      : "Eleme sonrası yeterli ilan kalmayacağı için aykırı değer elemesi uygulanmadı."}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Süzgeç, kondisyona göre düzeltilmiş fiyatlar üzerinde çalışır.
                  </p>
                  {b.iqr.removed.length > 0 ? (
                    <ul className="space-y-1.5">
                      {b.iqr.removed.map((r, i) => (
                        <li
                          key={`${r.title}-${i}`}
                          className="flex items-start justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-zinc-100">{r.title}</div>
                            <div className="text-[11px] text-zinc-400">
                              {r.source} - {r.side === "low" ? "Alt sınırın altında" : "Üst sınırın üstünde"}
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-zinc-300">
                            <div>{fmtMoney(r.price)}</div>
                            <div className="text-zinc-400">Düzeltilmiş: {fmtMoney(r.adjustedPrice)}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <EmptyNote>IQR süzgeci için en az 5 eşleşen ilan gerekir; bu raporda uygulanmadı.</EmptyNote>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">Taranan pazar havuzu (süzgeçten önce)</span>
              {b.platforms.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {b.platforms.map((p) => (
                    <li
                      key={p.name}
                      className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-zinc-200"
                    >
                      {p.name}: <span className="font-bold text-indigo-300">{p.receivedCount} ilan</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyNote>Hiçbir platformdan ilan alınamadı. Yalnızca gerçekten ilan gelen platformlar gösterilir.</EmptyNote>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">Kaynaklar</span>
              {b.sources.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {b.sources.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-indigo-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <EmptyNote>Kaynak bulunamadı.</EmptyNote>
              )}
              {b.sourceLinks.length > 0 ? (
                <ul className="space-y-1">
                  {b.sourceLinks.map((l, i) => {
                    const href = safeHref(l.uri);
                    return (
                      <li key={`${l.uri}-${i}`} className="truncate text-[11px] text-zinc-400">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-300 underline-offset-2 hover:underline"
                          >
                            {l.title}
                          </a>
                        ) : (
                          l.title
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-zinc-300">
                {b.mode === "live" ? "Hesaplamaya giren ilanlar" : "Eşleşen ama yetersiz kalan ilanlar"}
              </span>
              {b.usedComps.length > 0 ? (
                <ul className="space-y-1.5">
                  {b.usedComps.map((c, i) => {
                    const href = safeHref(c.url);
                    return (
                      <li
                        key={`${c.title}-${i}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-zinc-100">{c.title}</div>
                          <div className="text-[11px] text-zinc-400">{c.source}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold text-emerald-300">{fmtMoney(c.price)}</div>
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-indigo-300 hover:underline"
                            >
                              Aç
                            </a>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyNote>Listelenecek ilan yok.</EmptyNote>
              )}
            </div>

            <div className="border-t border-white/10 pt-6">
              <MarketEngineSection market={report.market} mainMedian={mainMedian} />
            </div>
          </div>
        )}
      </Glass>

      <p className="px-1 text-center text-[11px] text-zinc-400">
        {report.disclaimer}
        {fmtDate(report.generatedAt) ? ` Rapor zamanı: ${fmtDate(report.generatedAt)}.` : ""}
      </p>
    </div>
  );
}