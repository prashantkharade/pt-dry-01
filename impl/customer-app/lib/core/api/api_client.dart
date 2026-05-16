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
  static late String ordersBase;
  static late String apiKey;

  static void configure({
    required String identityBase,
    required String ordersBase,
    required String apiKey,
  }) {
    ApiClient.identityBase = identityBase;
    ApiClient.ordersBase = ordersBase;
    ApiClient.apiKey = apiKey;
  }

  static Future<Map<String, dynamic>> _call(
    String base,
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
    bool auth = false,
  }) async {
    final uri = Uri.parse('$base$path').replace(
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

  // ---- Auth ----
  static Future<void> otpSend(String phone) => _post(identityBase, '/auth/otp/send', {'phone': phone});
  static Future<Map<String, dynamic>> otpVerify(String phone, String otp) async {
    final res = await _post(identityBase, '/auth/otp/verify', {'phone': phone, 'otp': otp});
    return (res as Map).cast<String, dynamic>();
  }

  static Future<Map<String, dynamic>> me() async {
    final r = await _get(identityBase, '/users/me', auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  // ---- Catalog & pricing ----
  static Future<List<Map<String, dynamic>>> services() async {
    final r = await _get(ordersBase, '/catalog/service-types', auth: true);
    return ((r as Map)['items'] as List).cast<Map<String, dynamic>>();
  }

  static Future<List<Map<String, dynamic>>> items(String serviceCode) async {
    final r = await _get(ordersBase, '/catalog/items', query: {'service': serviceCode}, auth: true);
    return ((r as Map)['items'] as List).cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> quote({
    required String serviceTypeCode,
    required String deliveryType,
    required bool isExpress,
    required List<Map<String, dynamic>> items,
  }) async {
    final r = await _post(ordersBase, '/pricing/quote', {
      'serviceTypeCode': serviceTypeCode,
      'deliveryType': deliveryType,
      'isExpress': isExpress,
      'items': items,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  // ---- Orders ----
  static Future<Map<String, dynamic>> createOrder({
    required String customerId,
    required String serviceTypeCode,
    required String channel,
    required String deliveryType,
    required bool isExpress,
    required List<Map<String, dynamic>> items,
    String? notes,
  }) async {
    final r = await _post(ordersBase, '/orders', {
      'customerId': customerId,
      'serviceTypeCode': serviceTypeCode,
      'channel': channel,
      'deliveryType': deliveryType,
      'isExpress': isExpress,
      'items': items,
      if (notes != null) 'notes': notes,
    }, auth: true);
    return (r as Map).cast<String, dynamic>();
  }

  static Future<List<Map<String, dynamic>>> myOrders(String customerId) async {
    final r = await _get(ordersBase, '/orders/me', query: {'customerId': customerId}, auth: true);
    return ((r as Map)['items'] as List).cast<Map<String, dynamic>>();
  }

  static Future<Map<String, dynamic>> orderDetail(String id) async {
    final r = await _get(ordersBase, '/orders/$id', auth: true);
    return (r as Map).cast<String, dynamic>();
  }
}

