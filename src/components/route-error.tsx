"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section
      className="mx-auto flex min-h-[24rem] max-w-xl flex-col items-center justify-center text-center"
      role="alert"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-amber-300/10 text-amber-200">
        <AlertTriangle className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-xl font-semibold">This page did not load</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
        Riftwatch could not complete this request. Retry it; if the problem
        happens again, the operation identifier is available in the server logs.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-slate-600">
          Reference: {error.digest}
        </p>
      ) : null}
      <Button className="mt-6" onClick={retry}>
        <RefreshCw className="size-4" aria-hidden="true" /> Retry
      </Button>
    </section>
  );
}
