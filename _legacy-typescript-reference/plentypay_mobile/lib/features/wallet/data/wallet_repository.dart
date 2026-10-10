import '../../../core/network/api_client.dart';

class WalletBalance {
  final String currency;
  final int availableCents;
  final int heldCents;
  final int pendingSettlementCents;

  const WalletBalance({
    required this.currency,
    required this.availableCents,
    required this.heldCents,
    required this.pendingSettlementCents,
  });

  factory WalletBalance.fromJson(Map<String, dynamic> json) => WalletBalance(
        currency: json['currency'] as String? ?? 'USD',
        availableCents: int.tryParse(json['availableCents']?.toString() ?? '0') ?? 0,
        heldCents: int.tryParse(json['heldCents']?.toString() ?? '0') ?? 0,
        pendingSettlementCents: int.tryParse(json['pendingSettlementCents']?.toString() ?? '0') ?? 0,
      );

  static const empty = WalletBalance(currency: 'USD', availableCents: 0, heldCents: 0, pendingSettlementCents: 0);
}

class WalletRepository {
  WalletRepository({required ApiClient apiClient}) : _apiClient = apiClient;
  final ApiClient _apiClient;

  Future<WalletBalance> getBalance() async {
    final response = await _apiClient.dio.get('/api/mobile/v1/wallet/balance');
    return WalletBalance.fromJson(response.data as Map<String, dynamic>);
  }
}
