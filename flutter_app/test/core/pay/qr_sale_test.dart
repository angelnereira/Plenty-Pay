import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/pay/qr_scanner.dart';

void main() {
  const code = 'AbCdEfGhIjKlMnOpQrStUv';
  const sale = '01900000-0000-7000-8000-0000000000aa';

  test('S-POS-03 e4: el QR de una venta trae la venta y el monto fijados por la caja', () {
    final r = parsePaymentQr('https://plentypay.app/t/$code?sale=$sale&amount=1850&currency=USD');
    expect(r.isAccepted, isTrue);
    expect(r.link!.saleId, sale);
    expect(r.link!.amountMinor, 1850);
  });

  test('flutter-standards §10: un QR de venta alterado se rechaza (nunca se corrige)', () {
    for (final bad in [
      'https://plentypay.app/t/$code?sale=no-es-uuid&amount=1850',
      'https://plentypay.app/t/$code?sale=$sale&amount=-5',
      'https://plentypay.app/t/$code?sale=$sale&amount=1.5',
      'https://plentypay.app/t/$code?sale=$sale',
      'https://plentypay.app/t/$code?amount=0',
      'https://plentypay.app/t/$code?amount=99999999999',
      'https://plentypay.app/t/$code?sale=$sale&amount=1850&currency=EUR',
    ]) {
      expect(parsePaymentQr(bad).isAccepted, isFalse, reason: bad);
    }
  });

  test('el QR de un punto de cobro sin venta sigue igual', () {
    final r = parsePaymentQr('https://plentypay.app/t/$code');
    expect(r.isAccepted, isTrue);
    expect(r.link!.saleId, isNull);
  });

  test('F11.10 · S-WAL-04 e3: un código personal puede pedir un monto, sin venta', () {
    final r = parsePaymentQr('https://plentypay.app/t/$code?amount=1250');
    expect(r.isAccepted, isTrue);
    expect(r.link!.amountMinor, 1250);
    expect(r.link!.saleId, isNull);
    expect(parsePaymentQr('https://plentypay.app/t/$code?amount=1250&currency=EUR').isAccepted, isFalse);
  });
}
