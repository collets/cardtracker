"use client";

import * as React from "react";
import { Copy, Link2 } from "lucide-react";
import { createGuestAccessLinkAction } from "@/app/(app)/admin/actions";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/types";

type GuestLinkData = {
  url: string;
  expiresAt: Date;
  maxUses: number;
};

function isGuestLinkData(value: unknown): value is GuestLinkData {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    typeof value.url === "string" &&
    "expiresAt" in value &&
    "maxUses" in value &&
    typeof value.maxUses === "number"
  );
}

export function GuestAccessManager() {
  const [link, setLink] = React.useState<GuestLinkData | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
  }

  function handleSuccess(result: ActionResult<unknown>) {
    if (!result.ok || !isGuestLinkData(result.data)) return;
    setLink(result.data);
    setCopied(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-400">
        Create a limited, no-registration demonstration link. It is valid for 24
        hours; each visitor receives one hour of access and can track up to two
        cards.
      </p>
      <ActionForm
        action={createGuestAccessLinkAction}
        onSuccess={handleSuccess}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border bg-slate-950/60 px-3 text-sm text-slate-400">
          <span className="whitespace-nowrap">Visitors</span>
          <Input
            name="maxUses"
            type="number"
            min="1"
            max="5"
            defaultValue="1"
            className="h-9 border-0 bg-transparent px-0 shadow-none hover:bg-transparent focus:ring-0"
          />
        </label>
        <ActionSubmitButton pendingLabel="Creating…">
          <Link2 className="size-4" /> Create guest link
        </ActionSubmitButton>
      </ActionForm>
      {link ? (
        <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.04] p-3">
          <p className="text-sm font-medium text-cyan-100">
            Copy this link now — it is intentionally shown only once.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              value={link.url}
              readOnly
              aria-label="Guest access link"
              className="min-w-0 text-xs"
            />
            <button
              type="button"
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-cyan-300/30 px-3 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-300/10"
              onClick={copyLink}
            >
              <Copy className="size-4" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
