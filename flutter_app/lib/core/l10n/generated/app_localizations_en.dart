// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'PlentyPay';

  @override
  String get loginTitle => 'Sign in';

  @override
  String get registerTitle => 'Create your account';

  @override
  String get fieldFullName => 'Full name';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldPassword => 'Password';

  @override
  String get passwordHelper => 'At least 12 characters';

  @override
  String get actionSignIn => 'Sign in';

  @override
  String get actionCreateAccount => 'Create account';

  @override
  String get actionHaveAccount => 'I already have an account';

  @override
  String get actionWantAccount => 'Create an account';

  @override
  String get actionRetry => 'Retry';

  @override
  String get actionSignOut => 'Sign out';

  @override
  String get error_INVALID_CREDENTIALS => 'Wrong email or password.';

  @override
  String get error_ACCOUNT_LOCKED =>
      'Account temporarily locked. Try again later.';

  @override
  String get error_REGISTRATION_REJECTED =>
      'We couldn\'t create the account. Check your details.';

  @override
  String get error_IDENTITY_UNAVAILABLE =>
      'Service unavailable. Try again in a few minutes.';

  @override
  String errorGeneric(String reason) {
    return 'Something went wrong ($reason).';
  }

  @override
  String get errorNoConnection => 'Can\'t reach the server.';

  @override
  String get shellMenuLoadFailed => 'We couldn\'t load your menu.';

  @override
  String get navHome => 'Home';

  @override
  String homeModuleCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'You have access to $count modules.',
      one: 'You have access to 1 module.',
      zero: 'You don\'t have any modules yet.',
    );
    return '$_temp0';
  }

  @override
  String moduleScreensIn(String phase) {
    return 'Screens in $phase';
  }

  @override
  String moduleComingSoon(String phase) {
    return 'Coming soon ($phase)';
  }

  @override
  String get moduleWallet => 'Wallet';

  @override
  String get moduleMarketplace => 'Shop';

  @override
  String get modulePos => 'Register';

  @override
  String get moduleCatalog => 'Products';

  @override
  String get moduleInventory => 'Inventory';

  @override
  String get moduleOrders => 'Orders';

  @override
  String get moduleLogistics => 'Deliveries';

  @override
  String get moduleFinance => 'Finance';

  @override
  String get modulePayroll => 'Team';

  @override
  String get moduleAnalytics => 'Analytics';

  @override
  String get moduleAdmin => 'My business';

  @override
  String get modulePlatform => 'Platform';

  @override
  String get passwordHelperRegister => 'Use at least 12 characters.';

  @override
  String get passwordHelperRegisterOk => 'Valid length.';

  @override
  String get consentAge => 'I am 18 or older.';

  @override
  String get consentTerms => 'I accept the Terms and Conditions.';

  @override
  String get consentPrivacy =>
      'I have read the Privacy Policy and authorize the processing of my data to create and operate my account.';

  @override
  String get consentMarketing => 'I want to receive news and offers.';

  @override
  String get registerDataNotice =>
      'We process your data according to our Privacy Policy.';

  @override
  String get error_EMAIL_TAKEN => 'An account with this email already exists.';

  @override
  String get error_WEAK_PASSWORD => 'Choose a less common password.';

  @override
  String get error_INVALID_EMAIL => 'Enter a valid email address.';

  @override
  String get error_CONSENT_REQUIRED =>
      'You must accept the Terms and Conditions and the Privacy Policy.';

  @override
  String get error_AGE_REQUIREMENT =>
      'You must confirm that you are at least 18 years old.';
}
