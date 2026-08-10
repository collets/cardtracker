# Data and signals

Catalog tables mirror Riftbound game `22`, restricted to Riftbound Singles
category `258`. User data stores invitations, preferences, quotas, watch filters,
current metrics, hourly observations, alerts, and notification deliveries.

For a watch, listings are filtered and sorted by price. The cheapest listing is
the candidate. The current baseline is the median of listings two through six,
with at least four eligible listings required. Once 24 hourly observations exist,
the historical baseline is the median of the preceding seven days. The effective
reference is the lower available baseline.

A candidate qualifies when it is both 20% and EUR 5 below the reference, unless
the watch overrides those values. Alerts begin at medium confidence and become
high confidence when both a complete comparator set and historical data exist.
Two consecutive misses expire an alert. Hourly observations older than 30 days
are pruned; full marketplace responses are never stored.
