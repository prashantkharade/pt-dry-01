# Customer App Implementation Guide (Flutter)

> Stack mandate (`../BRIEF.md` §3): **Flutter + Dart, single codebase for Android, iOS, web.**
>
> **Gap warning:** none of the reference repos ship a Flutter app. The
> nearest analogue is **`D:\Batterlicious\customer-app 2`** (.NET MAUI), which
> shares the *information architecture* (Dashboard → Cart → Schedule Delivery →
> Payment → My Orders) and *singleton state pattern* — port these to Flutter.
> Everything below maps the IA + flows from MAUI and dictates Flutter-idiomatic
> equivalents.

---

## 1. Project skeleton

```
pt_kharade_customer/
├── pubspec.yaml
├── analysis_options.yaml          ← lints: flutter_lints + custom rules
├── lib/
│   ├── main.dart                  ← runApp, ProviderScope, splash routing
│   ├── app/
│   │   ├── app.dart               ← MaterialApp.router + ThemeData
│   │   ├── theme/                 ← ThemeData light/dark + user-customisable tokens
│   │   ├── router/                ← go_router config (route guards by auth state)
│   │   └── localization/          ← l10n delegate (en + mr)
│   ├── features/
│   │   ├── auth/                  ← OTP login, signup, profile
│   │   ├── home/                  ← splash, dashboard
│   │   ├── catalog/               ← service catalog browse
│   │   ├── booking/               ← address → slot → items → preview
│   │   ├── checkout/              ← Razorpay / Zoho Pay
│   │   ├── orders/                ← list, detail, status tracking
│   │   ├── subscriptions/         ← plans, my subs
│   │   ├── profile/
│   │   └── settings/              ← language, theme
│   ├── core/
│   │   ├── api/                   ← Dio client + interceptors
│   │   ├── storage/               ← Hive boxes + secure storage
│   │   ├── sync/                  ← offline draft queue
│   │   ├── notifications/         ← FCM handlers
│   │   ├── analytics/             ← optional
│   │   └── widgets/               ← shared atoms (buttons, inputs, status badge)
│   └── shared/
│       ├── models/                ← freezed data classes
│       └── utils/
├── assets/
│   ├── images/
│   ├── translations/
│   │   ├── app_en.arb
│   │   └── app_mr.arb            ← Marathi
│   └── fonts/
└── integration_test/
```

---

## 2. Core dependencies (pubspec.yaml)

```yaml
dependencies:
  flutter: { sdk: flutter }
  flutter_localizations: { sdk: flutter }
  intl: ^0.19.0

  # state
  flutter_riverpod: ^2.6.0
  riverpod_annotation: ^2.6.0
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0

  # routing
  go_router: ^14.0.0

  # network
  dio: ^5.7.0
  retrofit: ^4.4.0
  pretty_dio_logger: ^1.4.0
  connectivity_plus: ^6.0.0

  # storage / offline
  hive: ^2.2.3
  hive_flutter: ^1.1.0
  flutter_secure_storage: ^9.2.2

  # ui
  google_fonts: ^6.2.0
  flutter_svg: ^2.0.10
  cached_network_image: ^3.4.0
  shimmer: ^3.0.0           # loading skeletons

  # auth / push
  firebase_core: ^3.6.0
  firebase_messaging: ^15.1.0

  # payments
  razorpay_flutter: ^1.3.7
  # Zoho Pay has no official Flutter SDK — use webview_flutter for hosted page

  webview_flutter: ^4.10.0

dev_dependencies:
  build_runner: ^2.4.0
  freezed: ^2.5.7
  json_serializable: ^6.8.0
  retrofit_generator: ^9.1.0
  riverpod_generator: ^2.6.0
  flutter_lints: ^5.0.0
  mocktail: ^1.0.4
  integration_test: { sdk: flutter }
```

---

## 3. State management — Riverpod

**Why Riverpod (over the MAUI singleton in `D:\Batterlicious\customer-app 2\Services\CartManager.cs`):** compile-time safe DI, testable, no globals.

Map MAUI singletons to Riverpod providers 1:1:

