# Data and signals

Catalog tables mirror Riftbound game `22`, restricted to Riftbound Singles
category `258`. User data stores invitations, preferences, quotas, watch filters,
current metrics, hourly observations, alerts, threshold recommendations, and
notification deliveries.

For a watch, listings are filtered and sorted by price. The cheapest listing is
the candidate. The current baseline is the median of listings two through six,
with at least four eligible listings required. Once 24 hourly observations exist,
the historical baseline is the median of the preceding seven days. The effective
reference is the lower available baseline.

For a member watch that still has the 20% / EUR 5 defaults, the first scan with
at least four eligible listings may persist one threshold recommendation. It is
created only when EUR 5 is stricter than the percentage rule. The suggested
absolute saving is 10% of the effective reference, rounded to the nearest cent
and bounded between EUR 0.01 and EUR 5; the discount remains 20%. The unique watch
constraint makes this a one-time calibration prompt. Applying it uses an
optimistic threshold check, dismissing resolves it permanently, and a manual
threshold edit marks a pending recommendation stale. Guest watches are excluded.

A candidate qualifies when it is both 20% and EUR 5 below the reference, unless
the watch overrides those values. Alerts begin at medium confidence and become
high confidence when both a complete comparator set and historical data exist.
Two consecutive misses expire an alert. Alerts are immutable deal events: the
scanner suppresses unchanged listings, creates a later event only for a EUR 2
or 10% improvement, permits a previously absent listing after a 24-hour
cooldown, and requires a different listing to materially beat the best active
deal. Archive/read state never disables a watch. Hourly observations older than
30 days are pruned; full marketplace responses are never stored.
