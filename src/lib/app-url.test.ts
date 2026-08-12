import { describe, expect, it } from "vitest";
import { buildAppUrl } from "@/lib/app-url";

describe("buildAppUrl", () => {
  it.each(["https://riftwatch.example.com", "https://riftwatch.example.com/"])(
    "builds an absolute path from %s",
    (baseUrl) => {
      expect(buildAppUrl(baseUrl, "/alerts")).toBe(
        "https://riftwatch.example.com/alerts",
      );
    },
  );
});
