import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/core/observability/app_logger.dart';
import 'package:plentypay/core/session/session_store.dart';

/// Almacenamiento cuyo contenido ya no se puede descifrar (copia de seguridad restaurada sin la
/// llave del Keystore): toda lectura lanza BadPaddingException como PlatformException.
class _UnreadableStorage extends FlutterSecureStorage {
  _UnreadableStorage();
  bool wiped = false;

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (wiped) return null;
    throw PlatformException(
        code: 'Exception encountered',
        message: 'javax.crypto.BadPaddingException: BAD_DECRYPT');
  }

  @override
  Future<void> deleteAll({
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    wiped = true;
  }
}

class _Capture implements TelemetrySink {
  final records = <TelemetryRecord>[];
  @override
  void add(TelemetryRecord record) => records.add(record);
}

void main() {
  // Pantalla negra de v0.3.x: una lectura ilegible antes de runApp detenía el arranque.
  test(
      'TestObs: almacenamiento ilegible no rompe el arranque; se registra y se borra',
      () async {
    final storage = _UnreadableStorage();
    final sink = _Capture();
    final session = SessionStore(storage, AppLogger(sinks: [sink]));
    expect(await session.customBaseUrl(), isNull);
    expect(storage.wiped, isTrue);
    expect(await session.accessToken(), isNull,
        reason: 'tras borrar, la persona vuelve a entrar');
    final record = sink.records.single.toJson();
    expect(record['msg'], 'secure storage unreadable');
    expect('$record', isNot(contains('pp_access_token')));
  });
}
