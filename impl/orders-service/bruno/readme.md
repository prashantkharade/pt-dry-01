# orders-service — Bruno Collection

API collection for the PTDRY **orders-service** (Express + TypeORM).

- Base URL: `http://localhost:4003`
- Route prefix: `/api/v1`
- Response envelope: `{ "Status", "Message", "HttpCode", "Data" }` — IDs live at `Data.id`.

## Setup

1. Open this folder in Bruno.
2. Select the **local** environment (`environments/local.bru`).
3. Set the required environment variables:
   - `authToken` — a Bearer JWT issued by the **identity-service** login endpoint. All
     orders routes require it (`Authorization: Bearer {{authToken}}`). The collection
     sends it automatically via `auth: inherit`.
   - `apiKey` — `orders-service-dev-key` (from `.env` `API_KEY_ORDERS_SERVICE`). Used for
     inter-service / client calls (`x-api-key`); not required by the user routes here.
   - `CUSTOMER_ID`, `ITEM_ID`, `DELIVERY_ADDRESS_ID` — valid UUIDs in your tenant.

## Run order (workflow)

The `orders/` folder is numbered to run as a workflow:

1. **Create Order** (`POST /orders`) — captures `ORDER_ID` into the environment.
2. **Search Orders** (`GET /orders`) — tenant-scoped search (`Status`, `CustomerId`, `Query`, paging).
3. **List My Orders** (`GET /orders/mine`) — owner-scoped, requires `CustomerId`.
4. **Get Order By Id** (`GET /orders/:id`) — uses captured `ORDER_ID`.
5. **Update Order Status** (`PATCH /orders/:id/status`) — moves the order along the
   status state machine (Booked → PickedUp → Received → InProcess → Ready → ... → Closed,
   or Cancelled / OnHold).

## Notes

- `ServiceTypeCode`: `DRY_CLEAN` | `LAUNDRY` | `PRESS_ONLY`
- `Channel`: `HomePickup` | `DropAtShop`
- `DeliveryType`: `HomeDelivery` | `CustomerPickup`
- `BilledTo`: `Customer` | `Vendor`
- `OrderStatus`: `Booked` | `PickedUp` | `Received` | `InProcess` | `Ready` |
  `OutForDelivery` | `Delivered` | `Closed` | `Cancelled` | `OnHold`
