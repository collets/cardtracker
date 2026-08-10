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
