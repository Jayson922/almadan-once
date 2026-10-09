"use client";

import { useState } from "react";
import { evaluatePhonePrice } from "@/lib/evaluatePrice";
import { PHONE_PRICE_TABLE } from "@/lib/phonePrices";

const LABELS = {
  great_deal: "ÇOK UYGUN",
  fair: "UYGUN",
  expensive: "PAHALI",
  unknown: "BELİRSİZ",
} as const;

export default function PriceTester() {
  const [modelId, setModelId] = useState(PHONE_PRICE_TABLE[0].id);
  const [priceText, setPriceText] = useState("");

  const price = Number(priceText);
  const hasPrice = priceText.trim() !== "" && Number.isFinite(price);
  const evaluation = hasPrice ? evaluatePhonePrice(modelId, price) : null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <label className="block text-sm font-medium" htmlFor="model">
        Model
      </label>
      <select
        id="model"
        value={modelId}
        onChange={(e) => setModelId(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      >
        {PHONE_PRICE_TABLE.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} {item.storage}
          </option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-medium" htmlFor="price">
        İlan fiyatı (TL)
      </label>
      <input
        id="price"
        type="number"
        inputMode="numeric"
        value={priceText}
        onChange={(e) => setPriceText(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      {evaluation && (
        <div className="mt-6 rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Değerlendirme</p>
          <p className="text-xl font-bold">{LABELS[evaluation.verdict]}</p>
          {evaluation.marketPrice ? (
            <p className="mt-1 text-sm text-slate-600">
              Piyasa aralığı:{" "}
              {evaluation.marketPrice.min.toLocaleString("tr-TR")} -{" "}
              {evaluation.marketPrice.max.toLocaleString("tr-TR")} TL
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Bu model için henüz fiyat verisi girilmemiş.
            </p>
          )}
        </div>
      )}
    </div>
  );
}