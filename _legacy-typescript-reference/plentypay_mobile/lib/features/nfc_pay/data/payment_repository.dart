import 'package:uuid/uuid.dart';

import '../../../core/network/api_client.dart';

class TerminalInfo {
  const TerminalInfo({required this.publicCode, required this.label, required this.merchantName, required this.isActive});
  final String publicCode;
  final String label;
  final String merchantName; // nombre VERIFICADO por el servidor — es lo que se muestra antes de pagar
  final bool isActive;

  factory TerminalInfo.fromJson(Map<String, dynamic> json) => TerminalInfo(
        publicCode: json['publicCode'] as String,
        label: json['label'] as String? ?? '',
        merchantName: json['merchantName'] as String? ?? 'Comercio',
        isActive: json['isActive'] as bool? ?? true,
      );
}

class PaymentResult {
  const PaymentResult({
    required this.transactionId,
    required this.status,
    required this.sandbox,
    this.nextActionUrl,
    this.nextActionQrPayload,
    this.failureReason,
  });
  final String transactionId;
  final String status;

  /// true = el riel respondió en MODO SIMULADO (sin credenciales reales): NO se movió dinero real.
  final bool sandbox;
  final String? nextActionUrl;
  final String? nextActionQrPayload;
  final String? failureReason;

  factory PaymentResult.fromJson(Map<String, dynamic> json) => PaymentResult(
        transactionId: json['transactionId'] as String,
        status: json['status'] as String,
        sandbox: json['sandbox'] as bool? ?? false,
        nextActionUrl: _nullIfEmpty(json['nextActionUrl']),
        nextActionQrPayload: _nullIfEmpty(json['nextActionQrPayload']),
        failureReason: _nullIfEmpty(json['failureReason']),
      );

  static String? _nullIfEmpty(Object? v) {
    final s = v?.toString();
    return (s == null || s.isEmpty) ? null : s;
  }
}

class PaymentRepository {
  PaymentRepository({required ApiClient apiClient}) : _apiClient = apiClient;
  final ApiClient _apiClient;
  static const _uuid = Uuid();

  /// Cada operación de cobro necesita una clave nueva; reintentar la MISMA operación (misma
  /// terminal, monto y riel) debe reutilizar la misma clave — así un reintento por mala red
  /// nunca cobra dos veces.
  String newIdempotencyKey() => _uuid.v4();

  Future<TerminalInfo> resolveTerminal(String publicCode) async {
    final response = await _apiClient.dio.get('/api/mobile/v1/terminals/$publicCode');
    return TerminalInfo.fromJson(response.data as Map<String, dynamic>);
  }

  Future<TerminalInfo> createTerminal(String label) async {
    final response = await _apiClient.dio.post('/api/mobile/v1/terminals', data: {'label': label});
    return TerminalInfo.fromJson(response.data as Map<String, dynamic>);
  }

  Future<PaymentResult> pay({
    required String terminalCode,
    required int amountCents,
    required String rail,
    required String idempotencyKey,
  }) async {
    final response = await _apiClient.dio.post('/api/mobile/v1/payments', data: {
      'terminalCode': terminalCode,
      'amountCents': amountCents,
      'rail': rail,
      'idempotencyKey': idempotencyKey,
    });
    return PaymentResult.fromJson(response.data as Map<String, dynamic>);
  }

  Future<PaymentResult> status(String transactionId) async {
    final response = await _apiClient.dio.get('/api/mobile/v1/payments/$transactionId');
    return PaymentResult.fromJson(response.data as Map<String, dynamic>);
  }
}
