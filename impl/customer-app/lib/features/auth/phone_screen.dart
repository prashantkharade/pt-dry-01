import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';

// DEV ONLY: when true, skip the OTP entry screen by auto-verifying with the
// DevOtp the backend returns in non-production. Flip to false (or override at
// build time with --dart-define=BYPASS_OTP=false) to restore the real flow.
const bool _bypassOtp =
    bool.fromEnvironment('BYPASS_OTP', defaultValue: true);

class PhoneScreen extends StatefulWidget {
  const PhoneScreen({super.key});
  @override
  State<PhoneScreen> createState() => _PhoneScreenState();
}

class _PhoneScreenState extends State<PhoneScreen> {
  final _ctrl = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _send() async {
    setState(() { _loading = true; _error = null; });
    final raw = _ctrl.text.trim();
    final phone = raw.startsWith('+91') ? raw : '+91$raw';
    if (!RegExp(r'^\+91[6-9]\d{9}$').hasMatch(phone)) {
      setState(() { _loading = false; _error = 'Enter a 10-digit Indian mobile number'; });
      return;
    }
    try {
      final devOtp = await ApiClient.otpSend(phone);
      if (!mounted) return;
      // DEV BYPASS: backend returns the OTP in non-production — auto-verify and
      // go straight to home, skipping the OTP entry screen.
      if (_bypassOtp && devOtp != null) {
        final result = await ApiClient.otpVerify(phone, devOtp);
        await AuthStore.instance.saveLogin(result);
        if (!mounted) return;
        Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
        return;
      }
      Navigator.of(context).pushNamed('/otp', arguments: phone);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Failed to send OTP');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            const Text('Welcome to PT Kharade',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text('Sign in to book pickup, track orders & pay.',
                style: TextStyle(color: Colors.grey.shade700)),
            const SizedBox(height: 32),
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(
                labelText: 'Mobile number',
                prefixText: '+91  ',
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _loading ? null : _send,
              child: _loading
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Send OTP'),
            ),
          ],
        ),
      ),
    );
  }
}
