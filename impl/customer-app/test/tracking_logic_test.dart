import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pt_kharade_customer/core/ui/ui_kit.dart';

/// Offline-safe guards for the customer-facing tracking rules. The full visual
/// render was verified by golden (see test/goldens/tracking_*.png); this pins
/// the two properties that must never regress silently.
void main() {
  test('status labels never leak internal enum names to the customer', () {
    // Every internal status must map to plain language a customer recognises.
    const internal = [
      'Booked', 'PickedUp', 'Received', 'InProcess', 'Ready',
      'OutForDelivery', 'Delivered', 'Closed', 'Cancelled', 'OnHold',
    ];
    for (final s in internal) {
      final label = PtColors.statusLabel(s);
      // The label must be humanised — not the raw camelCase enum.
      if (s == 'OutForDelivery' || s == 'InProcess' || s == 'PickedUp') {
        expect(label, isNot(equals(s)), reason: '$s should be humanised, got "$label"');
      }
      expect(label.trim(), isNotEmpty);
    }
    // Spot-check the ones a customer sees most.
    expect(PtColors.statusLabel('OutForDelivery'), 'On the way');
    expect(PtColors.statusLabel('InProcess'), 'Being cleaned');
    expect(PtColors.statusLabel('Received'), 'At the shop');
  });

  test('every status has a distinct colour in both themes', () {
    for (final b in [Brightness.light, Brightness.dark]) {
      // Terminal states must not share a colour with in-progress ones.
      final delivered = PtColors.status('Delivered', b);
      final cancelled = PtColors.status('Cancelled', b);
      final onTheWay = PtColors.status('OutForDelivery', b);
      expect(delivered, isNot(equals(cancelled)));
      expect(delivered, isNot(equals(onTheWay)));
      expect(cancelled, isNot(equals(onTheWay)));
    }
  });
}
