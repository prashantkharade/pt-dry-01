import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/auth/auth_store.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthStore.instance;
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(t.appTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: t.settingsTooltip,
            onPressed: () => Navigator.of(context).pushNamed('/settings'),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: t.logout,
            onPressed: () async {
              await auth.clear();
              if (context.mounted) Navigator.of(context).pushReplacementNamed('/login');
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(t.greeting(auth.name ?? t.customer),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                  Text(auth.phone ?? '', style: TextStyle(color: Colors.grey.shade700)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(t.chooseService,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.6,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            children: [
              _ServiceCard(label: t.serviceDryClean, code: 'DRY_CLEAN', icon: Icons.dry_cleaning),
              _ServiceCard(label: t.serviceLaundry, code: 'LAUNDRY', icon: Icons.local_laundry_service),
              _ServiceCard(label: t.servicePressOnly, code: 'PRESS_ONLY', icon: Icons.iron),
              _ServiceCard(label: t.myOrders, code: 'orders', icon: Icons.receipt_long),
            ],
          ),
        ],
      ),
    );
  }
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({required this.label, required this.code, required this.icon});
  final String label;
  final String code;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        if (code == 'orders') {
          Navigator.of(context).pushNamed('/orders');
        } else {
          Navigator.of(context).pushNamed('/booking', arguments: code);
        }
      },
      borderRadius: BorderRadius.circular(12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 32, color: Theme.of(context).colorScheme.primary),
              const Spacer(),
              Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}
