import 'package:flutter/material.dart';
import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_store.dart';
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
  const apiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: 'dev-customer-app-key',
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

  runApp(const PtKharadeApp());
}
