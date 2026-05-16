import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';

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
    final code = _ctrl.text.trim();
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit code');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      final result = await ApiClient.otpVerify(_phone!, code);
      await AuthStore.instance.saveLogin(result);
      // First-time customer auto-provision returns a customerId via /users/me? No —
      // the API doesn't expose customerId yet; the orders/me endpoint accepts it as a query.
      // For the slice we treat the userId as a proxy and look up customer via the
      // identity endpoint at booking time. Save phone for fallback display.
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (_) => false);
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Verification failed');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify OTP')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 32),
            Text('Enter the 6-digit OTP sent to ${_phone ?? ''}',
                style: const TextStyle(fontSize: 16)),
            const SizedBox(height: 8),
            Text('In development, check the identity-service logs for the OTP value.',
                style: TextStyle(color: Colors.grey.shade700, fontSize: 12)),
            const SizedBox(height: 24),
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.number,
              maxLength: 6,
              decoration: const InputDecoration(labelText: 'OTP'),
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
                  : const Text('Verify & continue'),
            ),
          ],
        ),
      ),
    );
  }
}
