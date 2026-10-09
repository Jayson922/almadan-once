import {
  PHONE_RISK_CHECKLIST,
  PHONE_SELLER_QUESTIONS,
} from "@/lib/phoneChecklist";

export default function ChecklistCard() {
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold">Satın almadan önce kontrol et</h2>
      <p className="mt-1 text-sm text-slate-500">
        Bu liste genel bir rehberdir, bu ilana özel bir analiz değildir.
      </p>

      <ul className="mt-4 space-y-3">
        {PHONE_RISK_CHECKLIST.map((item) => (
          <li key={item.id}>
            <details className="rounded-lg border border-slate-200 px-4 py-3">
              <summary className="cursor-pointer font-medium">
                {item.title}
              </summary>
              <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
            </details>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-semibold">Satıcıya sorulacak sorular</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {PHONE_SELLER_QUESTIONS.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </div>
  );
}