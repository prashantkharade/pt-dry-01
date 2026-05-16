import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';

class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key});
  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  String _service = 'DRY_CLEAN';
  String _channel = 'DropAtShop';
  String _delivery = 'CustomerPickup';
  bool _express = false;
  final Map<String, int> _qty = {};
  List<Map<String, dynamic>> _items = [];
  Map<String, dynamic>? _quote;
  bool _loadingItems = true;
  bool _placing = false;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arg = ModalRoute.of(context)?.settings.arguments as String?;
    if (arg != null && arg != _service) {
      _service = arg;
      _loadItems();
    } else if (_items.isEmpty && _loadingItems) {
      _loadItems();
    }
  }

  Future<void> _loadItems() async {
    setState(() => _loadingItems = true);
    try {
      final items = await ApiClient.items(_service);
      setState(() {
        _items = items;
        _loadingItems = false;
        _quote = null;
      });
    } catch (e) {
      setState(() {
        _error = e is ApiException ? e.message : 'Failed to load items';
        _loadingItems = false;
      });
    }
  }

  List<Map<String, dynamic>> _quoteItems() => _qty.entries
      .where((e) => e.value > 0)
      .map((e) => {'itemId': e.key, 'quantity': e.value})
      .toList();

  Future<void> _refreshQuote() async {
    final items = _quoteItems();
    if (items.isEmpty) {
      setState(() => _quote = null);
      return;
    }
    try {
      final q = await ApiClient.quote(
        serviceTypeCode: _service,
        deliveryType: _delivery,
        isExpress: _express,
        items: items,
      );
      setState(() { _quote = q; _error = null; });
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Quote failed');
    }
  }

  Future<void> _place() async {
    setState(() { _placing = true; _error = null; });
    try {
      var customerId = AuthStore.instance.customerId;
      if (customerId == null) {
        // The identity-service auto-provisions a customer profile on OTP login;
        // a follow-up call to /users/me returns the userId, but for the slice
        // we ask the user to enter the customer id assigned by the admin until
        // a /customers/me endpoint is added (TODO in identity-service).
        _error = 'Set up your customer profile via the admin portal first.';
        setState(() => _placing = false);
        return;
      }
      final order = await ApiClient.createOrder(
        customerId: customerId,
        serviceTypeCode: _service,
        channel: _channel,
        deliveryType: _delivery,
        isExpress: _express,
        items: _quoteItems(),
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/orders/${order['id']}');
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : 'Failed to place order');
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inr = (num? n) => '₹${(n ?? 0).toStringAsFixed(0)}';
    return Scaffold(
      appBar: AppBar(title: Text('Book — $_service')),
      body: _loadingItems
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Container(
                      padding: const EdgeInsets.all(12),
                      margin: const EdgeInsets.only(bottom: 12),
                      color: Colors.red.shade50,
                      child: Text(_error!, style: const TextStyle(color: Colors.red)),
                    ),
                  Card(
                    child: Column(
                      children: _items
                          .map((it) => ListTile(
                                title: Text(it['Name'] as String),
                                subtitle: Text(it['Code'] as String),
                                trailing: SizedBox(
                                  width: 120,
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.remove_circle_outline),
                                        onPressed: () {
                                          setState(() {
                                            final c = (_qty[it['id'] as String] ?? 0) - 1;
                                            if (c <= 0) {
                                              _qty.remove(it['id']);
                                            } else {
                                              _qty[it['id'] as String] = c;
                                            }
                                          });
                                        },
                                      ),
                                      Text('${_qty[it['id']] ?? 0}'),
                                      IconButton(
                                        icon: const Icon(Icons.add_circle_outline),
                                        onPressed: () {
                                          setState(() {
                                            _qty[it['id'] as String] = (_qty[it['id'] as String] ?? 0) + 1;
                                          });
                                        },
                                      ),
                                    ],
                                  ),
                                ),
                              ))
                          .toList(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Collection', style: TextStyle(fontWeight: FontWeight.w600)),
                          SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(value: 'DropAtShop', label: Text('Drop at shop')),
                              ButtonSegment(value: 'HomePickup', label: Text('Home pickup')),
                            ],
                            selected: {_channel},
                            onSelectionChanged: (s) => setState(() => _channel = s.first),
                          ),
                          const SizedBox(height: 8),
                          const Text('Delivery', style: TextStyle(fontWeight: FontWeight.w600)),
                          SegmentedButton<String>(
                            segments: const [
                              ButtonSegment(value: 'CustomerPickup', label: Text('Pickup at shop')),
                              ButtonSegment(value: 'HomeDelivery', label: Text('Home delivery')),
                            ],
                            selected: {_delivery},
                            onSelectionChanged: (s) => setState(() => _delivery = s.first),
                          ),
                          SwitchListTile(
                            value: _express,
                            onChanged: (v) => setState(() => _express = v),
                            title: const Text('Express / same-day (+25%)'),
                            contentPadding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_quote != null) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Price preview', style: TextStyle(fontWeight: FontWeight.w600)),
                            const SizedBox(height: 8),
                            ...((_quote!['lines'] as List).cast<Map>()).map(
                              (l) => Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(child: Text('${l['itemName']} × ${l['quantity']}')),
                                  Text(inr(l['lineTotalInr'] as num)),
                                ],
                              ),
                            ),
                            const Divider(),
                            _row('Subtotal', inr(_quote!['subtotalInr'] as num)),
                            _row('Delivery', inr(_quote!['deliveryChargeInr'] as num)),
                            _row('Express', inr(_quote!['expressChargeInr'] as num)),
                            _row('GST', inr(_quote!['gstInr'] as num)),
                            const SizedBox(height: 4),
                            _row('Total', inr(_quote!['totalInr'] as num), bold: true),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _qty.isEmpty ? null : _refreshQuote,
                          child: const Text('Get quote'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _placing || _qty.isEmpty ? null : _place,
                          child: _placing
                              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                              : const Text('Place order'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
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
