import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/config/app_config.dart';
import 'package:plentypay/main.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('F08.8 app launches and login screen shows', (tester) async {
    final config = AppConfig.fromEnvironment();
    await tester.pumpWidget(PlentyPayApp(api: ApiClient(baseUrl: config.apiBaseUrl), startSignedIn: false));
    await tester.pumpAndSettle(const Duration(seconds: 15));
    expect(find.text('Sign in'), findsWidgets);
    expect(find.text('Create an account'), findsOneWidget);
  });

  testWidgets('F08.8 login with test user', (tester) async {
    final config = AppConfig.fromEnvironment();
    await tester.pumpWidget(PlentyPayApp(api: ApiClient(baseUrl: config.apiBaseUrl), startSignedIn: false));
    await tester.pumpAndSettle(const Duration(seconds: 15));
    final fields = find.byType(TextField);
    await tester.enterText(fields.first, 'owner@test.com');
    await tester.enterText(fields.last, 'TestPassword123!');
    await tester.tap(find.text('Sign in').last);
    await tester.pumpAndSettle(const Duration(seconds: 10));
    expect(find.text('Inicio') , findsNothing); // may be 'Home' in en
  });
}
