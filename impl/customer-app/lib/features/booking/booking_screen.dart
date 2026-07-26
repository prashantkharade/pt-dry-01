import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/auth/auth_store.dart';
import '../../core/ui/ui_kit.dart';

/// Booking.
///
/// Rebuilt to actually support the two-leg flow. The old screen let a
/// customer choose "Home pickup" / "Home delivery" but collected none of the
/// society or slot data those legs require — so the order was rejected by the
/// backend's own validation. Now, when a leg comes to the home, this screen
/// gathers the society and a slot (with real remaining capacity) for it.
class BookingScreen extends StatefulWidget {
  const BookingScreen({super.key});
  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  String _service = 'DRY_CLEAN';
  String _channel = 'DropAtShop';       // DropAtShop | HomePickup
  String _delivery = 'CustomerPickup';  // CustomerPickup | HomeDelivery
  bool _express = false;

  final Map<String, int> _qty = {};
  List<Map<String, dynamic>> _items = [];
  Map<String, dynamic>? _quote;

  // Two-leg selection.
  List<Map<String, dynamic>> _societies = [];
  String? _societyId;
  DateTime _pickupDate = DateTime.now().add(const Duration(days: 1));
  DateTime _deliveryDate = DateTime.now().add(const Duration(days: 3));
  List<Map<String, dynamic>> _pickupSlots = [];
  List<Map<String, dynamic>> _deliverySlots = [];
  String? _pickupSlotId;
  String? _deliverySlotId;

  bool _loadingItems = true;
  bool _placing = false;
  String? _error;

