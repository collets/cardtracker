/**
 * Free scheduler bridge: Cloudflare provides the clock, while Riftwatch keeps
 * authorization, leases, pacing, CardTrader access, and persistence.
 *
 * Required encrypted Worker secrets:
 * - SCHEDULER_ENABLED: exactly "true" only after operator approval.
 * - RIFTWATCH_SCAN_URL: canonical HTTPS /api/cron/scan endpoint.
 * - CRON_SECRET: the matching Riftwatch production cron secret.
 */
function marketScanUrl(value) {
  if (!value) throw new Error("Missing Riftwatch scheduler configuration");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/api/cron/scan" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Invalid Riftwatch scheduler URL");
  }
  return url;
}

async function triggerMarketScan(env, controller) {
  if (env.SCHEDULER_ENABLED !== "true") return;

  const url = marketScanUrl(env.RIFTWATCH_SCAN_URL);
  if (!env.CRON_SECRET) {
    throw new Error("Missing Riftwatch scheduler configuration");
  }

  const response = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  if (!response.ok) {
    // Credentials or route configuration will not recover through retries.
    if (response.status >= 400 && response.status < 500) controller.noRetry();
    throw new Error(`Riftwatch market scan returned HTTP ${response.status}`);
  }
}

const scheduler = {
  async scheduled(controller, env) {
    await triggerMarketScan(env, controller);
  },
};

export default scheduler;
export { marketScanUrl, triggerMarketScan };
