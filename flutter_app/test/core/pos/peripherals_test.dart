
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/pos/peripherals.dart';

void main() {
  const hit = ProductHit(variantId: 'v1', sku: 'PAN-001', name: 'Panela', priceMinor: 350);

  group('F24.3 búsqueda por código de barras', () {
    test('encuentra el producto y devuelve el precio del servidor', () async {
      final lookup = BarcodeLookup(lookup: (_) async => hit);
      final r = await lookup.search('7501234567890');
      expect(r, isA<BarcodeFound>());
      expect((r as BarcodeFound).product.priceMinor, 350);
    });

    test('un código desconocido no inventa un precio', () async {
      final lookup = BarcodeLookup(lookup: (_) async => null);
      final r = await lookup.search('0000000000000');
      expect(r, isA<BarcodeNotFound>());
      expect(r.isFound, isFalse);
    });

    test('exceder el presupuesto de 300 ms devuelve timeout, no un error técnico', () async {
      final lookup = BarcodeLookup(
        budget: const Duration(milliseconds: 50),
        lookup: (_) async {
          await Future<void>.delayed(const Duration(milliseconds: 200));
          return hit;
        },
      );
      final r = await lookup.search('7501234567890');
      expect(r, isA<BarcodeTimeout>());
    });

    test('un fallo del servidor se traduce a error, sin propagar la excepción', () async {
      final lookup = BarcodeLookup(lookup: (_) async => throw StateError('boom'));
      final r = await lookup.search('7501234567890');
      expect(r, isA<BarcodeError>());
    });

    test('un código vacío no llega al servidor', () async {
      var called = false;
      final lookup = BarcodeLookup(lookup: (_) async {
        called = true;
        return hit;
      });
      expect(await lookup.search('   '), isA<BarcodeNotFound>());
      expect(called, isFalse, reason: 'no se desperdicia una consulta con un código vacío');
    });

    test('el presupuesto por defecto es de 300 ms', () {
      expect(BarcodeLookup(lookup: (_) async => null).budget, const Duration(milliseconds: 300));
    });
  });

  group('F24.3 lector de teclado HID', () {
    test('emite el código al recibir Enter', () {
      final codes = <String>[];
      final reader = HidBarcodeReader(onScanned: codes.add);
      for (final ch in '7501234567890'.split('')) {
        reader.addKey(ch);
      }
      expect(reader.addKey('\n'), '7501234567890');
      expect(codes, ['7501234567890']);
    });

    test('el buffer queda limpio tras cada código', () {
      final reader = HidBarcodeReader();
      for (final ch in 'AAA'.split('')) {
        reader.addKey(ch);
      }
      reader.addKey('\n');
      expect(reader.bufferedLength, 0);
    });

    test('las teclas de control no forman parte del código', () {
      final reader = HidBarcodeReader();
      reader.addKey('ArrowDown');
      expect(reader.bufferedLength, 0);
    });

    test('Enter sin nada acumulado no emite un código vacío', () {
      final codes = <String>[];
      final reader = HidBarcodeReader(onScanned: codes.add);
      expect(reader.addKey('\n'), isNull);
      expect(codes, isEmpty);
    });

    test('un lector que no envía Enter no crece sin límite', () {
      final reader = HidBarcodeReader(bufferLimit: 8);
      for (final ch in '1234567890123'.split('')) {
        reader.addKey(ch);
      }
      // El buffer se descartó en vez de truncar a medias: un código parcial buscaría
      // otro producto, que es peor que no buscar.
      expect(reader.bufferedLength, 0);
    });

    test('reset limpia el buffer a medias', () {
      final reader = HidBarcodeReader();
      reader.addKey('1');
      reader.addKey('2');
      reader.reset();
      expect(reader.addKey('\n'), isNull);
    });
  });

  group('F24.4 pantalla del cliente', () {
    test('el pareo caduca a los cinco minutos', () {
      final now = DateTime.utc(2026, 10, 19, 15);
      final pairing = CustomerDisplayPairing(
        code: '123456',
        expiresAt: now.add(CustomerDisplayPairing.defaultLifetime),
      );
      expect(pairing.isValidAt(now.add(const Duration(minutes: 4))), isTrue);
      expect(pairing.isValidAt(now.add(const Duration(minutes: 5))), isFalse);
    });

    test('un código vencido genera uno nuevo, no se renueva en silencio', () {
      final now = DateTime.utc(2026, 10, 19, 15);
      final session = DisplaySession(
        pairing: CustomerDisplayPairing(code: '123456', expiresAt: now),
        state: DisplayPairingState.expired,
      );
      final refreshed = session.refreshed(now, now.add(const Duration(minutes: 5)));
      expect(refreshed.state, DisplayPairingState.offered);
    });
  });

  group('F24.2 apertura del cajón', () {
    test('solo una venta o un movimiento de caja abre el cajón', () {
      const rule = CashDrawerRule();
      for (final reason in ['SALE_COMPLETED', 'REFUND_ISSUED', 'CASH_COUNT', 'CASH_DEPOSIT']) {
        expect(rule.allows(reason), isTrue, reason: reason);
      }
    });

    test('una apertura suelta no está permitida', () {
      const rule = CashDrawerRule();
      for (final reason in ['OPEN', 'IDLE', 'TEST', 'debug', '']) {
        expect(rule.allows(reason), isFalse, reason: reason);
      }
    });

    test('el cajón se cierra solo tras 30 s como máximo', () {
      expect(CashDrawerRule.maxOpenMs, 30000);
    });
  });

  group('F24.5 modo quiosco', () {
    test('el PIN de gerente abre el quiosco', () {
      const rule = KioskExitRule(managerPinHash: 'h-g', employeePinHash: 'h-e');
      expect(rule.allowsExit('h-g'), isTrue);
    });

    test('el PIN de empleado marca pero no abre el quiosco', () {
      const rule = KioskExitRule(managerPinHash: 'h-g', employeePinHash: 'h-e');
      expect(rule.allowsExit('h-e'), isFalse);
    });

    test('un PIN desconocido no abre el quiosco', () {
      const rule = KioskExitRule(managerPinHash: 'h-g', employeePinHash: 'h-e');
      expect(rule.allowsExit('cualquiera'), isFalse);
    });

    test('tres intentos fallidos bloquean el PIN cinco minutos', () {
      final counter = PinAttemptCounter();
      final now = DateTime.utc(2026, 10, 19, 15);

      expect(counter.registerFailure(now), isFalse);
      expect(counter.registerFailure(now), isFalse);
      expect(counter.registerFailure(now), isTrue, reason: 'el tercero bloquea');
      expect(counter.isLockedAt(now.add(const Duration(minutes: 1))), isTrue);
      expect(counter.isLockedAt(now.add(const Duration(minutes: 5))), isFalse);
      expect(KioskExitRule.maxPinAttempts, 3);
    });

    test('un acierto reinicia el contador', () {
      final counter = PinAttemptCounter();
      final now = DateTime.utc(2026, 10, 19, 15);
      counter.registerFailure(now);
      counter.registerFailure(now);
      counter.registerSuccess();
      expect(counter.registerFailure(now), isFalse);
    });
  });

  test('la línea del POS solo lleva lo que la caja necesita', () {
    final encoded = encodePosLineItem({
      'variant_id': 'v1',
      'sku': 'PAN-001',
      'name': 'Panela',
      'price_minor': 350,
      'cost_minor': 210, // el POS no debe verlo
      'supplier_id': 's1', // tampoco
    });
    expect(encoded.contains('cost_minor'), isFalse);
    expect(encoded.contains('supplier_id'), isFalse);
    expect(encoded.contains('350'), isTrue);
  });
}