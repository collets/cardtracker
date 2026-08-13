import { describe, expect, it } from "vitest";
import { pendingMigrationTags } from "@/db/migration-report";

describe("pendingMigrationTags", () => {
  const entries = [
    { tag: "0002_later", when: 300 },
    { tag: "0000_first", when: 100 },
    { tag: "0001_middle", when: 200 },
  ];

  it("reports every migration in journal order for an empty database", () => {
    expect(pendingMigrationTags(entries, null)).toEqual([
      "0000_first",
      "0001_middle",
      "0002_later",
    ]);
  });

  it("reports only migrations newer than the recorded migration", () => {
    expect(pendingMigrationTags(entries, 200)).toEqual(["0002_later"]);
  });

  it("ignores invalid journal entries", () => {
    expect(
      pendingMigrationTags(
        [...entries, { tag: "", when: 400 }, { tag: "bad", when: Number.NaN }],
        300,
      ),
    ).toEqual([]);
  });
});
