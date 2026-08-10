import { describe, expect, it } from "vitest";
import {
  formatCompactLanguageCode,
  formatLanguageCode,
  getBlueprintFinishLabel,
  getBlueprintLanguageCodes,
} from "@/lib/catalog/metadata";

const editableProperties = [
  {
    name: "condition",
    possible_values: ["Near Mint", "Played"],
  },
  {
    name: "riftbound_language",
    possible_values: ["en", "fr", "kr", "zh-CN", "en"],
  },
  {
    name: "riftbound_foil",
    possible_values: [true, false],
  },
];

describe("catalog metadata", () => {
  it("extracts unique CardTrader language codes", () => {
    expect(getBlueprintLanguageCodes(editableProperties)).toEqual([
      "en",
      "fr",
      "kr",
      "zh-CN",
    ]);
    expect(formatLanguageCode("zh-CN")).toBe("ZH-CN");
    expect(formatCompactLanguageCode("zh-CN")).toBe("ZH");
  });

  it("describes the available foil treatments", () => {
    expect(getBlueprintFinishLabel(editableProperties)).toBe("Foil + non-foil");
    expect(
      getBlueprintFinishLabel([
        { name: "riftbound_foil", possible_values: [true] },
      ]),
    ).toBe("Foil");
    expect(
      getBlueprintFinishLabel([
        { name: "riftbound_foil", possible_values: [false] },
      ]),
    ).toBe("Non-foil");
  });

  it("ignores missing or malformed metadata", () => {
    expect(getBlueprintLanguageCodes([])).toEqual([]);
    expect(
      getBlueprintLanguageCodes([
        { name: "riftbound_language", possible_values: ["en", null, true] },
      ]),
    ).toEqual(["en"]);
    expect(getBlueprintFinishLabel([])).toBeNull();
  });
});
