import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/l10n/generated/app_localizations.dart';
import 'package:plentypay/core/session/session_store.dart';
import 'package:plentypay/core/theme/app_theme.dart';
import 'package:plentypay/features/business/business_dashboard_screen.dart';
import 'package:plentypay/features/business/modules_screen.dart';
import 'package:plentypay/features/business/role_editor_screen.dart';
import 'package:plentypay/features/business/roles_screen.dart';
import 'package:plentypay/features/business/team_screen.dart';
import 'package:plentypay/features/invitations/accept_invitation_screen.dart';

/// Respuestas del gateway con la forma del contrato (identity.proto vía protojson). Solo existen
/// en esta prueba: la app real habla con api-gateway.
final _fixtures = <String, Object>{
  'GET /v1/me': {'user_id': 'u-owner', 'tenant_id': 't1', 'role': 'BUSINESS_OWNER'},
  'GET /v1/business/staff': {
    'users': [
      {'user_id': 'u-owner', 'email': 'duena@negocio.pa', 'full_name': 'Ana Dueña', 'role': 'BUSINESS_OWNER', 'status': 'ACTIVE', 'scope': 'TENANT', 'branch_ids': [], 'role_id': '', 'job_title': ''},
      {'user_id': 'u-cajera', 'email': 'cajera@negocio.pa', 'full_name': 'Luz Cajera', 'role': 'BUSINESS_STAFF', 'status': 'SUSPENDED', 'scope': 'BRANCHES', 'branch_ids': ['b2'], 'role_id': 'r-caja', 'job_title': 'Cajera principal'},
    ],
  },
  'GET /v1/business/invitations': {
    'invitations': [
      {'invitation_id': 'i1', 'email': 'nuevo@negocio.pa', 'role_id': 'r-caja', 'scope': 'TENANT', 'branch_ids': [], 'status': 'PENDING', 'expires_at': '2026-10-27T15:00:00Z'},
    ],
  },
  'GET /v1/business/roles': {
    'roles': [
      {'role_id': 'r-cashier', 'name': 'cashier', 'system': true, 'permissions': ['pos:sell']},
      {'role_id': 'r-caja', 'name': 'Caja nocturna', 'system': false, 'permissions': ['pos:sell', 'pos:read'], 'member_count': 1, 'template_key': 'cashier'},
    ],
  },
  'GET /v1/business/branches': {
    'branches': [
      {'branch_id': 'b1', 'code': '0000', 'name': 'Casa Matriz', 'address': 'Calle 50', 'active': true},
      {'branch_id': 'b2', 'code': '0001', 'name': 'Colón', 'address': '', 'active': false},
    ],
  },
  'GET /v1/business/t1': {'tenant_id': 't1', 'legal_name': 'Barbería El Corte S.A.', 'trade_name': 'El Corte', 'tax_id': '155612345-2-2023', 'dv': '45', 'status': 'TENANT_STATUS_ACTIVE'},
  'GET /v1/business/profile': {
    'tenant_id': 't1',
    'primary_vertical': 'services_appointments',
    'secondary_verticals': ['retail'],
    'plan_code': 'standard',
    'capabilities': [
      {'capability': 'pos.counter', 'enabled': true, 'source': 'VERTICAL'},
      {'capability': 'appointments.queue', 'enabled': true, 'source': 'VERTICAL'},
    ],
  },
  'GET /v1/access/catalog': {
    'module_order': ['pos', 'appointments', 'payroll'],
    'capabilities': [
      {'key': 'pos.counter', 'module': 'pos', 'gated': false},
      {'key': 'pos.tables', 'module': 'pos', 'gated': false},
      {'key': 'appointments.queue', 'module': 'appointments', 'gated': false},
      {'key': 'payroll.commissions', 'module': 'payroll', 'gated': true, 'open_question': 'Q-32'},
    ],
    'permissions': [
      {'key': 'pos:sell', 'module': 'pos', 'level': 'OPERATE', 'capability': 'pos.counter', 'money': false},
      {'key': 'pos:refund', 'module': 'pos', 'level': 'APPROVE', 'capability': 'pos.counter', 'money': true},
      {'key': 'pos:table:manage', 'module': 'pos', 'level': 'OPERATE', 'capability': 'pos.tables', 'money': false},
      {'key': 'catalog:read', 'module': 'catalog', 'level': 'VIEW', 'capability': '', 'money': false},
      {'key': 'platform:support', 'module': 'platform', 'level': 'VIEW', 'capability': '', 'platform': true},
    ],
  },
  'GET /v1/role-templates': {
    'templates': [
      {'key': 'stylist', 'universal': false, 'permissions': ['appointments:checkin']},
    ],
  },
};

