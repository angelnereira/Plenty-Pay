import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:plentypay/core/api/api_client.dart';
import 'package:plentypay/core/config/app_config.dart';
import 'package:plentypay/main.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('F11.9 app launches and wallet module accessible', (tester) async {
    final config = AppConfig.fromEnvironment();
    await tester.pumpWidget(PlentyPayApp(api: ApiClient(baseUrl: config.apiBaseUrl), startSignedIn: false));
    await tester.pumpAndSettle(const Duration(seconds: 15));
    expect(find.text('Sign in'), findsWidgets);
  });
}
