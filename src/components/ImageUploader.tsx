"use client";

import { useRef, useState } from "react";
import ChecklistCard from "@/components/ChecklistCard";
import ResultCard from "@/components/ResultCard";
import { PHONE_PRICE_TABLE } from "@/lib/phonePrices";
import { formatFileSize, validateImage } from "@/lib/validateImage";
import type { AnalysisResult } from "@/types/analysis";

interface SelectedImage {
  file: File;
  previewUrl: string;
}

export default function ImageUploader() {
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [modelId, setModelId] = useState(PHONE_PRICE_TABLE[0].id);
  const [priceText, setPriceText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const price = Number(priceText);
  const hasValidPrice =
    priceText.trim() !== "" && Number.isFinite(price) && price > 0;

  function handleFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setResult(null);
    if (selected) URL.revokeObjectURL(selected.previewUrl);
    setSelected({ file, previewUrl: URL.createObjectURL(file) });
  }

  function handleRemove() {
    if (selected) URL.revokeObjectURL(selected.previewUrl);
    setSelected(null);
    setResult(null);
    setError(null);
    setPriceText("");
  }

  async function handleAnalyze() {
    if (!selected || !hasValidPrice) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", selected.file);
      formData.append("modelId", modelId);
      formData.append("price", String(price));

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Analiz sırasında bir hata oluştu.");
        return;
      }
      setResult(data as AnalysisResult);
    } catch {
      setError("Sunucuya ulaşılamadı. Lütfen tekrar dene.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selected.previewUrl}
            alt="Yüklenen ilan ekran görüntüsü"
            className="mx-auto max-h-96 rounded-lg"
          />
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{selected.file.name}</p>
              <p className="text-sm text-slate-500">
                {formatFileSize(selected.file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isAnalyzing}
              className="shrink-0 text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
            >
              Kaldır
            </button>
          </div>

          <div className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">
              İlandaki bilgileri gir. Görselden otomatik okuma henüz yok.
            </p>
            <div>
              <label className="block text-sm font-medium" htmlFor="model">
                Model
              </label>
              <select
                id="model"
                value={modelId}
                onChange={(e) => {
                  setModelId(e.target.value);
                  setResult(null);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {PHONE_PRICE_TABLE.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} {item.storage}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium" htmlFor="price">
                İlan fiyatı (TL)
              </label>
              <input
                id="price"
                type="number"
                inputMode="numeric"
                min="1"
                value={priceText}
                onChange={(e) => {
                  setPriceText(e.target.value);
                  setResult(null);
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !hasValidPrice}
            className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAnalyzing ? "Analiz ediliyor..." : "Analiz Et"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={`w-full rounded-2xl border border-dashed p-10 text-center transition ${
            isDragging
              ? "border-slate-900 bg-slate-100"
              : "border-slate-300 bg-white hover:bg-slate-50"
          }`}
        >
          <span className="block text-xl font-semibold">
            İlan ekran görüntüsünü yükle
          </span>
          <span className="mt-2 block text-sm text-slate-500">
            Tıkla veya sürükleyip bırak. JPG, JPEG, PNG veya WEBP, en fazla 5 MB
          </span>
        </button>
      )}

      {result && (
        <>
          <ResultCard result={result} />
          <ChecklistCard />
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}