  bool get _needsPickupLeg => _channel == 'HomePickup';
  bool get _needsDeliveryLeg => _delivery == 'HomeDelivery';
  bool get _needsAddress => _needsPickupLeg || _needsDeliveryLeg;

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
      if (!mounted) return;
      setState(() {
        _items = items;
        _loadingItems = false;
        _quote = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is ApiException ? e.message : AppLocalizations.of(context).failedLoadItems;
        _loadingItems = false;
      });
    }
  }

  Future<void> _loadSocieties() async {
    if (_societies.isNotEmpty) return;
    try {
      final s = await ApiClient.societies();
      if (!mounted) return;
      setState(() => _societies = s);
    } catch (_) {/* the address section shows a hint if this stays empty */}
  }

  Future<void> _loadSlots(String direction) async {
    final date = direction == 'Pickup' ? _pickupDate : _deliveryDate;
    final iso = _iso(date);
    try {
      final slots = await ApiClient.slotAvailability(date: iso, direction: direction);
      if (!mounted) return;
      setState(() {
        if (direction == 'Pickup') {
          _pickupSlots = slots;
          // Drop a previously-chosen slot that isn't offered on the new date.
          if (!slots.any((s) => s['SlotId'] == _pickupSlotId)) _pickupSlotId = null;
        } else {
          _deliverySlots = slots;
          if (!slots.any((s) => s['SlotId'] == _deliverySlotId)) _deliverySlotId = null;
        }
      });
    } catch (_) {/* leave the slot list empty; the picker shows the empty state */}
  }

  String _iso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  List<Map<String, dynamic>> _quoteItems() => _qty.entries
      .where((e) => e.value > 0)
      .map((e) => {'ItemId': e.key, 'Quantity': e.value})
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
        isVendor: false,
        items: items,
      );
      if (!mounted) return;
      setState(() { _quote = q; _error = null; });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e is ApiException ? e.message : AppLocalizations.of(context).quoteFailed);
    }
  }

  /// What's missing before the order can be placed — surfaced inline so the
  /// customer isn't bounced by a backend 400.
  String? _validationGap(AppLocalizations t) {
    if (_quoteItems().isEmpty) return t.addItemsFirst;
    if (_needsAddress && _societyId == null) return t.chooseSocietyFirst;
    if (_needsPickupLeg && _pickupSlotId == null) return t.choosePickupSlot;
    if (_needsDeliveryLeg && _deliverySlotId == null) return t.chooseDeliverySlot;
    return null;
  }

  Future<void> _place() async {
    final t = AppLocalizations.of(context);
    final gap = _validationGap(t);
    if (gap != null) {
      setState(() => _error = gap);
      return;
    }
    setState(() { _placing = true; _error = null; });
    try {
      final customerId = await AuthStore.instance.ensureCustomerId();
      if (customerId == null) {
        setState(() { _error = t.setupProfileFirst; _placing = false; });
        return;
      }
      final order = await ApiClient.createOrder(
        customerId: customerId,
        serviceTypeCode: _service,
        channel: _channel,
        deliveryType: _delivery,
        isExpress: _express,
        items: _quoteItems(),
        societyId: _needsAddress ? _societyId : null,
        pickupSlotId: _needsPickupLeg ? _pickupSlotId : null,
        pickupDate: _needsPickupLeg ? _iso(_pickupDate) : null,
        deliverySlotId: _needsDeliveryLeg ? _deliverySlotId : null,
        deliveryDate: _needsDeliveryLeg ? _iso(_deliveryDate) : null,
      );
      if (!mounted) return;
      // Straight into live tracking — the order now has legs to follow.
      Navigator.of(context).pushReplacementNamed('/track/${order['id']}');
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e is ApiException ? e.message : t.failedPlaceOrder);
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final tt = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(title: Text(t.bookTitle(_service))),
      body: _loadingItems
          ? const LoadingCards()
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null) _ErrorBanner(_error!),

                  _SectionTitle(t.chooseItems),
                  TappableCard(
                    padding: EdgeInsets.zero,
                    child: Column(
                      children: [
                        for (final it in _items)
                          _ItemRow(
                            name: '${it['Name']}',
                            code: '${it['Code']}',
                            qty: _qty[it['id']] ?? 0,
                            onAdd: () => setState(() => _qty[it['id'] as String] = (_qty[it['id'] as String] ?? 0) + 1),
                            onRemove: () => setState(() {
                              final c = (_qty[it['id'] as String] ?? 0) - 1;
                              if (c <= 0) { _qty.remove(it['id']); } else { _qty[it['id'] as String] = c; }
                            }),
                          ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),
                  _SectionTitle(t.collection),
                  TappableCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.howToStart, style: tt.labelLarge),
                        const SizedBox(height: 6),
                        SegmentedButton<String>(
                          segments: [
                            ButtonSegment(value: 'DropAtShop', label: Text(t.dropAtShop)),
                            ButtonSegment(value: 'HomePickup', label: Text(t.homePickup)),
                          ],
                          selected: {_channel},
                          onSelectionChanged: (s) {
                            setState(() => _channel = s.first);
                            if (_needsPickupLeg) { _loadSocieties(); _loadSlots('Pickup'); }
                          },
                        ),
                        const SizedBox(height: 14),
                        Text(t.howToReturn, style: tt.labelLarge),
                        const SizedBox(height: 6),
                        SegmentedButton<String>(
                          segments: [
                            ButtonSegment(value: 'CustomerPickup', label: Text(t.pickupAtShop)),
                            ButtonSegment(value: 'HomeDelivery', label: Text(t.homeDelivery)),
                          ],
                          selected: {_delivery},
                          onSelectionChanged: (s) {
                            setState(() => _delivery = s.first);
                            if (_needsDeliveryLeg) { _loadSocieties(); _loadSlots('Delivery'); }
                          },
                        ),
                        SwitchListTile(
                          value: _express,
                          onChanged: (v) => setState(() => _express = v),
                          title: Text(t.express),
                          subtitle: Text(t.expressHint, style: tt.bodySmall),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ],
                    ),
                  ),

                  // Only shown when a leg actually comes to the customer.
                  if (_needsAddress) ...[
                    const SizedBox(height: 16),
                    _SectionTitle(t.whereAndWhen),
                    TappableCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t.yourSociety, style: tt.labelLarge),
                          const SizedBox(height: 6),
                          if (_societies.isEmpty)
                            Text(t.noSocietiesHint, style: tt.bodySmall)
                          else
                            DropdownButtonFormField<String>(
                              initialValue: _societyId,
                              isExpanded: true,
                              hint: Text(t.selectSociety),
                              items: _societies
                                  .map((s) => DropdownMenuItem(value: '${s['id']}', child: Text('${s['Name']}')))
                                  .toList(),
                              onChanged: (v) => setState(() => _societyId = v),
                            ),

                          if (_needsPickupLeg)
                            _SlotPicker(
                              label: t.pickup,
                              date: _pickupDate,
                              slots: _pickupSlots,
                              selectedSlotId: _pickupSlotId,
                              onDate: (d) { setState(() => _pickupDate = d); _loadSlots('Pickup'); },
                              onSlot: (id) => setState(() => _pickupSlotId = id),
                              emptyLabel: t.noSlotsThatDay,
                            ),
                          if (_needsDeliveryLeg)
                            _SlotPicker(
                              label: t.orderDelivery,
                              date: _deliveryDate,
                              slots: _deliverySlots,
                              selectedSlotId: _deliverySlotId,
                              onDate: (d) { setState(() => _deliveryDate = d); _loadSlots('Delivery'); },
                              onSlot: (id) => setState(() => _deliverySlotId = id),
                              emptyLabel: t.noSlotsThatDay,
                            ),
                        ],
                      ),
                    ),
                  ],

                  if (_quote != null) ...[
                    const SizedBox(height: 16),
                    _SectionTitle(t.pricePreview),
                    TappableCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final l in (_quote!['Lines'] as List).cast<Map>())
                            _priceRow('${l['ItemName']} × ${l['Quantity']}', inr(l['LineTotalInr'])),
                          const Divider(),
                          _priceRow(t.subtotal, inr(_quote!['SubtotalInr'])),
                          if (_num(_quote!['DeliveryChargeInr']) > 0) _priceRow(t.delivery, inr(_quote!['DeliveryChargeInr'])),
                          if (_num(_quote!['ExpressChargeInr']) > 0) _priceRow(t.expressLine, inr(_quote!['ExpressChargeInr'])),
                          if (_num(_quote!['GstInr']) > 0) _priceRow(t.gst, inr(_quote!['GstInr'])),
                          const SizedBox(height: 4),
                          _priceRow(t.total, inr(_quote!['TotalInr']), bold: true),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _qty.isEmpty ? null : _refreshQuote,
                          child: Text(t.getQuote),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FilledButton(
                          onPressed: _placing || _qty.isEmpty ? null : _place,
                          child: _placing
                              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                              : Text(t.placeOrder),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }

  double _num(dynamic v) => double.tryParse('$v') ?? 0;

  Widget _priceRow(String label, String value, {bool bold = false}) {
    final tt = Theme.of(context).textTheme;
    final style = bold ? tt.titleSmall?.copyWith(fontWeight: FontWeight.w700) : tt.bodyMedium;
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Text(text, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
      );
}

