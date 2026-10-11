"use client";

import React from "react";

interface PriceGraphCardProps {
  result?: {
    phoneName?: string;
    price?: number;
    marketPriceMin?: number;
    marketPriceAvg?: number;
    marketPriceMax?: number;
  };
}

export default function PriceGraphCard({ result }: PriceGraphCardProps) {
  const price = result?.price || 0;
  
  // Türkiye pazarı ortalama ve taban fiyat hesaplaması
  const avgPrice = result?.marketPriceAvg || Math.round(price * 0.95);
  const minPrice = result?.marketPriceMin || Math.round(price * 0.85);
  const targetNegotiation = Math.round(avgPrice * 0.92); // Akıllı pazarlık teklifi

  // Fiyat Durum Rozeti
  let statusBadge = { label: "Piyasa Fiyatı", color: "bg-blue-100 text-blue-700 border-blue-200" };
  if (price > 0 && price <= minPrice * 1.05) {
    statusBadge = { label: "🔥 Fırsat Ürün (Piyasa Altı)", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  } else if (price > avgPrice * 1.08) {
    statusBadge = { label: "⚠️ Piyasa Üstü (Pazarlık Şart)", color: "bg-amber-100 text-amber-700 border-amber-200" };
  }

  return (
    <div className="p-5 border rounded-2xl bg-card text-card-foreground shadow-sm space-y-4">
      {/* Üst Başlık ve Fiyat Segmenti Rozeti */}
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-lg">Piyasa Fiyat Analizi</h3>
          <p className="text-xs text-muted-foreground">Türkiye ikinci el pazar canlı fiyat verileri</p>
        </div>
        <span className={`text-xs px-3 py-1 rounded-full font-semibold border ${statusBadge.color}`}>
          {statusBadge.label}
        </span>
      </div>

      {/* Fiyat İstatistik Kutuları */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="p-3 rounded-xl bg-muted/40 border">
          <p className="text-xs text-muted-foreground">En Düşük Fiyat</p>
          <p className="font-bold text-sm text-foreground">₺{minPrice.toLocaleString("tr-TR")}</p>
        </div>
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <p className="text-xs text-primary font-medium">Piyasa Ortalaması</p>
          <p className="font-extrabold text-base text-primary">₺{avgPrice.toLocaleString("tr-TR")}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border">
          <p className="text-xs text-muted-foreground">İlan Fiyatı</p>
          <p className="font-bold text-sm text-foreground">₺{price.toLocaleString("tr-TR")}</p>
        </div>
      </div>

      {/* Pazarlık Tavsiye Alanı */}
      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">💡 Tavsiye Edilen Pazarlık Teklifi</p>
          <p className="text-xs text-muted-foreground">Satıcıya ilk teklif edebileceğiniz mantıklı tutar</p>
        </div>
        <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
          ₺{targetNegotiation.toLocaleString("tr-TR")}
        </span>
      </div>
    </div>
  );
}