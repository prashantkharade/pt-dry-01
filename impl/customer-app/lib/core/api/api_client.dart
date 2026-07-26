import 'dart:convert';
import 'package:http/http.dart' as http;
import '../auth/auth_store.dart';

class ApiException implements Exception {
  final int? status;
  final String message;
  ApiException(this.message, {this.status});
  @override
  String toString() => 'ApiException($status, $message)';
}

class ApiClient {
  static late String identityBase;
  static late String catalogPricingBase;
  static late String ordersBase;
  static late String paymentsBase;
  static late String notificationsBase;
  static late String apiKey;

  static void configure({
    required String identityBase,
    required String catalogPricingBase,
    required String ordersBase,
    String? paymentsBase,
    String? notificationsBase,
    required String apiKey,
  }) {
    ApiClient.identityBase         = identityBase;
    ApiClient.catalogPricingBase   = catalogPricingBase;
    ApiClient.ordersBase           = ordersBase;
    ApiClient.paymentsBase         = paymentsBase ?? '';
    ApiClient.notificationsBase    = notificationsBase ?? '';
    ApiClient.apiKey               = apiKey;
  }

  static Future<Map<String, dynamic>> _call(
    String base,
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = false,
  }) async {
    final uri = Uri.parse('$base/api/v1$path').replace(
      queryParameters: query == null || query.isEmpty ? null : query,
    );
    final headers = <String, String>{
      'content-type': 'application/json',
      'x-api-key': apiKey,
    };
    if (auth) {
      final token = AuthStore.instance.accessToken;
      if (token != null) headers['authorization'] = 'Bearer $token';
    }
    final req = http.Request(method, uri);
    req.headers.addAll(headers);
    if (body != null) req.body = jsonEncode(body);
    final streamed = await req.send();
    final res = await http.Response.fromStream(streamed);
    final raw = res.body;
    final parsed = raw.isEmpty ? <String, dynamic>{} : jsonDecode(raw) as Map<String, dynamic>;
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return parsed;
    }
    throw ApiException(
      (parsed['Message'] as String?) ?? 'HTTP ${res.statusCode}',
      status: res.statusCode,
    );
  }

  static Future<dynamic> _get(String base, String path,
          {Map<String, String>? query, bool auth = false}) =>
      _call(base, 'GET', path, query: query, auth: auth).then((m) => m['Data']);
  static Future<dynamic> _post(String base, String path, Map<String, dynamic> body,
          {bool auth = false}) =>
      _call(base, 'POST', path, body: body, auth: auth).then((m) => m['Data']);
  static Future<dynamic> _patch(String base, String path, Map<String, dynamic> body,
          {bool auth = false}) =>
      _call(base, 'PATCH', path, body: body, auth: auth).then((m) => m['Data']);
  static Future<dynamic> _delete(String base, String path, {bool auth = false}) =>
      _call(base, 'DELETE', path, auth: auth).then((m) => m['Data']);

  // ---- Auth ----
  /// Returns the dev OTP when the backend runs in non-production mode
  /// (identity-service returns it in the response `DevOtp` field), else null.
  static Future<String?> otpSend(String phone) async {
    final r = await _post(identityBase, '/auth/otp/send', {'Phone': phone});
    return (r as Map?)?['DevOtp'] as String?;
  }

  static Future<Map<String, dynamic>> otpVerify(String phone, String otp) async {
    final res = await _post(identityBase, '/auth/otp/verify', {'Phone': phone, 'Otp': otp});
    return (res as Map).cast<String, dynamic>();
  }

  static Future<Map<String, dynamic>> me() async {
    final r = await _get(identityBase, '/users/me', auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  /// Persists the logged-in user's personalization to identity-service so it
  /// follows the account across devices. Both fields are optional — send only
  /// what changed. `PreferredLanguage` is a 2-letter code; `ThemePrefs` is a
  /// free-form JSON blob (we store mode/accent/background/textScale).
  static Future<void> updateMe({
    String? preferredLanguage,
    Map<String, dynamic>? themePrefs,
  }) async {
    await _patch(identityBase, '/users/me', {
      if (preferredLanguage != null) 'PreferredLanguage': preferredLanguage,
      if (themePrefs != null) 'ThemePrefs': themePrefs,
    }, auth: true);
  }

  /// The logged-in user's customer profile (identity-service links a customer
  /// to the user at OTP login). Returns null if none exists yet.
  static Future<Map<String, dynamic>?> customerMe() async {
    try {
      final r = await _get(identityBase, '/customers/me', auth: true);
      return (r as Map).cast<String, dynamic>();
    } on ApiException catch (e) {
      if (e.status == 404) return null;
      rethrow;
    }
  }

  // ---- Devices (push) ----
  /// Register or refresh this device against the signed-in user.
  ///
  /// Idempotent on (UserId, DeviceId): the backend upserts, so calling this
  /// on every launch and on every FCM token rotation is correct.
  static Future<void> registerDevice({
    required String deviceId,
    String? deviceName,
    String? platform,
    String? appVersion,
    String? osVersion,
    String? fcmToken,
  }) async {
    await _post(identityBase, '/devices', {
      'DeviceId': deviceId,
      if (deviceName != null) 'DeviceName': deviceName,
      if (platform != null) 'Platform': platform,
      if (appVersion != null) 'AppVersion': appVersion,
      if (osVersion != null) 'OsVersion': osVersion,
      // Omitted when permission was declined; the backend keeps any token it
      // already had rather than wiping it.
      if (fcmToken != null) 'FcmToken': fcmToken,
    }, auth: true);
  }

  /// This user's active devices — backs an "active sessions" screen.
  static Future<List<Map<String, dynamic>>> myDevices() async {
    final r = await _get(identityBase, '/devices', auth: true);
    return (r as List).cast<Map<String, dynamic>>();
  }

  static Future<void> revokeDevice(String id) =>
      _delete(identityBase, '/devices/$id', auth: true);

  // ---- Delivery slots ----
  /// Bookable slots for a date and leg. [direction] is 'Pickup' or 'Delivery'.
  ///
  /// Each entry carries real remaining capacity, so the picker can grey out a
  /// full slot rather than letting the customer pick it and fail at checkout.
  static Future<List<Map<String, dynamic>>> slotAvailability({
    required String date,
    required String direction,
  }) async {
    final r = await _get(ordersBase, '/delivery/slots/availability',
        query: {'Date': date, 'Direction': direction}, auth: true);
    return (r as List).cast<Map<String, dynamic>>();
  }

  /// Societies we serve — the customer picks theirs so we can resolve a zone
  /// (and therefore a delivery partner) and price the delivery leg.
  static Future<List<Map<String, dynamic>>> societies() async {
    final r = await _get(ordersBase, '/delivery/societies', auth: true);
    return (r as List).cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> deliveryChargeQuote({
    required String societyId,
    String? serviceTypeCode,
  }) async {
    final r = await _get(ordersBase, '/delivery/charge-quote', query: {
      'SocietyId': societyId,
      if (serviceTypeCode != null) 'ServiceTypeCode': serviceTypeCode,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  // ---- Catalog & pricing (catalog-pricing-service) ----
  static Future<List<Map<String, dynamic>>> services() async {
    final r = await _get(catalogPricingBase, '/catalog/service-types', auth: true);
    return ((r as Map)['Items'] as List).cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> items(String serviceCode) async {
    final r = await _get(catalogPricingBase, '/catalog/items',
        query: {'Service': serviceCode}, auth: true);
    return ((r as Map)['Items'] as List).cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> quote({
    required String serviceTypeCode,
    required String deliveryType,
    required bool isExpress,
    required bool isVendor,
    required List<Map<String, dynamic>> items,
  }) async {
    final r = await _post(catalogPricingBase, '/pricing/quote', {
      'ServiceTypeCode': serviceTypeCode,
      'DeliveryType'   : deliveryType,
      'IsExpress'      : isExpress,
      'IsVendor'       : isVendor,
      'Items'          : items,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  // ---- Orders ----
  /// Place an order.
  ///
  /// Laundry is two-leg — we collect, process, and return — so an order can
  /// book a seat in a pickup slot and a delivery slot. Which legs are
  /// REQUIRED follows from channel/deliveryType:
  ///   channel == 'HomePickup'       -> pickupSlotId + pickupDate
  ///   deliveryType == 'HomeDelivery'-> deliverySlotId + deliveryDate
  ///   either leg                    -> societyId (resolves the zone/partner)
  ///
  /// The backend reserves both seats inside the same transaction that writes
  /// the order, so a full slot rejects the whole order rather than half-booking
  /// it. A 409 here means "that slot just filled up" — re-fetch availability.
  static Future<Map<String, dynamic>> createOrder({
    required String customerId,
    required String serviceTypeCode,
    required String channel,
    required String deliveryType,
    required bool isExpress,
    required List<Map<String, dynamic>> items,
    String? societyId,
    String? pickupSlotId,
    String? pickupDate,
    String? deliverySlotId,
    String? deliveryDate,
    String? deliveryAddressId,
    String? notes,
  }) async {
    final r = await _post(ordersBase, '/orders', {
      'CustomerId'     : customerId,
      'ServiceTypeCode': serviceTypeCode,
      'Channel'        : channel,
      'DeliveryType'   : deliveryType,
      'IsExpress'      : isExpress,
      'Items'          : items,
      if (societyId != null) 'SocietyId': societyId,
      if (pickupSlotId != null) 'PickupSlotId': pickupSlotId,
      if (pickupDate != null) 'PickupDate': pickupDate,
      if (deliverySlotId != null) 'DeliverySlotId': deliverySlotId,
      if (deliveryDate != null) 'DeliveryDate': deliveryDate,
      if (deliveryAddressId != null) 'DeliveryAddressId': deliveryAddressId,
      if (notes != null) 'Notes': notes,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  static Future<List<Map<String, dynamic>>> myOrders(String customerId) async {
    final r = await _get(ordersBase, '/orders/mine',
        query: {'CustomerId': customerId}, auth: true);
    return ((r as Map)['Items'] as List).cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> orderDetail(String id) async {
    final r = await _get(ordersBase, '/orders/$id', auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  /// The customer-facing journey for an order: the fixed set of steps this
  /// order goes through, which are done, which is current, and the pickup/
  /// delivery leg detail. This is a curated projection — not the raw admin
  /// status history — so it never leaks internal enum names.
  static Future<Map<String, dynamic>> orderTracking(String id) async {
    final r = await _get(ordersBase, '/orders/$id/tracking', auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  /// A signed, session-less receipt URL for opening/downloading the PDF.
  static String receiptUrl(String orderId) => '$ordersBase/api/v1/receipts/$orderId';

  // ---- Payments ----
  /// Start paying.
  ///
  /// With [useWallet], store credit is spent first and only the remainder
  /// goes to the gateway. When the wallet covers the lot, the response has
  /// `FullyPaid: true` and no gateway step is needed at all.
  static Future<Map<String, dynamic>> initiatePayment({
    required String orderId,
    required String orderCode,
    required String customerId,
    required double amountInr,
    String provider = 'Razorpay',
    bool useWallet = false,
    // Passed so the "payment received" receipt has a recipient and language.
    // Without these, a payment made from the app confirms silently.
    String? customerPhone,
    String? customerLanguage,
  }) async {
    final r = await _post(paymentsBase, '/payments/initiate', {
      'OrderId'   : orderId,
      'OrderCode' : orderCode,
      'CustomerId': customerId,
      'AmountInr' : amountInr,
      'Provider'  : provider,
      'UseWallet' : useWallet,
      if (customerPhone != null) 'CustomerPhone': customerPhone,
      if (customerLanguage != null) 'CustomerLanguage': customerLanguage,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  /// Confirm after the gateway's checkout sheet returns.
  ///
  /// [signature] is the gateway's handshake and is mandatory: the backend
  /// verifies it and then re-fetches the payment from the provider, so
  /// nothing the app claims is taken at face value.
  static Future<Map<String, dynamic>> verifyPayment({
    required String paymentId,
    required String providerPaymentId,
    required String signature,
  }) async {
    final r = await _post(paymentsBase, '/payments/$paymentId/verify', {
      'ProviderPaymentId': providerPaymentId,
      'Signature'        : signature,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  /// Store-credit balance. `SpendableInr` exceeds `BalanceInr` for B2B
  /// vendors, whose credit limit is modelled as a negative floor.
  static Future<Map<String, dynamic>> walletBalance(String customerId) async {
    final r = await _get(paymentsBase, '/payments/wallet/$customerId', auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  static Future<List<Map<String, dynamic>>> walletHistory(String customerId) async {
    final r = await _get(paymentsBase, '/payments/wallet/$customerId/history', auth: true);
    return ((r as Map)['Items'] as List).cast<Map<String, dynamic>>();
  }
}
