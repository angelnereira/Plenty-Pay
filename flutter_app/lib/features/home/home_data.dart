import '../../core/api/api_client.dart';
import '../fiscal/fiscal_data.dart' show loadFiscalProfile;

// Datos de las tarjetas de Inicio (S-GEN-05). Cada tarjeta carga por separado: si un servicio falla,
// las demás se muestran igual. Todos los montos son centavos enteros (ADR 0013).

int _int(Object? v) => v is num ? v.toInt() : int.tryParse('${v ?? ''}') ?? 0;

/// e3: un pendiente a la vez, por prioridad.
enum HomePending {
  businessRejected,
  businessSuspended,
  businessReview,
  fiscalProfile
}

/// e5: ventas cobradas desde el inicio del día en Panamá.
class HomeSales {
  const HomeSales({required this.count, required this.totalMinor});
  final int count;
  final int totalMinor;
}

/// e6: sub-pedidos esperando que el comercio los acepte y el plazo más cercano.
class HomePendingOrders {
  const HomePendingOrders({required this.count, this.nextDeadline});
  final int count;
  final DateTime? nextDeadline;
}

/// e8: una alerta con su cantidad.
enum HomeAlertKind { lowStock, foliosLow }

class HomeAlert {
  const HomeAlert(this.kind, this.count);
  final HomeAlertKind kind;
  final int count;
}

/// Inicio del día en Panamá (UTC−5, sin horario de verano; domain-model §10.2), en UTC.
DateTime panamaDayStart(DateTime now) {
  final p = now.toUtc().subtract(const Duration(hours: 5));
  return DateTime.utc(p.year, p.month, p.day, 5);
}

/// e3. El estado del negocio manda sobre el perfil fiscal.
Future<HomePending?> loadHomePending(
    ApiClient api, Me me, Permissions perms) async {
  if (me.tenantId.isEmpty) return null;
  final tenant = await api.getTenant(me.tenantId);
  switch (
      (tenant['status'] as String? ?? '').replaceFirst('TENANT_STATUS_', '')) {
    case 'REJECTED':
      return HomePending.businessRejected;
    case 'SUSPENDED':
      return HomePending.businessSuspended;
    case 'PENDING_REVIEW':
      return HomePending.businessReview;
  }
  if (perms.can('fiscal:profile:manage') &&
      await loadFiscalProfile(api) == null) {
    return HomePending.fiscalProfile;
  }
  return null;
}

/// e5. Suma las ventas pagadas de hoy, página por página.
Future<HomeSales> loadTodaySales(ApiClient api, DateTime now) async {
  var count = 0, total = 0;
  var token = '';
  for (var page = 0; page < 20; page++) {
    final j = await api.listSales(
        status: 'SALE_STATUS_PAID',
        from: panamaDayStart(now),
        pageToken: token);
    for (final s in (j['sales'] as List<dynamic>? ?? const [])) {
      final sale = s as Map<String, dynamic>;
      count++;
      total += _int((sale['total'] as Map<String, dynamic>?)?['amount_minor']);
    }
    token =
        (j['page'] as Map<String, dynamic>?)?['next_page_token'] as String? ??
            '';
    if (token.isEmpty) break;
  }
  return HomeSales(count: count, totalMinor: total);
}

/// e6.
Future<HomePendingOrders> loadPendingOrders(ApiClient api) async {
  final j =
      await api.merchantOrders(status: 'SUB_ORDER_STATUS_AWAITING_ACCEPTANCE');
  final subs = (j['sub_orders'] as List<dynamic>? ?? const []);
  DateTime? next;
  for (final s in subs) {
    final d = DateTime.tryParse(
        (s as Map<String, dynamic>)['acceptance_deadline'] as String? ?? '');
    if (d != null && (next == null || d.isBefore(next))) next = d;
  }
  return HomePendingOrders(count: subs.length, nextDeadline: next);
}

/// e8: existencias bajas y folios por agotarse, según lo que la persona puede ver.
Future<List<HomeAlert>> loadHomeAlerts(ApiClient api, Permissions perms,
    {required bool inventory, required bool finance}) async {
  final out = <HomeAlert>[];
  if (inventory && perms.can('inventory:read')) {
    final j = await api.listStock(onlyLow: true);
    final n = (j['levels'] as List<dynamic>? ?? const []).length;
    if (n > 0) out.add(HomeAlert(HomeAlertKind.lowStock, n));
  }
  if (finance && perms.can('fiscal:read')) {
    try {
      final f = await api.getFolioStatus();
      final remaining = _int(f['remaining']);
      final low = _int(f['low_watermark']);
      if (remaining >= 0 && low > 0 && remaining < low) {
        out.add(HomeAlert(HomeAlertKind.foliosLow, remaining));
      }
    } on ApiException catch (e) {
      // Sin perfil: lo dice e3, no es una alerta.
      if (e.reason != 'PROFILE_MISSING') rethrow;
    }
  }
  return out;
}
