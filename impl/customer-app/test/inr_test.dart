import 'package:flutter_test/flutter_test.dart';
import 'package:pt_kharade_customer/core/ui/ui_kit.dart';

void main() {
  test('Indian digit grouping', () {
    expect(inr('0'), '₹0');
    expect(inr('50'), '₹50');
    expect(inr('500'), '₹500');
    expect(inr('1000'), '₹1,000');
    expect(inr('12000'), '₹12,000');
    expect(inr('100000'), '₹1,00,000');      // 1 lakh
    expect(inr('1234567'), '₹12,34,567');    // 12.34 lakh
    expect(inr('10000000'), '₹1,00,00,000'); // 1 crore
    expect(inr('190.00'), '₹190');
    expect(inr('267.55'), '₹267.55');
    expect(inr('1234.50'), '₹1,234.50');
  });
}
