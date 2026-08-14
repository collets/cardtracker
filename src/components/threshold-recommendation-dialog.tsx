"use client";

import * as React from "react";
import { BadgeEuro, SlidersHorizontal } from "lucide-react";
import {
  applyThresholdRecommendationAction,
  dismissThresholdRecommendationAction,
} from "@/app/(app)/actions";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatEuro } from "@/lib/utils";

export function ThresholdRecommendationDialog({
  recommendation,
}: {
  recommendation: {
    id: string;
    currentDiscountPercent: number;
    currentMinSavingsCents: number;
    proposedDiscountPercent: number;
    proposedMinSavingsCents: number;
    referencePriceCents: number;
    eligibleCount: number;
  };
}) {
  const [open, setOpen] = React.useState(true);

  function closeAndEdit() {
    setOpen(false);
    window.setTimeout(() => {
      document
        .getElementById("watch-filters")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("discountPercent")?.focus();
    }, 100);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-auto right-0 bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none p-0 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <DialogHeader className="border-b px-5 py-5 pr-14 sm:px-6">
          <DialogTitle>Use price-aware thresholds?</DialogTitle>
          <DialogDescription>
            We found {recommendation.eligibleCount} comparable listings around a{" "}
            {formatEuro(recommendation.referencePriceCents)} reference price.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-white/[0.03] p-4">
              <p className="text-xs text-slate-500">Current</p>
              <p className="mt-2 font-medium">
                {recommendation.currentDiscountPercent}% and{" "}
                {formatEuro(recommendation.currentMinSavingsCents)}
              </p>
            </div>
            <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.06] p-4">
              <p className="text-xs text-cyan-200">Suggested</p>
              <p className="mt-2 font-medium text-cyan-50">
                {recommendation.proposedDiscountPercent}% and{" "}
                {formatEuro(recommendation.proposedMinSavingsCents)}
              </p>
            </div>
          </div>
          <p className="text-sm leading-6 text-slate-400">
            The lower absolute floor better matches this card&apos;s observed
            price. Nothing changes until you accept.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ActionForm
              action={applyThresholdRecommendationAction}
              onSuccess={() => setOpen(false)}
            >
              <input
                type="hidden"
                name="recommendationId"
                value={recommendation.id}
              />
              <ActionSubmitButton
                className="h-auto min-h-12 w-full whitespace-normal"
                pendingLabel="Applying…"
              >
                <BadgeEuro className="size-4" /> Apply suggestion
              </ActionSubmitButton>
            </ActionForm>
            <ActionForm
              action={dismissThresholdRecommendationAction}
              onSuccess={closeAndEdit}
            >
              <input
                type="hidden"
                name="recommendationId"
                value={recommendation.id}
              />
              <ActionSubmitButton
                variant="outline"
                className="h-auto min-h-12 w-full whitespace-normal"
                pendingLabel="Opening filters…"
              >
                <SlidersHorizontal className="size-4" /> I’ll change it myself
              </ActionSubmitButton>
            </ActionForm>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
