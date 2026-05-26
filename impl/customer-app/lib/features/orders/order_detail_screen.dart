import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';

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

  String _inr(num? n) => '₹${(n ?? 0).toStringAsFixed(0)}';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _f,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (!snap.hasData) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Text('Error: ${snap.error}'),
            );
          }
          final o = snap.data!;
          final lines = ((o['Lines'] as List?) ?? const []).cast<Map>();
          final history = ((o['History'] as List?) ?? const []).cast<Map>();
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(o['OrderCode'] as String,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Chip(label: Text(o['Status'] as String)),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    children: [
                      ...lines.map((l) => Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(child: Text('${l['ItemName']} × ${l['Quantity']}')),
                              Text(_inr(num.tryParse('${l['LineTotalInr']}'))),
                            ],
                          )),
                      const Divider(),
                      _row('Subtotal', _inr(num.tryParse('${o['SubtotalInr']}'))),
                      _row('Delivery', _inr(num.tryParse('${o['DeliveryChargeInr']}'))),
                      _row('Express', _inr(num.tryParse('${o['ExpressChargeInr']}'))),
                      _row('GST', _inr(num.tryParse('${o['GstInr']}'))),
                      _row('Total', _inr(num.tryParse('${o['TotalInr']}')), bold: true),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Timeline', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              ...history.map((h) => ListTile(
                    leading: const Icon(Icons.circle, size: 12),
                    title: Text(h['ToStatus'] as String),
                    subtitle: Text('${h['CreatedAt']}'),
                  )),
            ],
          );
        },
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    final style = bold ? const TextStyle(fontWeight: FontWeight.w700) : null;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}
