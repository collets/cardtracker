#!/usr/bin/env node

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const command = process.argv[2] ?? "status";
const args = process.argv.slice(3);

function argument(flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireValue(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function telegram(method: string, body?: Record<string, unknown>) {
  const token = requireValue("TELEGRAM_BOT_TOKEN");
  const response = await fetch(
    `https://api.telegram.org/bot${token}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = (await response.json()) as {
    ok?: boolean;
    description?: string;
    result?: unknown;
  };
  if (!response.ok || payload.ok !== true) {
    throw new Error(`Telegram ${method} failed with HTTP ${response.status}`);
  }
  return payload.result;
}

try {
  switch (command) {
    case "set": {
      const url = argument("--url") ?? process.env.NEXT_PUBLIC_APP_URL;
      if (!url || new URL(url).protocol !== "https:") {
        throw new Error("Pass an HTTPS deployment URL with --url");
      }
      await telegram("setWebhook", {
        url: `${url.replace(/\/$/, "")}/api/telegram/webhook`,
        secret_token: requireValue("TELEGRAM_WEBHOOK_SECRET"),
        allowed_updates: ["message"],
        drop_pending_updates: false,
      });
      process.stdout.write("✓ Telegram webhook registered.\n");
      break;
    }
    case "delete":
      await telegram("deleteWebhook", { drop_pending_updates: false });
      process.stdout.write("✓ Telegram webhook removed.\n");
      break;
    case "status": {
      const result = (await telegram("getWebhookInfo")) as {
        url?: string;
        pending_update_count?: number;
        last_error_date?: number;
        last_error_message?: string;
      };
      process.stdout.write(
        [
          `Webhook configured: ${Boolean(result.url)}`,
          `Pending updates: ${result.pending_update_count ?? 0}`,
          `Last error at: ${result.last_error_date ? new Date(result.last_error_date * 1_000).toISOString() : "none"}`,
          `Last error: ${result.last_error_message?.slice(0, 200) ?? "none"}`,
        ].join("\n") + "\n",
      );
      break;
    }
    default:
      throw new Error("Use set, status, or delete");
  }
} catch (error) {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : "Unknown Telegram webhook error"}\n`,
  );
  process.exitCode = 1;
}
