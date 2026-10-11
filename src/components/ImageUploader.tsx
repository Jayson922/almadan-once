"use client";

import React, { useState } from "react";

interface ImageUploaderProps {
  onImageExtracted: (data: {
    brand: string;
    model: string;
    storage: string;
    condition: string;
    extractedPrice: number | null;
    extractedTitle: string;
    sellerNote: string;
  }) => void;
  onImageSelected: (base64: string) => void;
}

export default function ImageUploader({
  onImageExtracted,
  onImageSelected,
}: ImageUploaderProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Lütfen geçerli bir görsel dosyası yükleyin.");
      return;
    }

    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setPreview(base64);
      onImageSelected(base64);

      // Vision AI API çağrısı
      setLoading(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          onImageExtracted(json.data);
        } else {
          setError(json.error || "Görselden bilgi çıkarılamadı.");
        }
      } catch (err: any) {
        setError("Bağlantı hatası: Görsel analiz edilemedi.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
        }}
        className="border-2 border-dashed border-zinc-700 rounded-xl p-6 text-center hover:border-indigo-500 transition cursor-pointer bg-zinc-900/50 relative overflow-hidden"
      >
        {preview ? (
          <div className="relative h-48 w-full flex items-center justify-center">
            <img
              src={preview}
              alt="Yüklenen İlan"
              className="max-h-48 object-contain rounded-lg"
            />
            {loading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium text-sm">
                Yapay Zeka Görseli İnceliyor...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-zinc-400 text-sm">
              Görseli sürükleyip bırakın, tıklayarak seçin veya{" "}
              <span className="text-indigo-400 font-semibold">Ctrl+V ile yapıştırın</span>
            </div>
            <p className="text-xs text-zinc-500">PNG, JPG, WEBP (Max 1280px sıkıştırılır)</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
        />
      </div>

      {loading && !preview && (
        <div className="text-center text-sm text-indigo-400 animate-pulse">
          Gemini Vision cihazı ve ilan detaylarını okuyor...
        </div>
      )}

      {error && <div className="text-red-400 text-xs">{error}</div>}
    </div>
  );
}