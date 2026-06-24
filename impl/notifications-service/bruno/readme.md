# notifications-service — Bruno collection

API collection for the PTDRY **notifications-service** (Express + TypeORM).

- Base URL: `http://localhost:4005`
- API prefix: `/api/v1`
- Standard response envelope: `{ Status, Message, HttpCode, Data, ... }` — created IDs live at `Data.id`.

## Setup

1. Open this folder in Bruno.
2. Select the **local** environment (`environments/local.bru`).
3. Fill in the env vars:
   - `baseUrl` — defaults to `http://localhost:4005`.
   - `apiKey` — dev key `notifications-service-dev-key` (from `.env` `API_KEY_NOTIFICATIONS_SERVICE`). Used for inter-service `x-api-key` calls if needed.
   - `authToken` — a valid Bearer JWT for a user with role `SystemAdmin` or `Receptionist` (required by `POST /notifications/send`). Obtain it from the identity-service login.
   - `NOTIFICATION_ID` — auto-populated by the send request's `vars:post-response`.

## Run order (workflow)

1. **Service / Service Info** — `GET /api/v1/` (anonymous health/info check).
2. **Notifications / Send Notification** — `POST /api/v1/notifications/send` (Bearer). Dispatches a notification through the requested channel, persists the log, and captures the log id into `NOTIFICATION_ID`.

## Auth

- `GET /api/v1/` is anonymous (`auth: none`).
- `POST /api/v1/notifications/send` requires `Authorization: Bearer {{authToken}}` (inherited from `collection.bru`). Allowed roles: `SystemAdmin`, `Receptionist`.

## Notes

This service currently exposes a single functional endpoint (`/notifications/send`) plus the root service-info route. Notification templates exist in the data model and are rendered internally by the service; there are no public template CRUD endpoints.
