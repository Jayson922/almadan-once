"use client";

import { useRef, useState } from "react";
import ChecklistCard from "@/components/ChecklistCard";
import ResultCard from "@/components/ResultCard";
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
  const inputRef = useRef<HTMLInputElement>(null);

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
  }

  async function handleAnalyze() {
    if (!selected) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("image", selected.file);

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
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
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