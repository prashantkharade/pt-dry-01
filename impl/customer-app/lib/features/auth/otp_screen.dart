import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';
import '../../core/settings/settings_store.dart';

class OtpScreen extends StatefulWidget {
  const OtpScreen({super.key});
  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _ctrl = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _phone;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _phone ??= ModalRoute.of(context)?.settings.arguments as String?;
  }

  Future<void> _verify() async {
    final t = AppLocalizations.of(context);
    final code = _ctrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = t.enter6Digit);
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final result = await ApiClient.otpVerify(_phone!, code);
      await AuthStore.instance.saveLogin(result);
      // Resolve the linked customer profile (created at OTP login) so ordering
      // and the orders list work without a manual admin-portal step.
      await AuthStore.instance.ensureCustomerId();
      // Pull account-level personalization (language/theme) after login.
      try {
        final user = await ApiClient.me();
        await SettingsStore.instance.hydrateFromServer(user);
      } catch (_) {/* best-effort */}
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : t.verificationFailed);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.verifyOtp)),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            Text(t.otpSentTo(_phone ?? ''),
                style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text(t.otpDevHint,
                style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
            const SizedBox(height: 24),
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: InputDecoration(labelText: t.otpLabel),
              style: const TextStyle(fontSize: 24, letterSpacing: 8),
              textAlign: TextAlign.center,
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading ? null : _verify,
              child: _loading
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : Text(t.verifyContinue),
            ),
          ],
        ),
      ),
    );
  }
}
