type EditableProperty = {
  name: string;
  possible_values?: unknown[];
};

const LANGUAGE_SORT_ORDER = ["en", "fr", "kr", "zh-CN"];

function findEditableProperty(
  properties: unknown[],
  name: string,
): EditableProperty | null {
  const property = properties.find(
    (candidate): candidate is EditableProperty =>
      typeof candidate === "object" &&
      candidate !== null &&
      "name" in candidate &&
      candidate.name === name,
  );

  return property ?? null;
}

export function getBlueprintLanguageCodes(properties: unknown[]): string[] {
  const values = findEditableProperty(
    properties,
    "riftbound_language",
  )?.possible_values;

  if (!Array.isArray(values)) return [];

  return [
    ...new Set(
      values.filter((value): value is string => typeof value === "string"),
    ),
  ].sort((left, right) => {
    const leftIndex = LANGUAGE_SORT_ORDER.indexOf(left);
    const rightIndex = LANGUAGE_SORT_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}

export function formatLanguageCode(code: string): string {
  return code.toUpperCase();
}

export function formatCompactLanguageCode(code: string): string {
  return code.split("-", 1)[0]?.toUpperCase() ?? code.toUpperCase();
}

export function getBlueprintFinishLabel(properties: unknown[]): string | null {
  const values = findEditableProperty(
    properties,
    "riftbound_foil",
  )?.possible_values;

  if (!Array.isArray(values)) return null;

  const supportsFoil = values.includes(true);
  const supportsNonFoil = values.includes(false);

  if (supportsFoil && supportsNonFoil) return "Foil + non-foil";
  if (supportsFoil) return "Foil";
  if (supportsNonFoil) return "Non-foil";

  return null;
}
