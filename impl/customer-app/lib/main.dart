import 'package:flutter/material.dart';
import 'app/app.dart';
import 'core/api/api_client.dart';
import 'core/auth/auth_store.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://10.0.2.2:4001', // Android emulator → host loopback
  );
  const ordersBase = String.fromEnvironment(
    'ORDERS_BASE',
    defaultValue: 'http://10.0.2.2:4002',
  );
  const apiKey = String.fromEnvironment(
    'API_KEY',
    defaultValue: 'customer-app-dev-key',
  );

  ApiClient.configure(
    identityBase: apiBase,
    ordersBase: ordersBase,
    apiKey: apiKey,
  );
  await AuthStore.instance.loadFromDisk();

  runApp(const PtKharadeApp());
}
