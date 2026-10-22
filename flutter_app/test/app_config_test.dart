import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/config/app_config.dart';

void main() {
  test('prod rechaza http', () {
    expect(
      () => AppConfig.resolve(flavor: 'prod', apiBaseUrl: 'http://api.plentypay.app'),
      throwsStateError,
    );
  });

  test('staging rechaza http', () {
    expect(
      () => AppConfig.resolve(flavor: 'staging', apiBaseUrl: 'http://staging.plentypay.app'),
      throwsStateError,
    );
  });

  test('prod y staging aceptan https', () {
    final prod = AppConfig.resolve(flavor: 'prod', apiBaseUrl: 'https://api.plentypay.app');
    expect(prod.flavor, Flavor.prod);
    expect(prod.apiBaseUrl, 'https://api.plentypay.app');
    expect(AppConfig.resolve(flavor: 'staging', apiBaseUrl: 'https://s.plentypay.app').flavor, Flavor.staging);
  });

  test('dev permite http contra el gateway local', () {
    final dev = AppConfig.resolve(flavor: 'dev', apiBaseUrl: 'http://localhost:8080');
    expect(dev.flavor, Flavor.dev);
    expect(dev.apiBaseUrl, 'http://localhost:8080');
  });

  // ADR 0019 §7: ninguna URL de túnel incrustada (caduca); la vigente la da el descubrimiento.
  test('sin dart-define arranca en dev contra el gateway local, nunca un túnel incrustado', () {
    final config = AppConfig.fromEnvironment();
    expect(config.flavor, Flavor.dev);
    expect(config.apiBaseUrl, 'http://localhost:8080');
    expect(config.apiBaseUrl, isNot(contains('trycloudflare')));
  });

  test('flavor desconocido falla al arrancar', () {
    expect(() => AppConfig.resolve(flavor: 'qa', apiBaseUrl: 'https://x.test'), throwsStateError);
  });

  test('URL inválida o con otro esquema falla al arrancar', () {
    expect(() => AppConfig.resolve(flavor: 'dev', apiBaseUrl: ''), throwsStateError);
    expect(() => AppConfig.resolve(flavor: 'dev', apiBaseUrl: 'ftp://localhost'), throwsStateError);
    expect(() => AppConfig.resolve(flavor: 'prod', apiBaseUrl: 'api.plentypay.app'), throwsStateError);
  });

  test('la barra final de la URL se normaliza', () {
    expect(AppConfig.resolve(flavor: 'dev', apiBaseUrl: 'http://localhost:8080/').apiBaseUrl, 'http://localhost:8080');
  });
}
