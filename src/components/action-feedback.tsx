"use client";

import * as React from "react";
import { Check, CircleAlert, LoaderCircle, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult, FeedbackAction } from "@/lib/actions/types";
import { cn } from "@/lib/utils";

type SubmissionState = {
  revision: number;
};

type ActionFeedbackContextValue = {
  pending: boolean;
};

type ToastDetail = ActionResult<unknown> & { id: number };

const TOAST_EVENT = "riftwatch:action-toast";
const initialSubmissionState: SubmissionState = {
  revision: 0,
};
const ActionFeedbackContext =
  React.createContext<ActionFeedbackContextValue | null>(null);

let toastId = 0;

function publishToast(result: ActionResult<unknown>) {
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(TOAST_EVENT, {
      detail: { ...result, id: ++toastId },
    }),
  );
}

export interface ActionFormProps extends Omit<
  React.FormHTMLAttributes<HTMLFormElement>,
  "action"
> {
  action: FeedbackAction<unknown>;
  failureMessage?: string;
  onSuccess?: (result: ActionResult<unknown>) => void;
}

export function ActionForm({
  action,
  children,
  failureMessage = "The operation could not be completed. Please retry.",
  onSuccess,
  ...props
}: ActionFormProps) {
  const submit = React.useCallback(
    async (previous: SubmissionState, formData: FormData) => {
      let result: ActionResult<unknown>;
      try {
        result = await action(formData);
      } catch {
        result = { ok: false, message: failureMessage };
      }
      publishToast(result);
      if (result.ok) onSuccess?.(result);
      return { revision: previous.revision + 1 };
    },
    [action, failureMessage, onSuccess],
  );
  const [, formAction, pending] = React.useActionState(
    submit,
    initialSubmissionState,
  );

  return (
    <ActionFeedbackContext value={{ pending }}>
      <form action={formAction} {...props}>
        {children}
      </form>
    </ActionFeedbackContext>
  );
}

export interface ActionSubmitButtonProps extends Omit<
  ButtonProps,
  "type" | "children"
> {
  children: React.ReactNode;
  pendingLabel?: React.ReactNode;
}

export function ActionSubmitButton({
  children,
  pendingLabel = "Working…",
  disabled,
  ...props
}: ActionSubmitButtonProps) {
  const context = React.use(ActionFeedbackContext);
  const formStatus = useFormStatus();
  const pending = context?.pending ?? formStatus.pending;

  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function ActionToasts() {
  const [toasts, setToasts] = React.useState<ToastDetail[]>([]);

  React.useEffect(() => {
    const dismissalTimers = new Set<number>();

    function receiveToast(event: Event) {
      const toast = (event as CustomEvent<ToastDetail>).detail;
      setToasts((current) => [...current.slice(-2), toast]);
      const timer = window.setTimeout(() => {
        dismissalTimers.delete(timer);
        setToasts((current) => current.filter((item) => item.id !== toast.id));
      }, 4_500);
      dismissalTimers.add(timer);
    }
    window.addEventListener(TOAST_EVENT, receiveToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, receiveToast);
      for (const timer of dismissalTimers) window.clearTimeout(timer);
      dismissalTimers.clear();
    };
  }, []);

  return (
    <div
      data-testid="action-toast-viewport"
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.ok ? "status" : "alert"}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-xl border bg-slate-950/95 p-4 text-sm shadow-2xl shadow-black/40 backdrop-blur",
            toast.ok
              ? "border-emerald-300/25 text-emerald-100"
              : "border-red-400/30 text-red-100",
          )}
        >
          {toast.ok ? (
            <Check className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-300" />
          )}
          <p className="min-w-0 flex-1 leading-5">{toast.message}</p>
          <button
            type="button"
            className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-slate-500 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss notification"
            onClick={() =>
              setToasts((current) =>
                current.filter((item) => item.id !== toast.id),
              )
            }
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
