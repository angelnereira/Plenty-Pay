import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/sync/deep_links.dart';

void main() {
  /// F22.3: cada prefijo abre su pantalla.
  test('F22_3 cada prefijo de ruta abre su pantalla', () {
    final cases = {
      'https://plentypay.app/t/ABC123': (DeepLinkKind.payment, 'ABC123'),
      'https://plentypay.app/track/TRK9': (DeepLinkKind.tracking, 'TRK9'),
      'https://plentypay.app/invite/INV7': (DeepLinkKind.invite, 'INV7'),
      'https://plentypay.app/reset/RS4': (DeepLinkKind.passwordReset, 'RS4'),
    };
    cases.forEach((url, expected) {
      final link = parseDeepLink(Uri.parse(url));
      expect(link.kind, expected.$1, reason: url);
      expect(link.code, expected.$2, reason: url);
    });
  });

  /// F22.3: el esquema propio de la app también vale.
  test('F22_3 el esquema propio de la app es valido', () {
    final link = parseDeepLink(Uri.parse('plentypay://t/ABC123'));
    expect(link.kind, DeepLinkKind.payment);
    expect(link.code, 'ABC123');
  });

  /// F22.3: un host ajeno no es un deep link — no se adivina.
  test('F22_3 un host ajeno se rechaza', () {
    for (final url in [
      'https://evil.com/t/ABC123',
      'https://plentypay.app.evil.com/t/ABC123',
      'https://phishing-plentypay.app/t/ABC123',
    ]) {
      final link = parseDeepLink(Uri.parse(url));
      expect(link.isSupported, isFalse, reason: url);
    }
  });

  /// F22.3: `http://` no se acepta aunque el host sea válido.
  test('F22_3 el esquema http se rechaza', () {
    final link = parseDeepLink(Uri.parse('http://plentypay.app/t/ABC123'));
    expect(link.isSupported, isFalse);
  });

  /// F22.3: el host de desarrollo solo se acepta en desarrollo.
  test('F22_3 el host de desarrollo es condicional', () {
    final url = 'http://10.0.2.2:8080/t/ABC123';
    expect(parseDeepLink(Uri.parse(url)).isSupported, isFalse,
        reason: 'sin allowDevHosts');
    expect(
      parseDeepLink(Uri.parse(url), allowDevHosts: true).kind,
      DeepLinkKind.payment,
    );
  });

  /// F22.3: una ruta desconocida o sin código no abre una pantalla vacía.
  test('F22_3 una ruta sin codigo se marca no soportada', () {
    for (final url in [
      'https://plentypay.app/t/',
      'https://plentypay.app/desconocido/x'
    ]) {
      expect(parseDeepLink(Uri.parse(url)).isSupported, isFalse, reason: url);
    }
  });

  /// F22.3: los parámetros de consulta viajan, no el código en claro.
  test('F22_3 los parametros de consulta se conservan', () {
    final link = parseDeepLink(
        Uri.parse('https://plentypay.app/t/ABC123?ref=carta&v=2'));
    expect(link.query['ref'], 'carta');
    expect(link.query['v'], '2');
  });

  /// F22.4: la actualización es forzada cuando la app es más vieja que el mínimo.
  test('F22_4 actualizacion forzada por version minima', () {
    const gate = UpdateGate(currentVersion: '1.9.0', minimumVersion: '1.10.0');
    expect(gate.isForced, isTrue);

    const ok = UpdateGate(currentVersion: '1.10.0', minimumVersion: '1.10.0');
    expect(ok.isForced, isFalse);

    const newer = UpdateGate(currentVersion: '2.0.0', minimumVersion: '1.10.0');
    expect(newer.isForced, isFalse);
  });

  /// F22.4: sin mínimo declarado no hay bloqueo.
  test('F22_4 sin version minima no hay bloqueo', () {
    const gate = UpdateGate(currentVersion: '0.1.0', minimumVersion: '');
    expect(gate.isForced, isFalse);
  });

  /// F22.4: la comparación de versiones es numérica, no lexicográfica.
  test('F22_4 la comparacion de versiones es numerica', () {
    expect(isOlderThan('1.9.9', '1.10.0'), isTrue,
        reason: '9 y 10 se comparan como números, no como cadenas');
    expect(isOlderThan('1.10.0', '1.9.9'), isFalse);
    expect(isOlderThan('1.0', '1.0.0'), isFalse,
        reason: 'un segmento faltante es 0');
    expect(isOlderThan('1.2.3+build9', '1.2.4'), isTrue,
        reason: 'el sufijo no cuenta');
    expect(isOlderThan('1.2.3-beta1', '1.2.3'), isFalse);
  });

  /// F22.4: la configuración del cliente se lee del JSON del servidor.
  test('F22_4 ClientConfig desde JSON', () {
    final config = ClientConfig.fromJson({
      'minimum_app_version': '1.10.0',
      'maintenance_mode': true,
      'message': 'Estamos Actualizando el sistema.',
    });
    expect(config.minimumAppVersion, '1.10.0');
    expect(config.maintenanceMode, isTrue);
    expect(config.message, 'Estamos Actualizando el sistema.');
  });

  test('F22_4 ClientConfig tolera campos ausentes', () {
    final config = ClientConfig.fromJson({});
    expect(config.minimumAppVersion, isEmpty);
    expect(config.maintenanceMode, isFalse);
    expect(config.message, isNull);
  });

  /// F22.4: el JSON no filtra campos técnicos al mensaje de la UI.
  test('F22_4 el JSON omite el mensaje cuando no hay', () {
    final config =
        const ClientConfig(minimumAppVersion: '1.0.0', maintenanceMode: false);
    expect(config.toJson().contains('message'), isFalse);
  });
}
