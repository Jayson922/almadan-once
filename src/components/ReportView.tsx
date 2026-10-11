"use client";

import { useState } from "react";

type Level = "low" | "medium" | "high";

export type Report = {
  productName: string;
  verdict: "great_deal" | "fair" | "expensive" | "unknown";
  decision: "buy" | "negotiate" | "avoid";
  buyScore: number;
  marketMin: number | null;
  marketMax: number | null;
  fairPrice: number | null;
  offerPrice: number | null;
  walkAwayPrice: number | null;
  confidence: number;
  summary: string;
  condition: string | null;
  specs: { label: string; value: string }[];
  knownIssues: { title: string; level: Level; detail: string }[];
  risks: { category: string; level: Level; text: string }[];
  scamSignals: string[];
  checklist: { step: string; how: string }[];
  alternatives: { name: string; approxPrice: number | null; why: string }[];
  questions: string[];
  negotiation: string;
};

const fmt = (n: number | null) => (n == null ? "-" : n.toLocaleString("tr-TR") + " TL");

const LV = {
  low: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700", t: "Düşük" },
  medium: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700", t: "Orta" },
  high: { dot: "bg-red-500", chip: "bg-red-50 text-red-700", t: "Yüksek" },
} as const;

const DEC = {
  buy: { t: "Satın alınabilir", c: "bg-emerald-500", ring: "#10b981" },
  negotiate: { t: "Pazarlıkla al", c: "bg-amber-500", ring: "#f59e0b" },
  avoid: { t: "Uzak dur", c: "bg-red-500", ring: "#ef4444" },
} as const;

const TABS = [
  ["ozet", "Özet"],
  ["teknik", "Teknik Rapor"],
  ["risk", "Risk Raporu"],
  ["kontrol", "Kontrol Listesi"],
  ["pazarlik", "Pazarlık"],
] as const;

function Gauge({ price, min, max }: { price: number; min: number | null; max: number | null }) {
  if (!min || !max) return null;
  const lo = Math.min(price, min) * 0.9;
  const hi = Math.max(price, max) * 1.1;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  return (
    <div className="pt-6">
      <div className="relative h-3 rounded-full bg-slate-200">
        <div className="absolute h-3 rounded-full bg-emerald-300" style={{ left: pos(min) + "%", width: pos(max) - pos(min) + "%" }} />
        <div className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded bg-indigo-700" style={{ left: pos(price) + "%" }} />
        <span className="absolute -top-7 -translate-x-1/2 text-xs font-semibold text-indigo-700" style={{ left: pos(price) + "%" }}>İlan</span>
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>Piyasa alt: {fmt(min)}</span>
        <span>Piyasa üst: {fmt(max)}</span>
      </div>
    </div>
  );
}

const H = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{children}</p>
);

