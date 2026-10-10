import 'package:dio/dio.dart';
import '../security/secure_storage_service.dart';

/// Cliente HTTP único de la app. Todas las llamadas a la API de PlentyPay
/// pasan por aquí, nunca por un `Dio()`/`http.get` suelto en una pantalla —
/// así el interceptor de auth y (más adelante) el certificate pinning
/// aplican siempre, sin depender de que cada desarrollador se acuerde.
class ApiClient {
  ApiClient({required String baseUrl, required SecureStorageService secureStorage})
      : _secureStorage = secureStorage,
        dio = Dio(BaseOptions(baseUrl: baseUrl, connectTimeout: const Duration(seconds: 10))) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.readAuthToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          // TODO: si error.response?.statusCode == 401, intentar refresh token
          // y reintentar una vez antes de forzar logout. No implementado en
          // este scaffold para no fabricar un flujo de refresh que el backend
          // todavía no expone (ver MIGRATION_STATUS.md).
          handler.next(error);
        },
      ),
    );

    // TODO(producción, "nivel bancario"): certificate pinning real.
    // dio no lo trae integrado — se hace a nivel del HttpClient subyacente,
    // por ejemplo con el paquete `http_certificate_pinning` o fijando el
    // `SecurityContext`/`badCertificateCallback` con el hash SPKI del
    // certificado real de producción. Deliberadamente NO se hardcodea un
    // hash de ejemplo aquí — un pin equivocado deja la app sin poder conectar
    // a NADA, así que esto se agrega cuando exista el certificado real de
    // api.plentypay.com, no antes.
  }

  final Dio dio;
  final SecureStorageService _secureStorage;
}