| MAUI (`Batterlicious\customer-app 2`)             | Flutter Riverpod                              |
|---------------------------------------------------|-----------------------------------------------|
| `Services/CartManager.cs` (singleton)             | `cartProvider` (`StateNotifierProvider<CartNotifier, CartState>`) |
| `Services/AddressManager.cs`                      | `addressesProvider`                           |
| `Services/OrderManager.cs`                        | `ordersProvider` + `orderDetailProvider(id)`  |
| `Services/SubscriptionManager.cs`                 | `subscriptionsProvider`                       |
| `Services/WalletRechargeManager.cs`               | `walletProvider`                              |

All providers cache + persist via Hive (see §6).

---

## 4. API client — Dio + Retrofit + auth interceptor

Map from MAUI's `Services/Implementation/ApiService.cs` and `OrderApiService.cs`, `PaymentApiService.cs`.

```dart
// lib/core/api/api_client.dart
@RestApi()
abstract class OrdersApi {
  factory OrdersApi(Dio dio) = _OrdersApi;

  @POST('/orders')
  Future<OrderDto> create(@Body() CreateOrderRequest body);

  @GET('/orders/me')
  Future<List<OrderDto>> myOrders(@Query('status') String? status);

  @GET('/orders/{id}')
  Future<OrderDto> get(@Path() String id);
}
```

```dart
// lib/core/api/dio_factory.dart
Dio buildDio(Ref ref) {
  final dio = Dio(BaseOptions(
    baseUrl: AppConfig.apiBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));

  dio.interceptors.addAll([
    AuthInterceptor(ref),     // adds Bearer; refresh on 401
    ApiKeyInterceptor(),      // x-api-key for non-user-bound endpoints
    LocaleInterceptor(ref),   // Accept-Language: en|mr
    pretty.PrettyDioLogger(requestBody: true, responseBody: true),
  ]);
  return dio;
}
```

`AuthInterceptor` mirrors `ApiService.cs` token refresh: on 401, hit `/auth/refresh` with the refresh token, replay the original request, otherwise log out.

---

## 5. Authentication flow (OTP login)

Source for OTP enums and login methods: `D:\Batterlicious\user-service\src\domain.types\users\user.enums.ts` (`OTPScope.Login`, `OTPChannel.SMS`, `UserLoginMethod.PhoneOtp`).

