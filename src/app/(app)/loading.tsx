import { LoaderCircle } from "lucide-react";

export default function AuthenticatedPageLoading() {
  return (
    <section aria-label="Loading page" aria-live="polite" role="status">
      <div className="flex items-center gap-3">
        <LoaderCircle
          className="size-5 animate-spin text-cyan-300"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-slate-200">Loading Riftwatch…</p>
          <p className="mt-1 text-xs text-slate-500">
            Fetching the latest account and market data.
          </p>
        </div>
      </div>
      <div className="mt-8 grid animate-pulse gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-28 rounded-2xl border border-white/5 bg-white/[0.03]"
          />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]" />
    </section>
  );
}
