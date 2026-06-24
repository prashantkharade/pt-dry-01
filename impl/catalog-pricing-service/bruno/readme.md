# catalog-pricing-service — Bruno collection

API collection for the PTDRY catalog-pricing-service (Express + TypeORM).

- Base URL: `http://localhost:4002`
- API prefix: `/api/v1`
- Auth: every endpoint requires a Bearer JWT issued by the **identity-service**
  (`Authorization: Bearer {{authToken}}`). There is **no login endpoint** in this
  service, so you must obtain `authToken` from identity-service first and paste it
  into the environment. The collection sends it automatically via `auth: inherit`.
- This service has no `x-api-key` protected routes; `apiKey` is provided in the
  environment only as a convenience placeholder (value from
  `API_KEY_CATALOG_PRICING_SERVICE`).

## Environment variables (`environments/local.bru`)
| Var            | Purpose                                                        |
|----------------|----------------------------------------------------------------|
| `baseUrl`      | Service base URL (`http://localhost:4002`)                     |
| `apiKey`       | Dev API key placeholder                                        |
| `authToken`    | Bearer access token from identity-service (set manually)       |
| `ITEM_ID`      | Captured from **List Items** response, reused in later calls   |
| `RATE_CARD_ID` | Captured from **Create Rate Card** response                    |

## Run order
1. Set `authToken` (login against identity-service, copy the access token).
2. **catalog / List Service Types** — `GET /catalog/service-types`
3. **catalog / List Categories** — `GET /catalog/categories`
4. **catalog / List Items** — `GET /catalog/items` (captures `ITEM_ID`)
5. **catalog / Get Item By Id** — `GET /catalog/items/{{ITEM_ID}}`
6. **rate-cards / Create Rate Card** — `POST /rate-cards` (captures `RATE_CARD_ID`, requires `SystemAdmin` role)
7. **rate-cards / List Rate Cards** — `GET /rate-cards`
8. **pricing / List Surcharges** — `GET /pricing/surcharges`
9. **pricing / Compute Quote** — `POST /pricing/quote` (uses `ITEM_ID`)

> Note: `POST /rate-cards` requires the token to carry the `SystemAdmin` role.
