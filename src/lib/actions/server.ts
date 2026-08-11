import "server-only";

import { ZodError } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import { UserFacingError } from "@/lib/errors";

function safeActionError(error: unknown, fallbackMessage: string) {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values and retry.";
  }
  return fallbackMessage;
}

export async function actionResult<T>(
  operation: () => Promise<T>,
  successMessage: string | ((value: T) => string),
  fallbackMessage = "The operation could not be completed. Please retry.",
): Promise<ActionResult<T>> {
  try {
    const value = await operation();
    return {
      ok: true,
      message:
        typeof successMessage === "function"
          ? successMessage(value)
          : successMessage,
      data: value,
    };
  } catch (error) {
    return {
      ok: false,
      message: safeActionError(error, fallbackMessage),
    };
  }
}