export default function ReportView({ result: r, listingPrice }: { result: Report; listingPrice: number }) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("ozet");
  const [done, setDone] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const d = DEC[r.decision];
  const C = 2 * Math.PI * 34;
  const toggle = (i: number) => setDone((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  const pct = r.checklist.length ? Math.round((done.length / r.checklist.length) * 100) : 0;

  async function copy() {
    const text = [
      `${r.productName} - ${d.t} (skor ${r.buyScore}/100)`,
      `İlan: ${fmt(listingPrice)} | Adil: ${fmt(r.fairPrice)} | Teklif: ${fmt(r.offerPrice)} | Vazgeç: ${fmt(r.walkAwayPrice)}`,
      r.summary,
      "",
      "RİSKLER:",
      ...r.risks.map((x) => `- [${LV[x.level].t}] ${x.text}`),
      "",
      "KONTROL LİSTESİ:",
      ...r.checklist.map((x, i) => `${i + 1}. ${x.step} - ${x.how}`),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mt-8 space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-indigo-100/50">
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={d.ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * r.buyScore) / 100} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-slate-800">{r.buyScore}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Ekspertiz &amp; satın alma raporu</p>
          <h3 className="truncate text-xl font-bold text-slate-900">{r.productName}</h3>
          <span className={"mt-1 inline-block rounded-full px-3 py-1 text-xs font-bold text-white " + d.c}>{d.t}</span>
        </div>
        <button type="button" onClick={copy} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {copied ? "✓ Kopyalandı" : "Raporu kopyala"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[
          ["İlan fiyatı", listingPrice],
          ["Adil fiyat", r.fairPrice],
          ["Önerilen teklif", r.offerPrice],
          ["Vazgeç sınırı", r.walkAwayPrice],
        ].map(([t, v]) => (
          <div key={t as string} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">{t}</p>
            <p className="text-sm font-bold text-slate-900">{fmt(v as number | null)}</p>
          </div>
        ))}
      </div>

      <Gauge price={listingPrice} min={r.marketMin} max={r.marketMax} />

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 text-xs font-semibold">
        {TABS.map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={"whitespace-nowrap rounded-lg px-3 py-2 transition " + (tab === k ? "bg-white text-indigo-700 shadow" : "text-slate-500 hover:text-slate-700")}>
            {t}
          </button>
        ))}
      </div>

      {tab === "ozet" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-700">{r.summary}</p>
          {r.condition && (
            <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
              <span className="font-semibold">Görselden kondisyon: </span>{r.condition}
            </p>
          )}
          {r.alternatives.length > 0 && (
            <div>
              <H>Aynı bütçeye alternatifler</H>
              <ul className="mt-2 space-y-2">
                {r.alternatives.map((a, i) => (
                  <li key={i} className="rounded-xl border border-slate-100 p-3 text-sm">
                    <span className="font-semibold text-slate-800">{a.name}</span>
                    <span className="ml-2 text-xs text-slate-500">~{fmt(a.approxPrice)}</span>
                    <p className="mt-1 text-slate-600">{a.why}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "teknik" && (
        <div className="space-y-4">
          {r.specs.length === 0 && <p className="text-sm text-slate-500">Bu model için teknik bilgi üretilemedi.</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            {r.specs.map((s, i) => (
              <div key={i} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">{s.label}</p>
                <p className="text-sm font-semibold text-slate-800">{s.value}</p>
              </div>
            ))}
          </div>
          {r.knownIssues.length > 0 && (
            <div>
              <H>Modelde bilinen sorunlar</H>
              <ul className="mt-2 space-y-2">
                {r.knownIssues.map((k, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + LV[k.level].dot} />
                    <span><span className="font-semibold">{k.title}: </span>{k.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-400">Teknik bilgiler yapay zekanın model bilgisinden gelir, resmi veri sayfasıyla doğrulayın.</p>
        </div>
      )}

      {tab === "risk" && (
        <div className="space-y-4">
          {r.risks.length === 0 && <p className="text-sm text-slate-500">Belirgin bir risk bulunamadı.</p>}
          <ul className="space-y-2">
            {r.risks.map((x, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className={"mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold " + LV[x.level].chip}>{LV[x.level].t}</span>
                <span><span className="font-semibold">{x.category}: </span>{x.text}</span>
              </li>
            ))}
          </ul>
          {r.scamSignals.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3">
              <p className="text-xs font-bold uppercase text-red-700">Dolandırıcılık işaretleri</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-800">
                {r.scamSignals.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === "kontrol" && (
        <div className="space-y-3">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Elde kontrol ilerlemesi</span>
            <span>{done.length}/{r.checklist.length}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: pct + "%" }} />
          </div>
          <ul className="space-y-2">
            {r.checklist.map((c, i) => (
              <li key={i}>
                <button type="button" onClick={() => toggle(i)} className={"flex w-full gap-3 rounded-xl border p-3 text-left text-sm transition " + (done.includes(i) ? "border-emerald-200 bg-emerald-50" : "border-slate-100 hover:border-indigo-200")}>
                  <span className={"mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs " + (done.includes(i) ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300")}>{done.includes(i) ? "✓" : ""}</span>
                  <span><span className="font-semibold text-slate-800">{c.step}</span><br /><span className="text-slate-600">{c.how}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "pazarlik" && (
        <div className="space-y-4">
          {r.negotiation && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{r.negotiation}</p>}
          {r.questions.length > 0 && (
            <div>
              <H>Satıcıya sorulacaklar</H>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {r.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex justify-between text-xs text-slate-500"><span>Analiz güveni</span><span>%{r.confidence}</span></div>
        <div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-indigo-500" style={{ width: r.confidence + "%" }} /></div>
      </div>
      <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Rapor yapay zeka tahminidir, canlı piyasa verisi değildir. Alım öncesi cihazı yüz yüze kontrol edin.
      </p>
    </div>
  );
}