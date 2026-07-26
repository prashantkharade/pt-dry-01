import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';
import '../../core/ui/ui_kit.dart';

/// Orders list.
///
/// Was a bare FutureBuilder of ListTiles with the status printed as raw text.
/// Now: status chips, pull-to-refresh, a proper empty state, and a calm
/// loading placeholder instead of a spinner on a blank screen.
class OrdersListScreen extends StatefulWidget {
  const OrdersListScreen({super.key});
  @override
  State<OrdersListScreen> createState() => _OrdersListScreenState();
}

class _OrdersListScreenState extends State<OrdersListScreen> {
  late Future<List<Map<String, dynamic>>> _f;

  @override
  void initState() {
    super.initState();
    _f = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final id = await AuthStore.instance.ensureCustomerId();
    if (id == null) return [];
    return ApiClient.myOrders(id);
  }

  Future<void> _refresh() async {
    setState(() => _f = _load());
    await _f;
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.myOrdersTitle)),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _f,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingCards();
          }
          if (snap.hasError) {
            return EmptyState(
              icon: Icons.cloud_off_outlined,
              title: t.somethingWrong,
              message: '${snap.error}',
              action: FilledButton.tonalIcon(
                onPressed: _refresh, icon: const Icon(Icons.refresh), label: Text(t.tryAgain)),
            );
          }
          final items = snap.data ?? [];
          if (items.isEmpty) {
            return EmptyState(
              icon: Icons.receipt_long_outlined,
              title: t.noOrders,
              message: t.noOrdersHint,
              action: FilledButton.icon(
                onPressed: () => Navigator.of(context).pushNamed('/booking', arguments: 'DRY_CLEAN'),
                icon: const Icon(Icons.add),
                label: Text(t.newOrder),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _OrderRow(order: items[i]),
            ),
          );
        },
      ),
    );
  }
}

class _OrderRow extends StatelessWidget {
  const _OrderRow({required this.order});
  final Map<String, dynamic> order;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    final status = '${order['Status']}';
    // A finished order goes to detail; an in-progress one to live tracking.
    const done = {'Delivered', 'Closed', 'Cancelled'};
    final route = done.contains(status) ? '/orders/${order['id']}' : '/track/${order['id']}';

    return TappableCard(
      onTap: () => Navigator.of(context).pushNamed(route),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${order['OrderCode']}', style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 3),
                Text('${order['ServiceTypeCode']}', style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(inr(order['TotalInr']), style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 5),
              StatusChip(status: status, compact: true),
            ],
          ),
        ],
      ),
    );
  }
}
