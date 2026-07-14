import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/auth/auth_store.dart';
import '../../core/api/api_client.dart';
import '../../core/settings/settings_store.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _route());
  }

  Future<void> _route() async {
    final auth = AuthStore.instance;
    if (!auth.isAuthenticated) {
      Navigator.of(context).pushReplacementNamed('/login');
      return;
    }
    try {
      // Touch /users/me to confirm the token is still valid, and use the
      // response to hydrate account-level personalization (language/theme).
      final user = await ApiClient.me();
      await SettingsStore.instance.hydrateFromServer(user);
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/home');
    } catch (_) {
      await auth.clear();
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const FlutterLogo(size: 64),
            const SizedBox(height: 16),
            Text(t.brandFull,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
