import PriceTester from "@/components/PriceTester";

export default function PriceTestPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-bold">Fiyat testi (geçici sayfa)</h1>
        <p className="mt-2 mb-6 text-sm text-slate-600">
          Model ve ilan fiyatını elle girerek değerlendirme mantığını dene.
        </p>
        <PriceTester />
      </div>
    </main>
  );
}