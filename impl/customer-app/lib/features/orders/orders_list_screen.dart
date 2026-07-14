import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';

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

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.myOrdersTitle)),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _f,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Text(t.errorWithMessage('${snap.error}')),
            );
          }
          final items = snap.data ?? [];
          if (items.isEmpty) {
            return Center(child: Text(t.noOrders));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: items.length,
            itemBuilder: (_, i) {
              final o = items[i];
              return Card(
                child: ListTile(
                  title: Text(o['OrderCode'] as String),
                  subtitle: Text('${o['ServiceTypeCode']} · ${o['Status']}'),
                  trailing: Text('₹${o['TotalInr']}'),
                  onTap: () => Navigator.of(context).pushNamed('/orders/${o['id']}'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