UX (matches BRIEF deliverable #13):
1. **Splash** → check secure-storage for refresh token → route to Home if valid, else Login.
2. **Login** — phone number entry (+91 prefix locked, 10 digits validated). On submit, POST `/auth/otp/send` `{ phone, channel: 'SMS', scope: 'Login' }`.
3. **OTP entry** — 6 digits, autofill from SMS on Android via `sms_autofill` package. POST `/auth/otp/verify` returns `{ accessToken, refreshToken, user }`.
4. **First-time profile** — if user has no name set, force a quick onboarding screen (name, email optional).
5. Tokens stored in **flutter_secure_storage**; never in SharedPreferences.

```dart
// Provider example
final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authApiProvider), ref.read(secureStorageProvider));
});
```

---

## 6. Offline support (BRIEF §2.5)

The customer app must allow **draft order creation offline** and **sync on reconnect**.

Strategy:
- **Hive boxes** for cached read models (`orders`, `catalog`, `addresses`, `subscriptions`).
- **Outgoing sync queue** (`outbox` box) holds `PendingOperation { id, op: 'order.create' | 'address.add' | ..., payload, createdAt, retries }`.
- `connectivity_plus` stream → when online, `SyncService` drains the outbox sequentially. On 4xx, surface a per-item error to the user; on 5xx/network, retry with backoff (1s → 2s → 5s → 30s).
- Optimistic UI: order created offline shows in My Orders with a `Draft` chip; turns green when synced.

Reference for the singleton-with-persisted-state pattern: `D:\Batterlicious\customer-app 2\Services\CartManager.cs` (uses MAUI Preferences) — replicate in Flutter using Hive in a `StateNotifier`.

---

## 7. Booking flow (BRIEF deliverable #13)

Mirror the MAUI page sequence in `D:\Batterlicious\customer-app 2\Views\`:

| MAUI page                           | Flutter page                                              |
|-------------------------------------|-----------------------------------------------------------|
| `WelcomePage.xaml`                  | `lib/features/auth/welcome_screen.dart`                   |
| `OTPVerificationPage.xaml`          | `lib/features/auth/otp_screen.dart`                       |
| `DashboardPage.xaml`                | `lib/features/home/home_screen.dart`                      |
| `ItemSelectionPage.xaml`            | `lib/features/catalog/item_selection_screen.dart`         |
| `CartPage.xaml`                     | `lib/features/booking/cart_screen.dart`                   |
| `ScheduleDeliveryPage.xaml`         | `lib/features/booking/slot_pickup_screen.dart`            |
| `ZohoPaymentPage.xaml`              | `lib/features/checkout/payment_webview_screen.dart` (Zoho) + `razorpay_flutter` native widget for Razorpay |
| `MyOrdersPage.xaml`                 | `lib/features/orders/orders_list_screen.dart`             |
| `OrderDetailsPage.xaml`             | `lib/features/orders/order_detail_screen.dart`            |
| `OrderHistoryDetailPage.xaml`       | `lib/features/orders/order_history_detail_screen.dart` — past order + Reorder |
| `TrackOrderPage.xaml`               | `lib/features/orders/track_screen.dart` — live status timeline |
| `ReviewPage.xaml`                   | `lib/features/orders/review_screen.dart` — rating + feedback after delivery |
| `ManageAddressesPage.xaml`          | `lib/features/profile/addresses_screen.dart`              |
| `AddressDetailPage.xaml`            | `lib/features/profile/address_edit_screen.dart` — captures Lat/Long via map |
| `MyAccountPage.xaml`, `ProfileDetailPage.xaml` | `lib/features/profile/profile_screen.dart` + `profile_edit_screen.dart` |
| `MySubscriptionsPage.xaml`          | `lib/features/subscriptions/list_screen.dart`             |
| `CreateSubscriptionPage.xaml`       | `lib/features/subscriptions/create_screen.dart` — day-of-week + slot binding |
| `SubscriptionDetailsPage.xaml`      | `lib/features/subscriptions/detail_screen.dart` — **Pause / Resume / Cancel** |
| `BLWalletPage.xaml`                 | `lib/features/wallet/wallet_screen.dart` — balance + top-up + transactions |
| `ContactUsPage.xaml`                | `lib/features/support/contact_screen.dart`                |
| `TermsPolicyPage.xaml`              | `lib/features/legal/terms_screen.dart` — renders CMS content |
| `ThemeModalPage.xaml`               | bottom-sheet in `lib/features/settings/theme_picker.dart` |

Full IA breakdown with reasoning is in [`06-extended-patterns.md`](06-extended-patterns.md) §15.

**Steps for a new order** (matches BRIEF §2.2):
1. Pick **service type** — Dry-clean / Laundry / Press-only.
2. Pick **items + quantities** (catalog seeded from `rates.seed.ts`).
3. Pick **collection mode** — Home Pickup *or* Drop at Shop. If pickup → choose address + slot.
4. Pick **delivery mode** — Home Delivery (₹40 surcharge by default) *or* pickup at shop.
5. Toggle **Express** (+25% surcharge).
6. **Price preview** — itemised, subtotal, surcharges, GST if enabled, total in `₹` formatted via `intl` (`NumberFormat.currency(locale: 'en_IN', symbol: '₹')`).
7. Choose **payment** — Razorpay (online) / Zoho Pay (online) / Cash or UPI on delivery.
8. Confirm → backend returns order id → push notification when status changes.

---

## 8. Payments

### 8.1 Razorpay (primary)
Plugin: `razorpay_flutter`. Flow (matches gateway docs):
1. Client calls backend `/payments/razorpay/order` → backend creates a Razorpay order, returns `{ id, amount, currency, key }`.
2. Client opens Razorpay sheet via `_razorpay.open(options)`.
3. On success event, send `{ razorpayPaymentId, razorpayOrderId, signature }` to backend `/payments/razorpay/verify` — backend verifies signature, transitions the payment state machine (see `01-backend.md` §12), publishes `payments.payment.captured`.

### 8.2 Zoho Pay (secondary)
No official Flutter SDK. Use `webview_flutter` with the hosted Zoho Pay page (the MAUI app does the same — `ZohoPaymentPage.xaml.cs`). Intercept the success/failure redirect URL; relay to backend for verification.

### 8.3 Cash / UPI on delivery
No client integration. Order is created with `paymentMethod: 'COD'`. Delivery person marks paid via admin portal at delivery time.

### 8.4 Subscriptions
Razorpay Subscriptions hosted page (open via WebView). On webhook `subscription.activated`, backend records sub on the user. App polls `GET /subscriptions/me` and shows status.

**Pause / resume UX** (lifted from Batterlicious — see [`06-extended-patterns.md`](06-extended-patterns.md) §1):
- Subscription detail screen exposes Pause / Resume / Cancel as primary actions.
- On pause: confirmation modal asks "for how many days?" (or "until I resume"). Calls `POST /subscriptions/:id/pause`. UI shows "Paused — Resume" chip until customer resumes.
- On resume: `POST /subscriptions/:id/resume`. Backend extends `EndDate` by `TotalPausedDays`.
- Day-of-week selector during create: 7-chip toggle row (Mo Tu We Th Fr Sa Su). At least one required.
- Split-payment display: subscription detail shows "Paid from wallet ₹X, paid online ₹Y" — feeds straight off `subscription.WalletPaidAmount` / `GatewayPaidAmount`.

### 8.5 Wallet
Wallet is real money / store credit (refunds, top-ups). Customer-app screen shows:
- Current balance (large)
- Top-up CTA → Razorpay micro-charge → on success, backend credits the wallet
- Transaction history (paged) — every row shows `BalanceBefore → BalanceAfter` snapshot, type chip, reference (linked order / subscription)

Reference: `D:\Batterlicious\customer-app 2\Views\BLWalletPage.xaml` + entities in [`06-extended-patterns.md`](06-extended-patterns.md) §6.

---

## 9. Notifications & status tracking

- **FCM** — Firebase Messaging plugin. On token refresh, POST to `/users/me/devices`. Backend's notifications-service (see `01-backend.md` §11) targets the device token for push.
- Status messages localised (en + mr).
- For **real-time tracking** (live status), use server-sent events or polling every 30s while the user is on the order detail screen — see SSE pattern referenced in deft-dexterous / Deft One Socket.IO docs.

Notification deep-links (open order detail on tap): handle `onMessageOpenedApp` and `getInitialMessage`, parse `data: { orderId }`, route to `/orders/:id` via go_router.

---

## 10. Theming (BRIEF §2.5)

User-configurable: background colour, border style, font family, font size, light/dark.

Implementation:
- `ThemeData` constructed from a `UserThemePrefs` model (Hive-persisted; also written to backend `user.preferences`).
- Background colour → `ColorScheme.surface`; border style → `OutlineInputBorder(borderRadius: ...)` injected via `inputDecorationTheme`; font family → `GoogleFonts.<font>().fontFamily`; font size scale → `MediaQuery.textScalerOf(context)` scaler.
- `/settings` page exposes sliders + a colour-picker (`flutter_colorpicker`).
- A `themeProvider` watches the prefs and re-emits a fresh `ThemeData` on change → MaterialApp rebuilds.

For Marathi text, the chosen font **must** support Devanagari — default to **Noto Sans Devanagari** via `google_fonts` when locale is `mr`.

---

## 11. Internationalisation (English + Marathi)

Use Flutter's standard `flutter_localizations` + ARB files.

```yaml
flutter:
  generate: true
  uses-material-design: true
```

```
assets/translations/
├── app_en.arb        ← { "ordersTitle": "Orders", "@ordersTitle": {...} }
└── app_mr.arb        ← { "ordersTitle": "ऑर्डर्स" }
```

`l10n.yaml` at project root configures the codegen (`flutter gen-l10n`).

Realistic Marathi sample strings (BRIEF §4):
- `welcomeBack` → "पुन्हा स्वागत आहे"
- `newOrder` → "नवीन ऑर्डर"
- `pickupTomorrow` → "उद्या पिकअप"
- `payNow` → "आता पैसे द्या"

`LocaleInterceptor` adds `Accept-Language: en` or `mr` to every API call so backend i18n templates pick the right SMS/email copy.

---

## 12. Performance

Port the recommendations from `D:\Batterlicious\customer-app 2\PERFORMANCE_OPTIMIZATIONS.md` to Flutter equivalents:

| MAUI recommendation                                   | Flutter equivalent                                                              |
|-------------------------------------------------------|---------------------------------------------------------------------------------|
| FFImageLoading (disk cache)                           | `cached_network_image` + `flutter_cache_manager` (30-day TTL)                   |
| `IMemoryCache` (5-min API cache)                      | Riverpod `keepAlive: true` + manual `Future.delayed` invalidation, or `dio_cache_interceptor` |
| `HttpClientFactory` (pooling)                         | Single `Dio` instance with `HttpClientAdapter` reused                           |
| Pagination (load 20, lazy-load rest)                  | `infinite_scroll_pagination` package                                            |
| `CollectionView` thresholds                           | `ListView.builder` + `itemExtent` when items are uniform                        |
| XAML compilation                                      | Flutter is AOT compiled; ensure `--release` for production                       |
| JSON optimisation                                     | `freezed` + `json_serializable` generated code; avoid runtime reflection         |
| `SemaphoreSlim` for concurrent downloads              | `pool: ^1.5.1` package (e.g. `Pool(5)` for max 5 concurrent network calls)       |

Add a **shimmer loading state** on every list (`shimmer` package) — BRIEF §4 calls out loading skeletons.

---

## 13. Testing

- **Unit (notifiers, services)** — `flutter_test` + `mocktail`.
- **Widget tests** — for screens with non-trivial conditional UI (order detail under different statuses).
- **Integration tests** — `integration_test/` — happy paths: login, place an order, pay with Razorpay test mode.
- **Golden tests** (optional) — order receipt screen.

---

## 14. Build & release

- **Android** — Play Store; signing config in `~/.android/key.properties`. Min SDK 23.
- **iOS** — App Store; provisioning via Apple Developer account.
- **Web** — `flutter build web --release` → static hosting (single VPS nginx).
- One `flavor`s set-up: `dev`, `staging`, `prod` with different `apiBaseUrl` and Firebase project.

---

## 15. Coding conventions

- **Dart style** — `dart format` + `flutter_lints` baseline + add `prefer_const_constructors`, `avoid_print`.
- **One feature per folder** under `lib/features/<feature>/` containing `screens/`, `widgets/`, `providers/`, `models/`.
- **No business logic in widgets** — call providers, render. Logic lives in `StateNotifier`s.
- **Models** are `freezed` data classes with `fromJson/toJson`. Never hand-roll.
- **No `print`** — use `logger` package (mirrors backend Logger ethos).
- **Async** — never swallow exceptions; surface to a `SnackBar` via a global `errorBus` provider (analogue of rean's toast store).
- **Colors / spacing** — use `Theme.of(context)` exclusively; never hardcode hex in widgets except in the theme file.

---

## 16. Quick checklist for a new screen

Adding "Order detail" screen — each step has a clear template:

1. `lib/features/orders/order_detail_screen.dart` — `ConsumerWidget` using `orderDetailProvider(orderId)`
2. `lib/features/orders/providers/order_detail_provider.dart` — `FutureProvider.family<OrderDto, String>`
3. `lib/features/orders/widgets/order_status_timeline.dart` — visual stepper (Booked → Picked-up → In-process → Ready → Delivered)
4. `lib/features/orders/widgets/order_items_list.dart`
5. `lib/features/orders/widgets/pay_button.dart` — gated by `order.paymentStatus`
6. `lib/app/router/router.dart` — register `/orders/:id`
7. `assets/translations/app_en.arb` + `app_mr.arb` — add labels
8. `integration_test/order_detail_test.dart` — smoke

---

*Customer app guide ends here. Continue with [`04-cross-cutting.md`](04-cross-cutting.md).*
