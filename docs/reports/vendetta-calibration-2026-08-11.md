# Vendetta marketplace calibration — 2026-08-11

This is a bounded, read-only CardTrader snapshot produced with
`pnpm market:calibrate -- --expansion Vendetta --sample-size 30`. The command
used the server-side credential only in authorization headers, made no production
changes, retained no raw marketplace response, and emitted aggregate results.

## Result

- Generated: 2026-08-10T23:40:34.765Z
- Method: deterministic rarity-stratified snapshot
- Requested and completed blueprints: 30
- Successful responses: 30
- Failed responses: 0
- Cards with at least one eligible listing: 30 (100.0%)
- Cards with a current comparator baseline: 30 (100.0%)
- Median measurable candidate discount: 14.3%

| Relative discount | Absolute saving | Qualifying cards |
| ----------------: | --------------: | ---------------: |
|               15% |           €3.00 |                2 |
|               20% |           €5.00 |                1 |
|               25% |          €10.00 |                0 |

## Interpretation

The current 20% and €5 rule produced one candidate in this 30-blueprint sample.
That is selective enough to proceed to a shadow rollout and does not provide
evidence for loosening the defaults. Comparator availability was complete in
this sample, which supports the current listings-two-through-six baseline for
active Vendetta printings.

This is not a frequency or precision estimate. Rarity stratification deliberately
over-represents small rarity groups, a single marketplace snapshot cannot detect
stale listings or recurring false positives, and no seven-day historical baseline
was available. Keep the defaults unchanged and reassess after at least seven days
of scheduled observations and manual review of qualifying alerts.
