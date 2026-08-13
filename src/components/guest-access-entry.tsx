"use client";

import * as React from "react";
import Link from "next/link";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { redeemGuestAccessAction } from "@/app/guest/actions";
import { Button } from "@/components/ui/button";

type GuestAccessEntryProps = {
  initialError?: "expired" | "invalid";
};

export function GuestAccessEntry({ initialError }: GuestAccessEntryProps) {
  const redemptionStarted = React.useRef(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [result, formAction, pending] = React.useActionState(
    redeemGuestAccessAction,
    { error: "" },
  );
  const [status, setStatus] = React.useState<"loading" | "error">(
    initialError ? "error" : "loading",
  );
  const [message, setMessage] = React.useState(
    initialError
      ? initialError === "expired"
        ? "Your guest session has expired. Ask for a new demonstration link if you need more time."
        : "This guest link is invalid, expired, revoked, or has already reached its visitor limit."
      : "Checking guest access…",
  );

  React.useEffect(() => {
    if (initialError || redemptionStarted.current) return;
    redemptionStarted.current = true;
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      queueMicrotask(() => {
        setStatus("error");
        setMessage("This guest link is missing its access token.");
      });
      return;
    }
    queueMicrotask(() => setToken(token));
  }, [initialError]);

  React.useEffect(() => {
    if (!token || !formRef.current) return;
    formRef.current.requestSubmit();
  }, [token]);

  const errorMessage = result.error;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur">
        {status === "loading" && !errorMessage ? (
          <>
            <LoaderCircle className="mx-auto size-7 animate-spin text-cyan-300" />
            <h1 className="mt-5 text-xl font-semibold">Entering Riftwatch</h1>
            <p className="mt-2 text-sm text-slate-400">
              {pending ? "Signing you in…" : message}
            </p>
            {token ? (
              <form ref={formRef} action={formAction} className="hidden">
                <input name="guestAccessToken" value={token} readOnly />
              </form>
            ) : null}
          </>
        ) : (
          <>
            <CircleAlert className="mx-auto size-7 text-amber-300" />
            <h1 className="mt-5 text-xl font-semibold">
              Guest access unavailable
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {errorMessage ?? message}
            </p>
            <Button asChild className="mt-6">
              <Link href="/">Go to the home page</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
