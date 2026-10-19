import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/pay/qr_scanner.dart';

void main() {
  group('F23.1 QR de cobro', () {
    test('acepta un enlace de pago válido', () {
      final r = parsePaymentQr('https://plentypay.app/t/ABCD1234ef');
      expect(r.isAccepted, isTrue);
      expect(r.link!.code, 'ABCD1234ef');
      expect(r.link!.host, 'plentypay.app');
    });

    test('rechaza un host que no es de PlentyPay', () {
      final r = parsePaymentQr('https://evil.com/t/ABCD1234');
      expect(r.isAccepted, isFalse);
      expect(r.rejection, QrRejection.hostNotAllowed);
      expect(r.message, isNotNull);
      expect(r.link, isNull);
    });

    test('rechaza un host que solo imita el nuestro', () {
      for (final host in [
        'plentypay.app.evil.com',
        'evilplentypay.app',
        'plentypay.app.co',
        'xn--plentypay-8ya.app',
      ]) {
        expect(
          parsePaymentQr('https://$host/t/ABCD1234').isAccepted,
          isFalse,
          reason: host,
        );
      }
    });

    test('rechaza http aunque el host sea válido', () {
      final r = parsePaymentQr('http://plentypay.app/t/ABCD1234');
      expect(r.isAccepted, isFalse);
      expect(r.rejection, QrRejection.notAPaymentLink);
    });

    test('rechaza un esquema distinto', () {
      expect(parsePaymentQr('plentypay://t/ABCD1234').isAccepted, isFalse);
      expect(parsePaymentQr('javascript:alert(1)').isAccepted, isFalse);
    });

    test('valida el formato y el largo del código', () {
      // Menos de 8 caracteres.
      expect(parsePaymentQr('https://plentypay.app/t/ABC').rejection, QrRejection.invalidCode);
      // Con caracteres fuera del alfabeto.
      expect(parsePaymentQr(r'https://plentypay.app/t/ABC').rejection, QrRejection.invalidCode);
      expect(parsePaymentQr('https://plentypay.app/t/ABC%201234').rejection, QrRejection.invalidCode);
      // Exactamente 8 y exactamente 64 son válidos.
      expect(parsePaymentQr('https://plentypay.app/t/ABCD1234').isAccepted, isTrue);
      expect(parsePaymentQr('https://plentypay.app/t/${'a' * 64}').isAccepted, isTrue);
      // 65 excede el rango.
      expect(
        parsePaymentQr('https://plentypay.app/t/${'a' * 65}').rejection,
        QrRejection.invalidCode,
      );
    });

    test('el alfabeto del código es alfanumérico, guion y guion bajo', () {
      expect(parsePaymentQr('https://plentypay.app/t/ab-cd_12').isAccepted, isTrue);
    });

    test('rechaza una ruta que no sea /t/', () {
      expect(parsePaymentQr('https://plentypay.app/track/ABCD1234').rejection, QrRejection.malformed);
      expect(parsePaymentQr('https://plentypay.app/t/').rejection, QrRejection.malformed);
      expect(parsePaymentQr('https://plentypay.app/t/a/b/c').rejection, QrRejection.malformed);
    });

    test('un contenido vacío o arbitrario se rechaza sin lanzar', () {
      for (final raw in ['', '   ', 'hola', '://', 'https://']) {
        final r = parsePaymentQr(raw);
        expect(r.isAccepted, isFalse, reason: raw);
        expect(r.message, isNotNull, reason: raw);
      }
    });

    test('el mensaje de rechazo no incluye el código escaneado', () {
      final r = parsePaymentQr('https://plentypay.app/t/ABC');
      expect(r.message ?? '', isNot(contains('ABC')));
    });

    test('la lista de hosts es configurable por flavor', () {
      const devHosts = {'10.0.2.2'};
      final r = parsePaymentQr('https://10.0.2.2/t/ABCD1234', allowedHosts: devHosts);
      expect(r.isAccepted, isTrue);
      // Y el host de producción deja de valer en ese flavor.
      expect(parsePaymentQr('https://plentypay.app/t/ABCD1234', allowedHosts: devHosts).isAccepted, isFalse);
    });
  });

  group('F23.2 NFC NDEF', () {
    test('acepta un URI con el mismo formato que el QR', () {
      final r = parseNdefUri('https://plentypay.app/t/ABCD1234');
      expect(r.isAccepted, isTrue);
    });

    test('rechaza un NDEF que no es URI de cobro', () {
      expect(parseNdefUri('https://banco.example/pagar/1234').isAccepted, isFalse);
      expect(parseNdefUri('mibank://pay/ABCD1234').isAccepted, isFalse);
    });

    test('escribe un registro URI bien formado', () {
      final rec = buildNdefUri('ABCD1234');
      expect(rec.type, 'uri');
      expect(rec.payload, 'https://plentypay.app/t/ABCD1234');
    });

    test('no escribe un código inválido', () {
      expect(() => buildNdefUri('corto'), throwsArgumentError);
      expect(() => buildNdefUri(r'ABC$1234'), throwsArgumentError);
    });

    test('lo que se escribe se puede volver a leer', () {
      final written = buildNdefUri('ABCD1234');
      final read = parseNdefUri(written.payload);
      expect(read.isAccepted, isTrue);
      expect(read.link!.code, 'ABCD1234');
    });
  });

  group('F23.4 estado de pago', () {
    test('UNKNOWN no se muestra como fallo', () {
      final display = paymentDisplayFor('UNKNOWN');
      expect(display, PaymentDisplay.unknown);
      expect(display.isDefinitiveFailure, isFalse,
          reason: 'mostrar "falló" haría creer al usuario que perdió el dinero');
      expect(display.isStillConfirming, isTrue);
    });

    test('un estado desconocido se degrada a unknown, no a fallo', () {
      for (final status in ['WAT', null, '', 'algo_raro']) {
        expect(paymentDisplayFor(status), PaymentDisplay.unknown, reason: '$status');
      }
      expect(paymentDisplayFor('WAT').isDefinitiveFailure, isFalse);
    });

    test('los estados terminales se mapean bien', () {
      expect(paymentDisplayFor('CAPTURED'), PaymentDisplay.captured);
      expect(paymentDisplayFor('FAILED'), PaymentDisplay.failed);
      expect(paymentDisplayFor('REFUNDED'), PaymentDisplay.refunded);
      expect(paymentDisplayFor('PENDING'), PaymentDisplay.pending);
    });

    test('solo un fallo definitivo marca isDefinitiveFailure', () {
      expect(PaymentDisplay.failed.isDefinitiveFailure, isTrue);
      for (final d in [
        PaymentDisplay.pending,
        PaymentDisplay.unknown,
        PaymentDisplay.captured,
        PaymentDisplay.refunded,
        PaymentDisplay.unsupported,
      ]) {
        expect(d.isDefinitiveFailure, isFalse, reason: '$d');
      }
    });
  });

  group('F23.3 biometría y step-up', () {
    test('la biometría se pide siempre que el dispositivo la tenga', () {
      const policy = StepUpPolicy(minorThreshold: 50000, biometricAvailable: true);
      expect(policy.requiresBiometric(1), isTrue);
      expect(policy.requiresBiometric(1000000), isTrue);
    });

    test('sin biometría enrolada no se pide', () {
      const policy = StepUpPolicy(minorThreshold: 50000, biometricAvailable: false);
      expect(policy.requiresBiometric(1000000), isFalse);
    });

    test('el step-up se pide al alcanzar el umbral', () {
      const policy = StepUpPolicy(minorThreshold: 50000, biometricAvailable: true);
      expect(policy.requiresStepUp(49999), isFalse);
      expect(policy.requiresStepUp(50000), isTrue, reason: 'el umbral es inclusivo');
      expect(policy.requiresStepUp(50001), isTrue);
    });

    test('con umbral cero todo pago exige step-up', () {
      const policy = StepUpPolicy(minorThreshold: 0, biometricAvailable: true);
      expect(policy.requiresStepUp(0), isTrue);
      expect(policy.requiresStepUp(1), isTrue);
    });

    test('el umbral viene por configuración, no del código', () {
      // El mismo importe cambia de política según el umbral que declara el negocio.
      const bajo = StepUpPolicy(minorThreshold: 100, biometricAvailable: true);
      const alto = StepUpPolicy(minorThreshold: 100000, biometricAvailable: true);
      expect(bajo.requiresStepUp(5000), isTrue);
      expect(alto.requiresStepUp(5000), isFalse);
    });
  });
}