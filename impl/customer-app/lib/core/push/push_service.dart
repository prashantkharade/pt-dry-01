import 'dart:async';
import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';

/// Push notifications.
///
/// The contract with the backend is deliberately simple: this class owns
/// getting a token and telling identity-service about it. identity-service
/// owns which user that token belongs to, and notifications-service decides
/// what to send. Nothing here knows about order status.
///
/// Two things it has to get right:
///
///  * **Token rotation.** FCM reissues tokens (reinstall, restore, cache
///    clear). `onTokenRefresh` re-registers, otherwise a customer silently
///    stops receiving notifications and nothing looks broken.
///  * **Registering only when signed in.** A token registered before login
///    belongs to nobody. [register] is called after auth, and again on
///    refresh — but only when a session exists.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  static const _deviceIdKey = 'ptk_device_id';

  FirebaseMessaging? _messaging;
  StreamSubscription<String>? _refreshSub;
  bool _available = false;

  /// Whether push is usable. False when Firebase isn't configured for this
  /// build — the app must stay fully functional without it.
  bool get isAvailable => _available;

  /// Foreground messages, for showing an in-app banner.
  final StreamController<RemoteMessage> onMessage =
      StreamController<RemoteMessage>.broadcast();

  /// Taps on a notification that opened the app — used for deep links.
  final StreamController<RemoteMessage> onOpened =
      StreamController<RemoteMessage>.broadcast();

  /// Bring Firebase up. Safe to call when Firebase isn't configured: it
  /// disables push rather than crashing the app on launch.
  Future<void> init() async {
    try {
      await Firebase.initializeApp();
      _messaging = FirebaseMessaging.instance;
      _available = true;
    } catch (e) {
      // No google-services.json / GoogleService-Info.plist in this build.
      debugPrint('[push] Firebase unavailable, push disabled: $e');
      _available = false;
      return;
    }

    FirebaseMessaging.onMessage.listen(onMessage.add);
    FirebaseMessaging.onMessageOpenedApp.listen(onOpened.add);

    // The notification that cold-started the app isn't delivered by the
    // stream above — it has to be fetched explicitly.
    final initial = await _messaging!.getInitialMessage();
    if (initial != null) onOpened.add(initial);

    // Re-register on rotation. Without this the backend keeps pushing to a
    // token FCM has already retired.
    _refreshSub = _messaging!.onTokenRefresh.listen((token) {
      debugPrint('[push] token rotated, re-registering');
      _registerToken(token);
    });
  }

  /// Ask for permission. iOS shows the system prompt; Android 13+ shows the
  /// runtime POST_NOTIFICATIONS prompt.
  ///
  /// Returns false when the user declines — a normal outcome, not an error.
  Future<bool> requestPermission() async {
    if (!_available) return false;
    final settings = await _messaging!.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Register this device against the signed-in user.
  ///
  /// Call AFTER login. Idempotent on the backend: it upserts on
  /// (UserId, DeviceId), so calling it on every launch is correct and cheap.
  Future<void> register() async {
    if (!_available) return;
    final granted = await requestPermission();
    if (!granted) {
      debugPrint('[push] permission not granted — registering device without a token');
      // Still register: it gives the user an "active sessions" entry, and a
      // later permission grant only has to add the token.
      await _registerToken(null);
      return;
    }
    final token = await _messaging!.getToken();
    await _registerToken(token);
  }

  Future<void> _registerToken(String? token) async {
    try {
      final info = await _deviceInfo();
      await ApiClient.registerDevice(
        deviceId: info.id,
        deviceName: info.name,
        platform: info.platform,
        osVersion: info.osVersion,
        fcmToken: token,
      );
      debugPrint('[push] device registered (token: ${token == null ? 'none' : 'present'})');
    } catch (e) {
      // Never let this break the app. Push is a courtesy; the next launch
      // retries, and the order flow does not depend on it.
      debugPrint('[push] device registration failed: $e');
    }
  }

  /// Stop pushing to this device. Called on sign-out so the next person to
  /// use the phone doesn't receive the previous user's notifications.
  Future<void> unregister() async {
    if (!_available) return;
    try {
      await _messaging!.deleteToken();
    } catch (e) {
      debugPrint('[push] deleteToken failed: $e');
    }
  }

  Future<void> dispose() async {
    await _refreshSub?.cancel();
    await onMessage.close();
    await onOpened.close();
  }

  /// A stable per-install id, plus labels for the "active sessions" list.
  ///
  /// The id is generated once and persisted rather than taken from hardware:
  /// Android IDs change on factory reset and iOS vendor IDs change when the
  /// last app from a vendor is uninstalled, and both are privacy-sensitive.
  /// All we need is something stable for this install.
  Future<_DeviceInfo> _deviceInfo() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_deviceIdKey);
    if (id == null) {
      id = 'dev_${DateTime.now().microsecondsSinceEpoch}_${identityHashCode(this)}';
      await prefs.setString(_deviceIdKey, id);
    }

    final plugin = DeviceInfoPlugin();
    if (kIsWeb) {
      final web = await plugin.webBrowserInfo;
      return _DeviceInfo(id, web.browserName.name, 'Web', web.appVersion ?? '');
    }
    if (Platform.isAndroid) {
      final a = await plugin.androidInfo;
      return _DeviceInfo(id, '${a.manufacturer} ${a.model}', 'Android', a.version.release);
    }
    if (Platform.isIOS) {
      final i = await plugin.iosInfo;
      return _DeviceInfo(id, i.utsname.machine, 'iOS', i.systemVersion);
    }
    return _DeviceInfo(id, 'Unknown', 'Web', '');
  }
}

class _DeviceInfo {
  final String id;
  final String name;
  final String platform;
  final String osVersion;
  const _DeviceInfo(this.id, this.name, this.platform, this.osVersion);
}
