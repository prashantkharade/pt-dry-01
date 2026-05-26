# catalog-pricing-service

Items, item categories, service types, rate cards, surcharges and the **pricing engine** (`POST /api/v1/pricing/quote`).

Runs on port `4002`.

Seeds rates from BRIEF §2.3 on every boot (idempotent).

See [`../identity-service/README.md`](../identity-service/README.md) for the canonical folder layout.
