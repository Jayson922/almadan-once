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
  const [isExtracting, setIsExtracting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [modelId, setModelId] = useState(PHONE_PRICE_TABLE[0].id);
  const [priceText, setPriceText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const price = Number(priceText);
  const hasValidPrice =
    priceText.trim() !== "" && Number.isFinite(price) && price > 0;

  async function extractListingData(file: File) {
    setIsExtracting(true);
    setExtractNotice(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        let autoFilled = false;

        if (data.modelId && PHONE_PRICE_TABLE.some((p) => p.id === data.modelId)) {
          setModelId(data.modelId);
          autoFilled = true;
        }

        if (typeof data.price === "number" && data.price > 0) {
          setPriceText(String(data.price));
          autoFilled = true;
        }

        if (autoFilled) {
          setExtractNotice("Görseldeki bilgiler otomatik olarak dolduruldu. Lütfen kontrol edin.");
        } else {
          setExtractNotice("Görselden model veya fiyat okunamadı. Lütfen bilgileri elle girin.");
        }
      } else {
        setExtractNotice("Görsel analizi yapılamadı. Lütfen bilgileri elle girin.");
      }
    } catch {
      setExtractNotice("Görsel okuma zaman aşımına uğradı veya hata oluştu. Bilgileri elle girebilirsiniz.");
    } finally {
      setIsExtracting(false);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setResult(null);
    setExtractNotice(null);
    if (selected) URL.revokeObjectURL(selected.previewUrl);
    setSelected({ file, previewUrl: URL.createObjectURL(file) });

    extractListingData(file);
  }

  function handleRemove() {
    if (selected) URL.revokeObjectURL(selected.previewUrl);
    setSelected(null);
    setResult(null);
    setError(null);
    setExtractNotice(null);
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
              <p className="truncate text-sm font-medium">{selected.file.name}</p>
              <p className="text-xs text-slate-500">
                {formatFileSize(selected.file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Kaldır
            </button>
          </div>

          {isExtracting && (
            <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              Görseldeki ilan bilgileri Yapay Zeka ile okunuyor...
            </div>
          )}

          {extractNotice && !isExtracting && (
            <div className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
              {extractNotice}
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
            disabled={isAnalyzing || isExtracting || !hasValidPrice}
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