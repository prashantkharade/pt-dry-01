import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStore extends ChangeNotifier {
  AuthStore._();
  static final AuthStore instance = AuthStore._();

  static const _storage = FlutterSecureStorage();
  static const _kAccess = 'access_token';
  static const _kRefresh = 'refresh_token';
  static const _kUserId = 'user_id';
  static const _kCustomerId = 'customer_id';
  static const _kName = 'name';
  static const _kPhone = 'phone';

  String? _accessToken;
  String? _refreshToken;
  String? _userId;
  String? _customerId;
  String? _name;
  String? _phone;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  String? get userId => _userId;
  String? get customerId => _customerId;
  String? get name => _name;
  String? get phone => _phone;
  bool get isAuthenticated => _accessToken != null;

  Future<void> loadFromDisk() async {
    _accessToken = await _storage.read(key: _kAccess);
    _refreshToken = await _storage.read(key: _kRefresh);
    _userId = await _storage.read(key: _kUserId);
    _customerId = await _storage.read(key: _kCustomerId);
    _name = await _storage.read(key: _kName);
    _phone = await _storage.read(key: _kPhone);
    notifyListeners();
  }

  Future<void> saveLogin(Map<String, dynamic> payload) async {
    _accessToken = payload['AccessToken'] as String?;
    _refreshToken = payload['RefreshToken'] as String?;
    final user = (payload['User'] as Map?)?.cast<String, dynamic>();
    _userId = user?['id'] as String?;
    _name = user?['FirstName'] as String?;
    _phone = user?['Phone'] as String?;
    await _storage.write(key: _kAccess, value: _accessToken);
    await _storage.write(key: _kRefresh, value: _refreshToken);
    if (_userId != null) await _storage.write(key: _kUserId, value: _userId);
    if (_name != null) await _storage.write(key: _kName, value: _name);
    if (_phone != null) await _storage.write(key: _kPhone, value: _phone);
    notifyListeners();
  }

  Future<void> setCustomerId(String id) async {
    _customerId = id;
    await _storage.write(key: _kCustomerId, value: id);
    notifyListeners();
  }

  Future<void> clear() async {
    _accessToken = null;
    _refreshToken = null;
    _userId = null;
    _customerId = null;
    _name = null;
    _phone = null;
    await _storage.deleteAll();
    notifyListeners();
  }
}
