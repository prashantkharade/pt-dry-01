import 'dart:async';
import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/api/api_client.dart';
import '../../core/ui/ui_kit.dart';

/// Live order tracking.
///
/// Renders the backend's TRACKING projection — a curated journey (booked →
/// picked up → cleaning → ready → out for delivery → delivered), not the raw
/// admin status history. That projection already decides which steps exist
/// for this order (a drop-at-shop order has no pickup step), so this screen
/// just draws what it's given.
///
/// It refreshes on a timer while the order is in progress. A laundry customer
/// checks "is my partner here yet" repeatedly; a 30s poll is far simpler than
/// wiring SSE into the app for a screen someone watches for a minute, and it
/// stops polling the moment the order is complete.
class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key, required this.orderId});
  final String orderId;

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  Map<String, dynamic>? _tracking;
  Object? _error;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    // Poll while open; _load() cancels the timer once the order is terminal.
    _poll = Timer.periodic(const Duration(seconds: 30), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final data = await ApiClient.orderTracking(widget.orderId);
      if (!mounted) return;
      setState(() {
        _tracking = data;
        _error = null;
      });
      // No point polling a finished order.
      if (data['IsComplete'] == true || data['IsCancelled'] == true) _poll?.cancel();
    } catch (e) {
      if (!mounted || silent) return;
      setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(t.trackingTitle)),
      body: _error != null
          ? EmptyState(
              icon: Icons.cloud_off_outlined,
              title: t.somethingWrong,
              message: '$_error',
              action: FilledButton.tonalIcon(
                onPressed: () => _load(), icon: const Icon(Icons.refresh), label: Text(t.tryAgain)),
            )
          : _tracking == null
              ? const LoadingCards(count: 3)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: TrackingBody(tracking: _tracking!),
                ),
    );
  }
}

/// The rendered journey. Public so it can be golden-tested with fixture data
/// without standing up the network — the screen above owns the fetch/poll.
class TrackingBody extends StatelessWidget {
  const TrackingBody({super.key, required this.tracking});
  final Map<String, dynamic> tracking;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    final t = AppLocalizations.of(context);

    final steps = (tracking['Steps'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final pct = (tracking['PercentComplete'] as num?)?.toDouble() ?? 0;
    final cancelled = tracking['IsCancelled'] == true;
    final status = '${tracking['Status']}';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Header: order code, current status, a progress bar.
        Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${tracking['OrderCode']}', style: tt.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(t.yourOrder, style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant)),
                ],
              ),
            ),
            StatusChip(status: status),
          ],
        ),
        const SizedBox(height: 16),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: (pct / 100).clamp(0.0, 1.0),
            minHeight: 8,
            backgroundColor: cs.surfaceContainerHighest,
            color: cancelled ? PtColors.status('Cancelled', Theme.of(context).brightness) : cs.primary,
          ),
        ),
        const SizedBox(height: 24),

        if (cancelled)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: PtColors.status('Cancelled', Theme.of(context).brightness).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(children: [
              Icon(Icons.cancel_outlined, size: 20, color: PtColors.status('Cancelled', Theme.of(context).brightness)),
              const SizedBox(width: 10),
              Expanded(child: Text(t.orderCancelled, style: tt.bodyMedium)),
            ]),
          ),

        // The step timeline.
        ...List.generate(steps.length, (i) => _StepTile(
              step: steps[i],
              isLast: i == steps.length - 1,
            )),

        const SizedBox(height: 8),

        // Leg detail cards — slot windows, and the partner once they're moving.
        if (tracking['Pickup'] != null)
          _LegCard(leg: (tracking['Pickup'] as Map).cast<String, dynamic>(), label: t.pickup, icon: Icons.home_outlined),
        if (tracking['Delivery'] != null)
          _LegCard(leg: (tracking['Delivery'] as Map).cast<String, dynamic>(), label: t.orderDelivery, icon: Icons.local_shipping_outlined),

        const SizedBox(height: 12),

        // Receipt — opens the signed PDF in the browser/viewer.
        OutlinedButton.icon(
          onPressed: () async {
            final url = ApiClient.receiptUrl('${tracking['OrderId']}');
            final ok = await openUri(url);
            if (!ok && context.mounted) {
              // No app could open it — show the link so it's still usable.
              await showDialog<void>(
                context: context,
                builder: (_) => AlertDialog(
                  title: Text(t.viewReceipt),
                  content: SelectableText(url),
                  actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
                ),
              );
            }
          },
          icon: const Icon(Icons.receipt_long_outlined),
          label: Text(t.viewReceipt),
        ),
      ],
    );
  }
}

