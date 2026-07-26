import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Open a tel:/https: URL, returning false when nothing could handle it (no
/// dialer, no browser) so the caller can show a fallback rather than fail
/// silently.
Future<bool> openUri(String raw) async {
  final uri = Uri.parse(raw);
  if (!await canLaunchUrl(uri)) return false;
  return launchUrl(uri, mode: LaunchMode.externalApplication);
}

/// Dial a phone number. Strips formatting to a tel: URI.
Future<bool> dial(String phone) => openUri('tel:${phone.replaceAll(RegExp(r'[^0-9+]'), '')}');

/// Shared visual language for the customer app.
///
/// The old screens each hardcoded their own `TextStyle(fontSize: …)` and
/// grey shades, so nothing looked like one app and the runtime theme was
/// mostly ignored. These pieces read from `Theme.of(context)` and the tokens
/// below, so a colour/font change actually propagates.

/// Colours the ColorScheme doesn't carry — order-status semantics and the
/// brand gradient. Kept small and named by MEANING, not by hue, so a re-skin
/// changes the values here and nowhere else.
class PtColors {
  const PtColors._();

  // Order status → colour. Distinct from a random palette: these map to
  // states a customer recognises (waiting / on the move / done / stopped).
  static Color status(String status, Brightness b) {
    final dark = b == Brightness.dark;
    switch (status) {
      case 'Delivered':
      case 'Closed':
        return dark ? const Color(0xFF34D399) : const Color(0xFF059669); // green
      case 'Ready':
        return dark ? const Color(0xFFFBBF24) : const Color(0xFFD97706); // amber
      case 'OutForDelivery':
      case 'PickedUp':
        return dark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB); // blue
      case 'Cancelled':
        return dark ? const Color(0xFFF87171) : const Color(0xFFDC2626); // red
      case 'OnHold':
        return dark ? const Color(0xFF9CA3AF) : const Color(0xFF6B7280); // grey
      default:
        return dark ? const Color(0xFF818CF8) : const Color(0xFF4F46E5); // indigo
    }
  }

  /// Plain-language label for an internal status enum — the customer should
  /// never see 'OutForDelivery'.
  static String statusLabel(String status) {
    switch (status) {
      case 'Booked': return 'Booked';
      case 'PickedUp': return 'Picked up';
      case 'Received': return 'At the shop';
      case 'InProcess': return 'Being cleaned';
      case 'Ready': return 'Ready';
      case 'OutForDelivery': return 'On the way';
      case 'Delivered': return 'Delivered';
      case 'Closed': return 'Completed';
      case 'Cancelled': return 'Cancelled';
      case 'OnHold': return 'On hold';
      default: return status;
    }
  }
}

/// A rounded status pill. Tinted background + solid text in the status colour —
/// legible in both themes, and never colour-alone (it always carries a label).
class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status, this.compact = false});
  final String status;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final color = PtColors.status(status, brightness);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: compact ? 8 : 10, vertical: compact ? 3 : 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        PtColors.statusLabel(status),
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: compact ? 11 : 12.5,
        ),
      ),
    );
  }
}

/// The brand header used at the top of the home screen. A gradient built from
/// the theme's primary so it re-tints when the user changes their accent.
class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, required this.child, this.height});
  final Widget child;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      height: height,
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [cs.primary, Color.lerp(cs.primary, cs.tertiary, 0.55) ?? cs.primary],
        ),
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: SafeArea(bottom: false, child: child),
    );
  }
}

/// A tappable surface with the app's standard card treatment. Used instead of
/// raw `Card` + `InkWell` so ripple, radius and elevation stay consistent.
class TappableCard extends StatelessWidget {
  const TappableCard({super.key, required this.child, this.onTap, this.padding});
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: padding ?? const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.5)),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// A friendly empty state: an illustration-substitute icon in a tinted circle,
/// a headline and a supporting line. Replaces the old bare `Center(Text(…))`.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.action,
  });
  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final tt = Theme.of(context).textTheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: cs.primary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 40, color: cs.primary),
            ),
            const SizedBox(height: 20),
            Text(title, style: tt.titleMedium?.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(message!, style: tt.bodyMedium?.copyWith(color: cs.onSurfaceVariant), textAlign: TextAlign.center),
            ],
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

/// A shimmer-free loading placeholder: the app's neutral surface with a
/// subtle pulse. Cheaper than a shimmer package and calmer than a spinner
/// dead-centre on an otherwise blank screen.
class LoadingCards extends StatefulWidget {
  const LoadingCards({super.key, this.count = 4});
  final int count;

  @override
  State<LoadingCards> createState() => _LoadingCardsState();
}

class _LoadingCardsState extends State<LoadingCards> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: widget.count,
      itemBuilder: (_, __) => FadeTransition(
        opacity: Tween(begin: 0.4, end: 0.9).animate(_c),
        child: Container(
          height: 76,
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: cs.surfaceContainerHighest.withValues(alpha: 0.4),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}

/// Rupee formatter — grouped Indian digits, no trailing paise noise on whole
/// amounts. Kept here so every screen formats money identically.
String inr(dynamic value) {
  final n = double.tryParse('$value') ?? 0;
  final whole = n.truncateToDouble() == n;
  final s = n.toStringAsFixed(whole ? 0 : 2);
  // Indian grouping: last 3 digits, then pairs.
  final parts = s.split('.');
  final intPart = parts[0];
  final buf = StringBuffer();
  final digits = intPart.replaceAll('-', '');
  for (int i = 0; i < digits.length; i++) {
    final fromEnd = digits.length - i;
    buf.write(digits[i]);
    if (fromEnd > 3 && (fromEnd - 3) % 2 == 1 && fromEnd != 1) buf.write(',');
  }
  final grouped = (intPart.startsWith('-') ? '-' : '') + buf.toString();
  return '₹$grouped${parts.length > 1 ? '.${parts[1]}' : ''}';
}