class _Server {
  _Server([this.overrides = const {}]);
  final Map<String, Object> overrides;
  final requests = <http.Request>[];

  ApiClient client() => ApiClient(
        baseUrl: 'http://gateway.test',
        session: SessionStore(),
        client: MockClient((req) async {
          requests.add(req);
          final key = '${req.method} ${req.url.path}';
          final body = overrides[key] ?? _fixtures[key] ?? (req.method == 'GET' ? <String, Object>{} : {'success': true});
          return http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json'});
        }),
      );
}

Widget _host(Widget child, {Brightness brightness = Brightness.light, double textScale = 1, Size size = const Size(400, 900)}) => MediaQuery(
      data: MediaQueryData(size: size, textScaler: TextScaler.linear(textScale)),
      child: MaterialApp(
        theme: brightness == Brightness.dark ? AppTheme.dark() : AppTheme.light(),
        locale: const Locale('es', 'PA'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: child,
      ),
    );

Future<void> _pump(WidgetTester tester, Widget screen, {Brightness brightness = Brightness.light, double textScale = 1, Size size = const Size(400, 900)}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(_host(screen, brightness: brightness, textScale: textScale, size: size));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));

  group('S-ADM-02 Equipo', () {
    testWidgets('muestra miembros reales con rol, alcance, cargo y estado; el dueño no se gestiona', (tester) async {
      final server = _Server();
      await _pump(tester, TeamScreen(api: server.client()));
      expect(find.text('Ana Dueña'), findsOneWidget);
      expect(find.text('Luz Cajera'), findsOneWidget);
      expect(find.textContaining('Caja nocturna'), findsOneWidget);
      expect(find.textContaining('1 sucursal'), findsOneWidget);
      expect(find.textContaining('Cajera principal'), findsOneWidget);
      expect(find.text('Suspendido'), findsOneWidget);
      // A2: ni el dueño ni uno mismo tienen menú de acciones; la cajera sí.
      expect(find.byType(PopupMenuButton<String>), findsOneWidget);
      expect(server.requests.where((r) => r.url.path.contains('tenant')), isEmpty, reason: 'el negocio sale del token');
    });

    testWidgets('invitaciones con fecha de vencimiento con el mes en texto (N-STD-10)', (tester) async {
      await _pump(tester, TeamScreen(api: _Server().client()));
      await tester.tap(find.text('Invitaciones'));
      await tester.pumpAndSettle();
      expect(find.text('nuevo@negocio.pa'), findsOneWidget);
      expect(find.textContaining('octubre'), findsOneWidget);
    });

    testWidgets('invitar valida al confirmar y explica qué falta', (tester) async {
      await _pump(tester, TeamScreen(api: _Server().client()));
      await tester.tap(find.byType(FloatingActionButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sucursales específicas'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Invitar'));
      await tester.pumpAndSettle();
      expect(find.text('Escribe un correo válido.'), findsOneWidget);
      expect(find.text('Elige un rol.'), findsOneWidget);
      expect(find.text('Elige al menos una sucursal.'), findsOneWidget);
    });
  });

  group('S-ADM-08 Módulos y funciones', () {
    testWidgets('interruptores por módulo; las bloqueadas por pregunta legal no se encienden', (tester) async {
      await _pump(tester, ModulesScreen(api: _Server().client()));
      expect(find.text('Tipo de negocio: Servicios con cita'), findsOneWidget);
      expect(find.text('Plan: standard'), findsOneWidget);
      final gated = tester.widget<SwitchListTile>(find.byKey(const Key('cap-payroll.commissions')));
      expect(gated.onChanged, isNull);
      expect(find.textContaining('Q-32'), findsOneWidget);
    });

    testWidgets('apagar una función pide confirmación y guarda solo lo cambiado', (tester) async {
      final server = _Server();
      await _pump(tester, ModulesScreen(api: server.client()));
      await tester.tap(find.byKey(const Key('cap-pos.counter')));
      await tester.tap(find.byKey(const Key('cap-pos.tables')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Guardar funciones'));
      await tester.pumpAndSettle();
      expect(find.text('¿Desactivar estas funciones?'), findsOneWidget);
      await tester.tap(find.text('Desactivar'));
      await tester.pumpAndSettle();
      final put = server.requests.singleWhere((r) => r.method == 'PUT' && r.url.path == '/v1/business/capabilities');
      final changes = (jsonDecode(put.body) as Map<String, dynamic>)['changes'] as List<dynamic>;
      expect(changes, unorderedEquals([
        {'capability': 'pos.counter', 'enabled': false},
        {'capability': 'pos.tables', 'enabled': true},
      ]));
    });
  });

  group('S-ADM-03 Roles', () {
    testWidgets('lista roles propios y plantillas; duplicar abre el editor con sus permisos', (tester) async {
      await _pump(tester, RolesScreen(api: _Server().client()));
      expect(find.text('Caja nocturna'), findsOneWidget);
      expect(find.textContaining('1 miembro'), findsOneWidget);
      expect(find.text('Profesional (estilista, barbero)'), findsOneWidget);
      expect(find.text('cashier'), findsNothing, reason: 'los presets se muestran como plantillas, no como roles propios');
    });

    testWidgets('el editor solo ofrece permisos de funciones encendidas, nunca platform:*, y avisa la separación de funciones', (tester) async {
      final server = _Server();
      await _pump(
        tester,
        RoleEditorScreen(
          api: server.client(),
          catalog: [
            for (final p in (_fixtures['GET /v1/access/catalog']! as Map<String, dynamic>)['permissions'] as List<dynamic>)
              if (!((p as Map<String, dynamic>)['platform'] as bool? ?? false)) CatalogPermission.fromJson(p),
          ],
          moduleOrder: const ['pos', 'catalog'],
          enabledCapabilities: const {'pos.counter'},
        ),
      );
      expect(find.byKey(const Key('perm-pos:sell')), findsOneWidget);
      expect(find.byKey(const Key('perm-catalog:read')), findsOneWidget, reason: 'núcleo: siempre disponible');
      expect(find.byKey(const Key('perm-pos:table:manage')), findsNothing, reason: 'pos.tables está apagada');
      expect(find.byKey(const Key('perm-platform:support')), findsNothing);
      await tester.tap(find.byKey(const Key('perm-pos:sell')));
      await tester.tap(find.byKey(const Key('perm-pos:refund')));
      await tester.pumpAndSettle();
      expect(find.text('Este rol reúne funciones que conviene separar.'), findsOneWidget);
      await tester.enterText(find.byType(TextField).first, 'Caja con devoluciones');
      await tester.tap(find.text('Guardar'));
      await tester.pumpAndSettle();
      final post = server.requests.singleWhere((r) => r.method == 'POST' && r.url.path == '/v1/business/roles');
      final role = (jsonDecode(post.body) as Map<String, dynamic>)['role'] as Map<String, dynamic>;
      expect(role['name'], 'Caja con devoluciones');
      expect(role['permissions'], ['pos:refund', 'pos:sell']);
    });
  });

  group('S-ADM-01 Mi negocio', () {
    testWidgets('muestra el negocio real, sus sucursales y su perfil', (tester) async {
      await _pump(tester, BusinessDashboardScreen(api: _Server().client()));
      expect(find.text('El Corte'), findsOneWidget);
      expect(find.textContaining('Barbería El Corte S.A.'), findsOneWidget);
      expect(find.text('Activo'), findsOneWidget);
      expect(find.text('0000 · Casa Matriz'), findsOneWidget);
      expect(find.text('Inactiva'), findsOneWidget);
      expect(find.text('Tipo de negocio: Servicios con cita'), findsOneWidget);
      expect(find.textContaining('Supermercado'), findsNothing, reason: 'sin datos inventados');
    });

    testWidgets('agregar sucursal valida el código DGI', (tester) async {
      await _pump(tester, BusinessDashboardScreen(api: _Server().client()));
      await tester.tap(find.text('Agregar'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, '12');
      await tester.tap(find.widgetWithText(FilledButton, 'Guardar'));
      await tester.pumpAndSettle();
      expect(find.text('Escribe 4 dígitos, por ejemplo 0001.'), findsOneWidget);
      expect(find.text('Escribe el nombre de la sucursal.'), findsOneWidget);
    });
  });

  group('S-GEN-17 Aceptar invitación', () {
    Map<String, Object> preview({bool exists = false, String status = 'PENDING'}) => {
          'POST /v1/invitations/preview': {
            'email': 'nueva@negocio.pa', 'full_name': 'Luz Nueva', 'business_name': 'El Corte', 'role_name': 'stylist',
            'role_system': true, 'scope': 'BRANCHES', 'branch_names': ['Colón'], 'status': status, 'account_exists': exists,
          },
          'POST /v1/invitations/accept': {'success': true, 'access_token': 'a', 'refresh_token': 'r'},
        };

    testWidgets('cuenta nueva: muestra negocio, rol y alcance y exige las aceptaciones (N-DAT-02)', (tester) async {
      final server = _Server(preview());
      var accepted = false;
      await _pump(tester, AcceptInvitationScreen(api: server.client(), token: 'tok-0123456789abcdef', onAccepted: () => accepted = true), size: const Size(400, 1600));
      expect(find.text('El Corte te invita como Profesional (estilista, barbero)'), findsOneWidget);
      expect(find.text('Alcance: Colón'), findsOneWidget);
      await tester.enterText(find.byType(TextField).at(2), 'una-clave-muy-larga');
      await tester.pumpAndSettle();
      final button = find.widgetWithText(FilledButton, 'Aceptar y crear cuenta');
      expect(tester.widget<FilledButton>(button).onPressed, isNull, reason: 'sin edad, términos y privacidad no se crea la cuenta');
      for (var i = 0; i < 3; i++) {
        await tester.tap(find.byType(CheckboxListTile).at(i));
      }
      await tester.pumpAndSettle();
      await tester.tap(button);
      await tester.pumpAndSettle();
      final body = jsonDecode(server.requests.singleWhere((r) => r.url.path == '/v1/invitations/accept').body) as Map<String, dynamic>;
      expect(body['full_name'], 'Luz Nueva');
      expect((body['consents'] as List<dynamic>).where((c) => (c as Map)['granted'] == true).length, 3);
      expect(body.containsKey('email'), isFalse, reason: 'el correo ya está en la invitación');
      expect(accepted, isTrue);
    });

    testWidgets('cuenta existente: solo su contraseña, conserva su billetera (H8)', (tester) async {
      final server = _Server(preview(exists: true));
      await _pump(tester, AcceptInvitationScreen(api: server.client(), token: 'tok-0123456789abcdef'));
      expect(find.textContaining('conservas tu billetera'), findsOneWidget);
      expect(find.byType(CheckboxListTile), findsNothing);
      await tester.enterText(find.byType(TextField).at(1), 'clave-actual-larga');
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(FilledButton, 'Aceptar invitación'));
      await tester.pumpAndSettle();
      final body = jsonDecode(server.requests.singleWhere((r) => r.url.path == '/v1/invitations/accept').body) as Map<String, dynamic>;
      expect(body.containsKey('consents'), isFalse);
    });

    testWidgets('invitación vencida o revocada: mensaje de la ficha, sin formulario', (tester) async {
      await _pump(tester, AcceptInvitationScreen(api: _Server(preview(status: 'EXPIRED')).client(), token: 'tok-0123456789abcdef'));
      expect(find.text('Esta invitación ya no es válida. Pide una nueva a tu negocio.'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
    });
  });

  // gravital-experience-ui §15.3: texto al 200 %, compact y expanded, claro y oscuro, sin desbordes.
  group('gravital §15.3', () {
    final screens = <String, Widget Function(ApiClient)>{
      'equipo': (api) => TeamScreen(api: api),
      'módulos': (api) => ModulesScreen(api: api),
      'roles': (api) => RolesScreen(api: api),
      'mi negocio': (api) => BusinessDashboardScreen(api: api),
    };
    for (final size in const [Size(360, 800), Size(1280, 800)]) {
      testWidgets('aceptar invitación al 200 % en ${size.width.toInt()} dp, oscuro, sin desbordes', (tester) async {
        final server = _Server({
          'POST /v1/invitations/preview': {'email': 'n@negocio.pa', 'business_name': 'El Corte', 'role_name': 'Caja', 'scope': 'TENANT', 'status': 'PENDING'},
        });
        await _pump(tester, AcceptInvitationScreen(api: server.client(), token: 'tok-0123456789abcdef'), brightness: Brightness.dark, textScale: 2, size: size);
        expect(tester.takeException(), isNull);
      });
    }
    for (final entry in screens.entries) {
      for (final size in const [Size(360, 800), Size(1280, 800)]) {
        testWidgets('${entry.key} al 200 % en ${size.width.toInt()} dp, oscuro, sin desbordes', (tester) async {
          await _pump(tester, entry.value(_Server().client()), brightness: Brightness.dark, textScale: 2, size: size);
          expect(tester.takeException(), isNull);
        });
      }
    }
  });
}
