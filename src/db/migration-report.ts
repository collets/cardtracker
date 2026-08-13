export type MigrationJournalEntry = {
  tag: string;
  when: number;
};

export function pendingMigrationTags(
  entries: readonly MigrationJournalEntry[],
  lastAppliedAt: number | null,
) {
  const appliedThrough = lastAppliedAt ?? -1;

  return entries
    .filter(
      (entry) =>
        Number.isSafeInteger(entry.when) &&
        entry.when > appliedThrough &&
        entry.tag.trim().length > 0,
    )
    .sort((left, right) => left.when - right.when)
    .map((entry) => entry.tag);
}
