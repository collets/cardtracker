import { describe, expect, it } from "vitest";
import { DATABASE_CONNECTION_OPTIONS, databasePoolLimit } from "@/db/index";

describe("database connection configuration", () => {
  it("keeps each serverless runtime to a small production pool", () => {
    expect(databasePoolLimit("production")).toBe(3);
    expect(databasePoolLimit("development")).toBe(5);
    expect(databasePoolLimit("test")).toBe(5);
  });

  it("recycles idle pooled connections and disables prepared statements", () => {
    expect(DATABASE_CONNECTION_OPTIONS).toMatchObject({
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 600,
      connection: { application_name: "riftwatch" },
    });
  });
});
