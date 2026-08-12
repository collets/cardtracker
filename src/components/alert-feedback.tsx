"use client";

import * as React from "react";
import {
  BadgeEuro,
  CircleCheck,
  CircleOff,
  MessageCircleMore,
  PackageCheck,
  SlidersHorizontal,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { saveAlertFeedbackAction } from "@/app/(app)/actions";
import { ActionForm, ActionSubmitButton } from "@/components/action-feedback";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ALERT_FEEDBACK_OPTIONS,
  alertFeedbackLabel,
  type AlertFeedbackOutcome,
} from "@/lib/alerts/feedback-options";

const feedbackIcons: Record<AlertFeedbackOutcome, LucideIcon> = {
  purchased: PackageCheck,
  useful: CircleCheck,
  unavailable: CircleOff,
  not_a_deal: BadgeEuro,
  wrong_details: SlidersHorizontal,
  shipping_too_expensive: Truck,
};

export function AlertFeedbackDialog({
  alertId,
  currentOutcome,
}: {
  alertId: string;
  currentOutcome: AlertFeedbackOutcome | null;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerLabel = currentOutcome
    ? alertFeedbackLabel(currentOutcome)
    : "Rate alert";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={currentOutcome ? "secondary" : "outline"}
          className="h-10 flex-1 sm:h-8 sm:flex-none"
          aria-label={
            currentOutcome ? `Feedback: ${triggerLabel}` : triggerLabel
          }
        >
          <MessageCircleMore className="size-3.5" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="top-auto right-0 bottom-0 left-0 max-h-[calc(100dvh-0.5rem)] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 sm:top-1/2 sm:right-auto sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-5 pr-14 sm:px-6">
          <DialogTitle>How useful was this alert?</DialogTitle>
          <DialogDescription>
            One tap is enough. You can change your answer later.
          </DialogDescription>
        </DialogHeader>
        <div className="app-scrollbar max-h-[calc(100dvh-9rem)] space-y-2 overflow-y-auto px-4 py-4 pb-6 sm:px-6">
          {ALERT_FEEDBACK_OPTIONS.map((option) => {
            const Icon = feedbackIcons[option.value];
            const selected = currentOutcome === option.value;
            return (
              <ActionForm
                key={option.value}
                action={saveAlertFeedbackAction}
                onSuccess={() => setOpen(false)}
              >
                <input type="hidden" name="alertId" value={alertId} />
                <input type="hidden" name="outcome" value={option.value} />
                <ActionSubmitButton
                  variant={selected ? "secondary" : "ghost"}
                  className="h-auto min-h-14 w-full justify-start border border-white/10 px-4 py-3 text-left whitespace-normal hover:border-cyan-300/30"
                  pendingLabel="Saving feedback…"
                  aria-pressed={selected}
                >
                  <Icon
                    className="size-5 shrink-0 text-cyan-200"
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium text-slate-100">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 font-normal text-slate-400">
                      {option.description}
                    </span>
                  </span>
                </ActionSubmitButton>
              </ActionForm>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
