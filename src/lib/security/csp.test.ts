import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/proxy";

describe("content security policy", () => {
  it("uses a strict production script policy and narrow external access", () => {
    const policy = buildContentSecurityPolicy("nonce-value", false);

    expect(policy).toContain(
      "script-src 'self' 'nonce-nonce-value' 'strict-dynamic'",
    );
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("connect-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows only the development evaluator and websocket additions", () => {
    const policy = buildContentSecurityPolicy("dev", true);

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("connect-src 'self' ws: wss:");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});
