import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: optionalUrl,
    DATABASE_URL_DIRECT: optionalUrl,
    AUTH_SECRET: z.string().min(16).optional(),
    AUTH_GOOGLE_ID: z.string().optional(),
    AUTH_GOOGLE_SECRET: z.string().optional(),
    AUTH_ENABLE_DEV_PROVIDER: z.enum(["true", "false"]).default("false"),
    ADMIN_EMAIL: z.string().email().optional(),
    CARD_TRADER_AUTH_TOKEN: z.string().min(1).optional(),
    CRON_SECRET: z.string().min(16).optional(),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_BOT_USERNAME: z.string().optional(),
    TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
    SCAN_BATCH_SIZE: z.coerce.number().int().min(1).max(250).default(50),
    MAX_ACTIVE_BLUEPRINTS: z.coerce.number().int().min(1).default(250),
    DEFAULT_WATCH_QUOTA: z.coerce.number().int().min(1).max(500).default(50),
  })
  .superRefine((env, context) => {
    if (
      env.NODE_ENV === "production" &&
      env.AUTH_ENABLE_DEV_PROVIDER === "true"
    ) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_ENABLE_DEV_PROVIDER"],
        message: "The development auth provider must be disabled in production",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

const productionRequiredKeys = [
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "ADMIN_EMAIL",
  "CARD_TRADER_AUTH_TOKEN",
  "CRON_SECRET",
] as const;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  cachedEnv ??= serverEnvSchema.parse(process.env);
  return cachedEnv;
}

export function requireEnv<K extends keyof ServerEnv>(
  key: K,
): NonNullable<ServerEnv[K]> {
  const value = getServerEnv()[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required server environment variable: ${key}`);
  }
  return value as NonNullable<ServerEnv[K]>;
}

export function productionEnvironmentIssues(
  input: Record<string, string | undefined> = process.env,
  options: { requireDirectDatabase?: boolean } = {},
): string[] {
  const parsed = serverEnvSchema.safeParse({
    ...input,
    NODE_ENV: "production",
  });
  const issues = parsed.success
    ? []
    : parsed.error.issues.map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      });
  const env = parsed.success ? parsed.data : input;
  for (const key of productionRequiredKeys) {
    if (!env[key]) issues.push(`${key}: required in production`);
  }
  if (options.requireDirectDatabase && !env.DATABASE_URL_DIRECT) {
    issues.push("DATABASE_URL_DIRECT: required for hosted migrations");
  }
  if (!options.requireDirectDatabase && env.DATABASE_URL_DIRECT) {
    issues.push(
      "DATABASE_URL_DIRECT: must not be present in the application runtime environment",
    );
  }
  if ((env.AUTH_SECRET?.length ?? 0) < 32) {
    issues.push(
      "AUTH_SECRET: must contain at least 32 characters in production",
    );
  }
  if ((env.CRON_SECRET?.length ?? 0) < 32) {
    issues.push(
      "CRON_SECRET: must contain at least 32 characters in production",
    );
  }

  const telegramValues = [
    env.TELEGRAM_BOT_TOKEN,
    env.TELEGRAM_BOT_USERNAME,
    env.TELEGRAM_WEBHOOK_SECRET,
  ];
  const configuredTelegramValues = telegramValues.filter(Boolean).length;
  if (configuredTelegramValues > 0 && configuredTelegramValues < 3) {
    issues.push(
      "Telegram: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and TELEGRAM_WEBHOOK_SECRET must be configured together",
    );
  }
  if (env.NEXT_PUBLIC_APP_URL) {
    try {
      if (new URL(env.NEXT_PUBLIC_APP_URL).protocol !== "https:") {
        issues.push("NEXT_PUBLIC_APP_URL: production URL must use HTTPS");
      }
    } catch {
      // The schema issue above already identifies an invalid URL.
    }
  }
  if (env.DATABASE_URL) {
    try {
      const databaseUrl = new URL(env.DATABASE_URL);
      const role = decodeURIComponent(databaseUrl.username).split(".")[0];
      if (role !== "riftwatch_app") {
        issues.push(
          "DATABASE_URL: production runtime must use the riftwatch_app role",
        );
      }
      if (databaseUrl.searchParams.get("sslmode") !== "require") {
        issues.push("DATABASE_URL: production connections must require SSL");
      }
    } catch {
      // The schema issue above already identifies an invalid URL.
    }
  }

  return issues;
}
