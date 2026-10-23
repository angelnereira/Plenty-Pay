import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/format/barcode.dart';
import 'package:plentypay/features/catalog/catalog_data.dart' show ProductItem, productByCode;

import '../../support/commerce_fixtures.dart';

void main() {
  test('N-STD-23: GTIN de 8, 12, 13 y 14 cifras con dígito de control', () {
    for (final ok in ['96385074', '036000291452', '4006381333931', '10036000291459']) {
      expect(validGtin(ok), isTrue, reason: ok);
    }
    for (final bad in ['4006381333932', '7451000100', '74510A0100018', '']) {
      expect(validGtin(bad), isFalse, reason: bad);
    }
  });

  test('N-STD-23: un UPC-A y su EAN-13 con cero inicial son el mismo código (GTIN-14)', () {
    expect(barcodeKey('036000291452'), '00036000291452');
    expect(sameBarcode('036000291452', '0036000291452'), isTrue);
    expect(sameBarcode(' 4006381333931 ', '4006381333931'), isTrue);
    expect(barcodeKey('SKU-CAFE'), 'SKU-CAFE', reason: 'lo que no es GTIN se compara tal cual');
    expect(sameBarcode('', ''), isFalse);
  });

  test('F16.11 C-27: producto por código de barras normalizado o por SKU; desconocido es null', () {
    final products = [
      ProductItem.fromJson(product(cafeId, 'Café 250 g', 1850, barcode: '036000291452')),
      ProductItem.fromJson(product(panId, 'Croissant', 425)),
    ];
    expect(productByCode(products, '0036000291452')?.id, cafeId);
    expect(productByCode(products, 'SKU-Croissant')?.id, panId);
    expect(productByCode(products, '4006381333931'), isNull);
    expect(productByCode(products, '  '), isNull);
  });

  test('F16.11: el mismo código en menos de 800 ms cuenta una vez', () {
    var t = DateTime(2026, 10, 23, 12);
    final d = ScanDebouncer(now: () => t);
    expect(d.accept('4006381333931'), isTrue);
    t = t.add(const Duration(milliseconds: 300));
    expect(d.accept('4006381333931'), isFalse, reason: 'doble lectura');
    expect(d.accept('036000291452'), isTrue, reason: 'otro código cuenta');
    t = t.add(const Duration(milliseconds: 900));
    expect(d.accept('036000291452'), isTrue, reason: 'fuera de la ventana cuenta otra vez');
  });

  test('F16.11 HID: teclas seguidas y Enter son una lectura; tecleo lento no', () {
    final b = ScanBuffer();
    var t = DateTime(2026, 10, 23, 12);
    for (final c in '4006381333931'.split('')) {
      t = t.add(const Duration(milliseconds: 8));
      b.add(c, t);
    }
    expect(b.enter(t.add(const Duration(milliseconds: 8))), '4006381333931');
    for (final c in '1234'.split('')) {
      t = t.add(const Duration(milliseconds: 400));
      b.add(c, t);
    }
    expect(b.enter(t.add(const Duration(milliseconds: 400))), isNull, reason: 'era una persona');
    b.add('1', t);
    expect(b.enter(t), isNull, reason: 'muy corto para ser un código');
  });
}