class _ItemRow extends StatelessWidget {
  const _ItemRow({required this.name, required this.code, required this.qty, required this.onAdd, required this.onRemove});
  final String name;
  final String code;
  final int qty;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: tt.bodyLarge),
                Text(code, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
              ],
            ),
          ),
          IconButton(icon: const Icon(Icons.remove_circle_outline), onPressed: qty > 0 ? onRemove : null),
          SizedBox(width: 24, child: Text('$qty', textAlign: TextAlign.center, style: tt.titleMedium)),
          IconButton(icon: const Icon(Icons.add_circle), color: cs.primary, onPressed: onAdd),
        ],
      ),
    );
  }
}

/// Date + slot chips for one leg. Slots show their remaining capacity and grey
/// out when full or past cutoff — the customer can't pick a slot that would
/// then fail at checkout.
class _SlotPicker extends StatelessWidget {
  const _SlotPicker({
    required this.label,
    required this.date,
    required this.slots,
    required this.selectedSlotId,
    required this.onDate,
    required this.onSlot,
    required this.emptyLabel,
  });
  final String label;
  final DateTime date;
  final List<Map<String, dynamic>> slots;
  final String? selectedSlotId;
  final ValueChanged<DateTime> onDate;
  final ValueChanged<String> onSlot;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(label, style: tt.labelLarge),
              const Spacer(),
              TextButton.icon(
                onPressed: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: date,
                    firstDate: DateTime.now(),
                    lastDate: DateTime.now().add(const Duration(days: 30)),
                  );
                  if (picked != null) onDate(picked);
                },
                icon: const Icon(Icons.calendar_today_outlined, size: 16),
                label: Text('${date.day}/${date.month}'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          if (slots.isEmpty)
            Text(emptyLabel, style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: slots.map((s) {
                final id = '${s['SlotId']}';
                final bookable = s['IsBookable'] == true;
                final selected = id == selectedSlotId;
                return ChoiceChip(
                  label: Text('${s['Name']}'),
                  selected: selected,
                  // A full or closed slot can't be chosen — so a "just taken"
                  // slot doesn't fail the order at the last step.
                  onSelected: bookable ? (_) => onSlot(id) : null,
                  labelStyle: TextStyle(color: bookable ? null : cs.onSurfaceVariant),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner(this.message);
  final String message;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: cs.errorContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, size: 18, color: cs.onErrorContainer),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: TextStyle(color: cs.onErrorContainer))),
        ],
      ),
    );
  }
}
