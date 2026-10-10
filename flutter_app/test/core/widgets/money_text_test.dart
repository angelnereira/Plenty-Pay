import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/widgets/money_text.dart';

void main() {
  test('formatea centavos enteros con separador de miles', () {
    expect(MoneyText.format(0), r'$0.00');
    expect(MoneyText.format(5), r'$0.05');
    expect(MoneyText.format(1250), r'$12.50');
    expect(MoneyText.format(123456789), r'$1,234,567.89');
  });

  test('negativos llevan signo menos tipográfico', () {
    expect(MoneyText.format(-1250), '−\$12.50');
  });

  test('acepta otro símbolo de moneda', () {
    expect(MoneyText.format(100000, symbol: 'B/. '), 'B/. 1,000.00');
  });
}
