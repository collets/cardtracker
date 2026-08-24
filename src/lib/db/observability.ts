import "server-only";

const SLOW_DATABASE_OPERATION_MS = 1_000;
export const DATABASE_OPERATION_TIMEOUT_MS = 10_000;

type CancellablePromise<T> = Promise<T> & {
  cancel: () => void;
};

type DatabaseErrorDetails = {
  name: string;
  code?: string;
};

function databaseErrorDetails(error: unknown): DatabaseErrorDetails {
  const name = error instanceof Error ? error.name : "UnknownError";
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return { name, code: error.code };
  }
  return { name };
}

export async function observeDatabaseOperation<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const value = await run();
    const durationMs = Math.round(performance.now() - startedAt);
    if (durationMs >= SLOW_DATABASE_OPERATION_MS) {
      console.warn("Slow database operation", { operation, durationMs });
    }
    return value;
  } catch (error) {
    console.error("Database operation failed", {
      operation,
      durationMs: Math.round(performance.now() - startedAt),
      ...databaseErrorDetails(error),
    });
    throw error;
  }
}

export async function observeCancellableDatabaseOperation<T>(
  operation: string,
  query: CancellablePromise<T>,
  timeoutMs = DATABASE_OPERATION_TIMEOUT_MS,
): Promise<T> {
  const timeout = setTimeout(() => query.cancel(), timeoutMs);
  try {
    return await observeDatabaseOperation(operation, () => query);
  } finally {
    clearTimeout(timeout);
  }
}
