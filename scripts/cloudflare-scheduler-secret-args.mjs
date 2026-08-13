const secretNames = new Set([
  "RIFTWATCH_SCAN_URL",
  "CRON_SECRET",
  "SCHEDULER_ENABLED",
]);

export function schedulerSecretName(values) {
  const arguments_ = values.filter((value) => value !== "--");
  if (arguments_.length !== 1 || !secretNames.has(arguments_[0] ?? "")) {
    return null;
  }
  return arguments_[0];
}
