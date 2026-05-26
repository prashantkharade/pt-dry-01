# orders-service

Order intake, status workflow (Booked → PickedUp → InProcess → Ready → Delivered → Closed), bill totals, audit history.

Runs on port `4003`.

Depends on:
* `identity-service` (customer lookup)
* `catalog-pricing-service` (rate-card quote + surcharges)

See [`../identity-service/README.md`](../identity-service/README.md) for the canonical folder layout — every service in this monorepo follows it.
