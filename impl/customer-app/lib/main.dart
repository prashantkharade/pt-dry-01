import 'dart:async';

import 'package:flutter/material.dart';
import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_store.dart';
import 'core/push/push_service.dart';
import 'core/settings/settings_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Android emulator → host loopback is 10.0.2.2. iOS sim / web / desktop use
  // localhost. Override at build time with --dart-define if testing remotely.
  const identityBase = String.fromEnvironment(
    'IDENTITY_BASE',
    defaultValue: 'http://10.0.2.2:4001',
  );
  const catalogPricingBase = String.fromEnvironment(
    'CATALOG_PRICING_BASE',
    defaultValue: 'http://10.0.2.2:4002',
  );
  const ordersBase = String.fromEnvironment(
    'ORDERS_BASE',
    defaultValue: 'http://10.0.2.2:4003',
  );
  const paymentsBase = String.fromEnvironment(
    'PAYMENTS_BASE',
    defaultValue: 'http://10.0.2.2:4004',
  );
  const notificationsBase = String.fromEnvironment(
    'NOTIFICATIONS_BASE',
    defaultValue: 'http://10.0.2.2:4005',
  );
  // Must match API_KEY_CUSTOMER_APP in the services' env, or every request is
  // rejected with 401 — the backend validates this key on every route.
  // Convention is <client>-dev-key for local development.
  const apiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: 'customer-app-dev-key',
  );

  ApiClient.configure(
    identityBase       : identityBase,
    catalogPricingBase : catalogPricingBase,
    ordersBase         : ordersBase,
    paymentsBase       : paymentsBase,
    notificationsBase  : notificationsBase,
    apiKey             : apiKey,
  );
  await SettingsStore.instance.loadFromDisk();
  await AuthStore.instance.loadFromDisk();

  // Bring push up. No-ops when Firebase isn't configured for this build, so
  // the app stays fully usable without google-services.json.
  await PushService.instance.init();
  // Already signed in from a previous run: refresh the device registration so
  // a token that rotated while the app was closed is picked up.
  if (AuthStore.instance.isAuthenticated) {
    unawaited(PushService.instance.register());
  }

  runApp(const PtKharadeApp());
}
