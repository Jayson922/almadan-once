import ImageUploader from "@/components/ImageUploader";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            ALMADAN ÖNCE
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            İkinci el ürünü satın almadan önce fiyatını ve ilanını kontrol et.
          </p>
        </header>

        <div className="mt-12">
          <ImageUploader />
        </div>
      </div>
    </main>
  );
}