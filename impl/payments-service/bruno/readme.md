# payments-service — Bruno collection

API collection for the PTDRY **payments-service** (Express + TypeORM, port **4004**,
prefix `/api/v1`). Integrates Razorpay and Zohopay.

## Setup
1. Open this `bruno/` folder as a collection in [Bruno](https://www.usebruno.com/).
2. Select the **local** environment (`environments/local.bru`).
3. Make sure the service is running on `http://localhost:4004`.

## Environment variables
| Var | Purpose |
| --- | --- |
| `baseUrl` | Base URL, default `http://localhost:4004` |
| `apiKey` | Inter-service key (`API_KEY_PAYMENTS_SERVICE`) — default `payments-service-dev-key` |
| `authToken` | Bearer JWT for user/tenant routes — paste a valid token here |
| `razorpayWebhookSignature` | Value sent as `x-razorpay-signature` |
| `zohopayWebhookSignature` | Value sent as `x-zohopay-signature` |
| `PAYMENT_ID` | Captured automatically from the initiate/cash responses (`Data.id`) |
| `ORDER_ID` | Order UUID used in the payment workflow |
| `ORDER_CODE` | Human-readable order code |

## Run order
### payments (Bearer auth via collection `auth: inherit`)
1. **Initiate Payment** — `POST /payments/initiate` — creates a provider order + local Payment row; stores `PAYMENT_ID`.
2. **Mark Cash/UPI Payment** — `POST /payments/cash` — records a cash/UPI payment (immediately captured).
3. **List Payments For Order** — `GET /payments/order/:orderId` — lists payments for `ORDER_ID`.

### webhooks (public — no JWT; provider signature header)
1. **Razorpay Webhook** — `POST /webhooks/razorpay` — sample `payment.captured` event with `x-razorpay-signature`.
2. **Zohopay Webhook** — `POST /webhooks/zohopay` — sample `payment.captured` event with `x-zohopay-signature`.

> Webhook routes are public (providers POST directly). Signature verification is handled
> by each provider helper; in dev the placeholder signature values are accepted/ignored.
