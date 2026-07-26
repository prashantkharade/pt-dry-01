import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';
import '../../core/ui/ui_kit.dart';

/// Home.
///
/// Rebuilt from a stock AppBar + grid into a branded, at-a-glance landing:
/// a gradient header that greets the customer, their most recent in-progress
/// order surfaced as a live card (the thing they open the app to check), then
/// the service actions. Everything reads from the theme, so an accent change
/// re-tints the header and the icons together.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Future<List<Map<String, dynamic>>>? _activeOrders;

  @override
  void initState() {
    super.initState();
    _activeOrders = _loadActive();
  }

  /// The customer's not-yet-finished orders, newest first. Drives the "track
  /// your order" card — the reason a laundry customer opens the app at all.
  Future<List<Map<String, dynamic>>> _loadActive() async {
    final id = await AuthStore.instance.ensureCustomerId();
    if (id == null) return [];
    final all = await ApiClient.myOrders(id);
    const done = {'Delivered', 'Closed', 'Cancelled'};
    return all.where((o) => !done.contains(o['Status'])).toList();
  }

  Future<void> _refresh() async {
    setState(() => _activeOrders = _loadActive());
    await _activeOrders;
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthStore.instance;
    final t = AppLocalizations.of(context);
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: CustomScrollView(
          slivers: [
            // Header greeting + quick actions, in the brand gradient.
            SliverToBoxAdapter(
              child: BrandHeader(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                t.greeting(auth.name ?? t.customer),
                                style: tt.headlineSmall?.copyWith(
                                  color: Colors.white, fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 2),
                              Text('PT Kharade · Drycleaners & Laundry',
                                  style: tt.bodySmall?.copyWith(color: Colors.white.withValues(alpha: 0.85))),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.settings_outlined, color: Colors.white),
                          tooltip: t.settingsTooltip,
                          onPressed: () => Navigator.of(context).pushNamed('/settings'),
                        ),
                        IconButton(
                          icon: const Icon(Icons.logout, color: Colors.white),
                          tooltip: t.logout,
                          onPressed: () async {
                            await auth.clear();
                            if (context.mounted) Navigator.of(context).pushReplacementNamed('/login');
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // The active-order card. Pulled up over the header's rounded edge
            // so it reads as the primary content, not an afterthought.
            SliverToBoxAdapter(
              child: Transform.translate(
                offset: const Offset(0, -16),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: FutureBuilder<List<Map<String, dynamic>>>(
                    future: _activeOrders,
                    builder: (context, snap) {
                      if (snap.connectionState != ConnectionState.done) {
                        return _ActiveOrderSkeleton();
                      }
                      final active = snap.data ?? [];
                      if (active.isEmpty) return const SizedBox.shrink();
                      return _ActiveOrderCard(order: active.first, extra: active.length - 1);
                    },
                  ),
                ),
              ),
            ),

            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
              sliver: SliverToBoxAdapter(
                child: Text(t.chooseService,
                    style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              ),
            ),

            // Service grid — each tile a distinct accent so they don't read as
            // one grey wall.
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.05,
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 14,
                ),
                delegate: SliverChildListDelegate([
                  _ServiceTile(
                    label: t.serviceDryClean, code: 'DRY_CLEAN',
                    icon: Icons.dry_cleaning, tint: const Color(0xFF2563EB),
                    subtitle: 'Suits, sarees, delicates'),
                  _ServiceTile(
                    label: t.serviceLaundry, code: 'LAUNDRY',
                    icon: Icons.local_laundry_service, tint: const Color(0xFF059669),
                    subtitle: 'Wash & fold, per kg'),
                  _ServiceTile(
                    label: t.servicePressOnly, code: 'PRESS_ONLY',
                    icon: Icons.iron, tint: const Color(0xFFD97706),
                    subtitle: 'Crisp, ready to wear'),
                  _ServiceTile(
                    label: t.myOrders, code: 'orders',
                    icon: Icons.receipt_long_outlined, tint: const Color(0xFF7C3AED),
                    subtitle: 'History & receipts'),
                ]),
              ),
            ),
          ],
        ),
      ),
      // Primary action always in reach, even after scrolling the grid.
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context).pushNamed('/booking', arguments: 'DRY_CLEAN'),
        icon: const Icon(Icons.add),
        label: Text(t.newOrder),
        backgroundColor: cs.primary,
        foregroundColor: cs.onPrimary,
      ),
    );
  }
}

/// The headline card: the customer's current order and where it is right now,
/// tappable straight into live tracking.
class _ActiveOrderCard extends StatelessWidget {
  const _ActiveOrderCard({required this.order, required this.extra});
  final Map<String, dynamic> order;
  final int extra; // how many OTHER active orders exist

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    final status = '${order['Status']}';

    return TappableCard(
      onTap: () => Navigator.of(context).pushNamed('/track/${order['id']}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.local_shipping_outlined, size: 18, color: cs.primary),
              const SizedBox(width: 6),
              Text('Your order', style: tt.labelLarge?.copyWith(color: cs.onSurfaceVariant)),
              const Spacer(),
              StatusChip(status: status),
            ],
          ),
          const SizedBox(height: 12),
          Text('${order['OrderCode']}', style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text('${order['ServiceTypeCode']} · ${inr(order['TotalInr'])}',
              style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant)),
          const SizedBox(height: 12),
          Row(
            children: [
              Text('Track order', style: tt.labelLarge?.copyWith(color: cs.primary, fontWeight: FontWeight.w600)),
              Icon(Icons.arrow_forward, size: 16, color: cs.primary),
              const Spacer(),
              if (extra > 0)
                Text('+$extra more', style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActiveOrderSkeleton extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: cs.surfaceContainerHighest.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  const _ServiceTile({
    required this.label, required this.code, required this.icon,
    required this.tint, required this.subtitle,
  });
  final String label;
  final String code;
  final IconData icon;
  final Color tint;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    return TappableCard(
      onTap: () {
        if (code == 'orders') {
          Navigator.of(context).pushNamed('/orders');
        } else {
          Navigator.of(context).pushNamed('/booking', arguments: code);
        }
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(
              color: tint.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: tint, size: 24),
          ),
          const Spacer(),
          Text(label, style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(subtitle, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
