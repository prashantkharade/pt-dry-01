import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/ui/ui_kit.dart';

/// Order detail — the bill and the receipt.
///
/// Rebuilt to match the rest of the app: a status chip (not raw enum text), a
/// clean itemised bill, a receipt-download button, and a "track" shortcut for
/// an order still in progress. The old raw status-history list is gone — the
/// tracking screen owns the customer-facing journey.
class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;
  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  late Future<Map<String, dynamic>> _f;

  @override
  void initState() {
    super.initState();
    _f = ApiClient.orderDetail(widget.orderId);
  }

  Future<void> _openReceipt() async {
    final url = ApiClient.receiptUrl(widget.orderId);
    final ok = await openUri(url);
    if (!ok && mounted) {
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(AppLocalizations.of(context).viewReceipt),
          content: SelectableText(url),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: Text(t.orderTitle)),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _f,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingCards(count: 3);
          }
          if (!snap.hasData) {
            return EmptyState(
              icon: Icons.cloud_off_outlined,
              title: t.somethingWrong,
              message: '${snap.error}',
            );
          }
          final o = snap.data!;
          final lines = ((o['Lines'] as List?) ?? const []).cast<Map>();
          final status = '${o['Status']}';
          const done = {'Delivered', 'Closed', 'Cancelled'};

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('${o['OrderCode']}', style: tt.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
                  ),
                  StatusChip(status: status),
                ],
              ),
              const SizedBox(height: 4),
              Text('${o['ServiceTypeCode']}${o['IsExpress'] == true ? ' · Express' : ''}',
                  style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant)),

              // In-progress orders get a track shortcut.
              if (!done.contains(status)) ...[
                const SizedBox(height: 12),
                FilledButton.tonalIcon(
                  onPressed: () => Navigator.of(context).pushNamed('/track/${widget.orderId}'),
                  icon: const Icon(Icons.local_shipping_outlined, size: 18),
                  label: Text(t.trackOrder),
                ),
              ],

              const SizedBox(height: 16),
              // Itemised bill.
              TappableCard(
                child: Column(
                  children: [
                    ...lines.map((l) => Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Row(
                            children: [
                              Expanded(child: Text('${l['ItemName']} × ${l['Quantity']}', style: tt.bodyMedium)),
                              Text(inr(l['LineTotalInr']), style: tt.bodyMedium),
                            ],
                          ),
                        )),
                    Divider(color: cs.outlineVariant.withValues(alpha: 0.5)),
                    _row(context, t.subtotal, inr(o['SubtotalInr'])),
                    if (_num(o['DeliveryChargeInr']) > 0) _row(context, t.delivery, inr(o['DeliveryChargeInr'])),
                    if (_num(o['ExpressChargeInr']) > 0) _row(context, t.expressLine, inr(o['ExpressChargeInr'])),
                    if (_num(o['GstInr']) > 0) _row(context, t.gst, inr(o['GstInr'])),
                    const SizedBox(height: 4),
                    _row(context, t.total, inr(o['TotalInr']), bold: true),
                  ],
                ),
              ),

              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: _openReceipt,
                icon: const Icon(Icons.download_outlined),
                label: Text(t.downloadReceipt),
              ),
            ],
          );
        },
      ),
    );
  }

  double _num(dynamic v) => double.tryParse('$v') ?? 0;

  Widget _row(BuildContext context, String label, String value, {bool bold = false}) {
    final tt = Theme.of(context).textTheme;
    final style = bold
        ? tt.titleMedium?.copyWith(fontWeight: FontWeight.w700)
        : tt.bodyMedium?.copyWith(color: Theme.of(context).colorScheme.onSurfaceVariant);
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: bold ? style : tt.bodyMedium)],
      ),
    );
  }
}
