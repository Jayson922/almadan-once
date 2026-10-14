"use client";

import React, { useState } from "react";
import { getChecklistForModel, CheckItem } from "@/lib/checklists";

interface ChecklistCardProps {
  phoneName?: string;
  listPrice?: number;
}

export default function ChecklistCard({ phoneName = "Telefon", listPrice }: ChecklistCardProps) {
  const items: CheckItem[] = getChecklistForModel(phoneName);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="p-5 border rounded-2xl bg-card text-card-foreground shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div>
          <h3 className="font-bold text-lg">{phoneName} Alım Kontrol Listesi</h3>
          <p className="text-xs text-muted-foreground">İkinci el alım yapmadan önce mutlaka kontrol edin.</p>
        </div>
        {listPrice && (
          <span className="text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">
            İlan: ₺{listPrice.toLocaleString("tr-TR")}
          </span>
        )}
      </div>

      <div className="space-y-2.5">
        {items.map((item) => (
          <label
            key={item.id}
            htmlFor={item.id}
            className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
              checkedItems[item.id] ? "bg-muted/50 opacity-60 line-through" : "hover:bg-accent/50"
            }`}
          >
            <input
              type="checkbox"
              id={item.id}
              checked={!!checkedItems[item.id]}
              onChange={() => toggleCheck(item.id)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div className="flex-1 text-sm">
              <span className={item.critical ? "font-semibold text-destructive" : ""}>
                {item.critical && <span className="mr-1 text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">KRİTİK</span>}
                {item.label}
              </span>
            </div>
          </label>
        ))}
      </div>

      <div className="pt-2">
        <a
          href="https://www.turkiye.gov.tr/imei-sorgulama"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full text-xs text-center py-2 px-3 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors"
        >
          🔍 e-Devlet IMEI Sorgulama Sayfasına Git ↗
        </a>
      </div>
    </div>
  );
}