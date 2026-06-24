# identity-service — Bruno collection

API collection for the PTDRY **identity-service** (Express + TypeORM).

- Base URL: `http://localhost:4001`
- API prefix: `/api/v1`
- Auth: most routes need `Authorization: Bearer {{authToken}}` (set via collection-level inherited auth). The OTP + login routes are anonymous.

## Environment

Select the **local** environment. Variables:

| Var | Purpose |
|-----|---------|
| `baseUrl` | `http://localhost:4001` |
| `apiKey` | dev key for inter-service calls (`customer-app-dev-key`) |
| `authToken` | Bearer token — auto-set by login / verify-otp |
| `USER_ID` | captured user id for `GET /users/:id` |
| `CUSTOMER_ID` | captured customer id for get/update |

## Run order

1. **auth** — run `Login (Password)` (or `Verify OTP`) first. It captures `authToken` into the environment, which the collection-level bearer auth then uses for every other request.
   - `Send OTP` → `Verify OTP` is the phone-based alternative (Verify OTP also sets `authToken`).
   - `Logout` requires a valid token.
2. **users** — `Get Me`, `Update Me`, `Get My Lookup`, `Search Users` (SystemAdmin), `Get User By Id` (uses `USER_ID`).
3. **customers** — `Create Customer` (captures `CUSTOMER_ID`) → `Get Customer By Id` → `Search Customers` → `Update Customer` → `Get Customer Internal`.
4. **tenants** — `Get Current Tenant`, `List Branches`.

> Note: phone numbers use the `+91XXXXXXXXXX` format required by the validators.