/// One node in the vertical timeline: a connector rail + a state dot + label.
class _StepTile extends StatelessWidget {
  const _StepTile({required this.step, required this.isLast});
  final Map<String, dynamic> step;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    final state = '${step['State']}'; // Done | Current | Upcoming | Skipped | Failed

    final done = state == 'Done';
    final current = state == 'Current';
    final failed = state == 'Failed';

    final Color dotColor = failed
        ? PtColors.status('Cancelled', Theme.of(context).brightness)
        : (done || current) ? cs.primary : cs.surfaceContainerHighest;

    final at = step['At'];

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Rail + dot column.
          Column(
            children: [
              // The dot. Current step gets a ring so it's obvious where we are.
              Container(
                width: current ? 22 : 18,
                height: current ? 22 : 18,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  border: current ? Border.all(color: cs.primary.withValues(alpha: 0.25), width: 4) : null,
                ),
                child: done ? Icon(Icons.check, size: 11, color: cs.onPrimary) : null,
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: done ? cs.primary : cs.surfaceContainerHighest,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          // Label + time.
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 22, top: current ? 0 : 1),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${step['Label']}',
                    style: tt.bodyLarge?.copyWith(
                      fontWeight: (current || done) ? FontWeight.w600 : FontWeight.w400,
                      color: (current || done) ? cs.onSurface : cs.onSurfaceVariant,
                    ),
                  ),
                  if (at != null)
                    Text(_fmt(at), style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _fmt(dynamic iso) {
    final d = DateTime.tryParse('$iso')?.toLocal();
    if (d == null) return '';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
    final ampm = d.hour < 12 ? 'am' : 'pm';
    return '${d.day} ${months[d.month - 1]}, $h:${d.minute.toString().padLeft(2, '0')} $ampm';
  }
}

class _LegCard extends StatelessWidget {
  const _LegCard({required this.leg, required this.label, required this.icon});
  final Map<String, dynamic> leg;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final tt = Theme.of(context).textTheme;
    final cs = Theme.of(context).colorScheme;
    final t = AppLocalizations.of(context);

    final date = leg['Date'];
    final window = leg['SlotWindow'];
    final partner = leg['PartnerName'];
    final phone = leg['PartnerPhone'];
    final items = leg['ItemCount'];

    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: cs.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(icon, size: 18, color: cs.primary),
            const SizedBox(width: 8),
            Text(label, style: tt.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
            const Spacer(),
            if (date != null)
              // Flexible + ellipsis: a long "date · window" must not shove the
              // row past the card edge on a narrow phone.
              Flexible(
                child: Text(
                  [date, if (window != null) window].join(' · '),
                  style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant),
                  textAlign: TextAlign.end,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ]),
          if (items != null) ...[
            const SizedBox(height: 6),
            Text(t.collectedItems(items as int), style: tt.bodySmall?.copyWith(color: cs.onSurfaceVariant)),
          ],
          // The partner's number only appears once they're actually on the way
          // (the backend withholds it until then), so a "Call" button here is
          // always actionable.
          if (partner != null) ...[
            const SizedBox(height: 10),
            Row(children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: cs.primary.withValues(alpha: 0.14),
                child: Text('${partner[0]}'.toUpperCase(),
                    style: TextStyle(color: cs.primary, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Text(t.partnerOnWay('$partner'), style: tt.bodyMedium)),
              if (phone != null)
                FilledButton.tonalIcon(
                  onPressed: () => dial('$phone'),
                  icon: const Icon(Icons.call, size: 16),
                  label: Text(t.callPartner),
                ),
            ]),
          ],
        ],
      ),
    );
  }
}
