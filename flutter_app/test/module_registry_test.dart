import 'package:flutter_test/flutter_test.dart';
import 'package:plentypay/features/modules/module_registry.dart';

void main() {
  test('R10 cliente: CUSTOMER ve billetera y comprar, en orden de registro', () {
    final ids = visibleModules(['marketplace', 'wallet']).map((m) => m.id).toList();
    expect(ids, ['wallet', 'marketplace']);
  });

  test('ids desconocidos del servidor se ignoran', () {
    final ids = visibleModules(['wallet', 'modulo-del-futuro']).map((m) => m.id).toList();
    expect(ids, ['wallet']);
  });

  test('sin módulos habilitados no hay navegación', () {
    expect(visibleModules(const []), isEmpty);
  });

  test('el registro coincide con identity (12 módulos, ids únicos)', () {
    final ids = moduleRegistry.map((m) => m.id).toList();
    expect(ids.length, 12);
    expect(ids.toSet().length, 12);
  });
}
