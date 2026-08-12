export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function boundedErrorMessage(
  error: unknown,
  fallback: string,
  maxLength = 500,
): string {
  return (error instanceof Error ? error.message : fallback).slice(
    0,
    maxLength,
  );
}
