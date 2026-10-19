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

  @override
  String get accountTitle => 'My account';

  @override
  String get profileTitle => 'Personal data';

  @override
  String get sessionsTitle => 'Active sessions';

  @override
  String get businessTitle => 'My business';

  @override
  String get createBusinessTitle => 'Create business';

  @override
  String get teamTitle => 'Team';

  @override
  String get rolesTitle => 'Roles';

  @override
  String get platformTitle => 'Platform';

  @override
  String get businessReviewTitle => 'Business review';

  @override
  String get invitationAcceptTitle => 'Accept invitation';

  @override
  String get fieldLegalName => 'Legal name';

  @override
  String get fieldTradeName => 'Trade name';

  @override
  String get fieldTaxId => 'Tax ID';

  @override
  String get fieldDv => 'DV';

  @override
  String get actionCreate => 'Create';

  @override
  String get actionInvite => 'Invite';

  @override
  String get actionDeactivate => 'Deactivate';

  @override
  String get actionRevoke => 'Revoke';

  @override
  String get actionApprove => 'Approve';

  @override
  String get actionReject => 'Reject';

  @override
  String get actionSave => 'Save';

  @override
  String get labelCurrentSession => 'Current session';

  @override
  String get emptySessions => 'No other sessions.';

  @override
  String get emptyTeam => 'No team members yet.';

  @override
  String get emptyRoles => 'No custom roles yet.';

  @override
  String get emptyTenants => 'No businesses pending review.';

  @override
  String get labelStatus => 'Status';

  @override
  String get statusPending => 'Pending';

  @override
  String get statusActive => 'Active';

  @override
  String get statusRejected => 'Rejected';

  @override
  String get statusSuspended => 'Suspended';

  @override
  String get msgBusinessCreated => 'Business created. Under review.';

  @override
  String get msgInvitationSent => 'Invitation sent.';

  @override
  String get msgApproved => 'Business approved.';

  @override
  String get msgRejected => 'Business rejected.';

  @override
  String get fieldNotes => 'Notes';

  @override
  String get fieldEmailInvite => 'Invitee email';

  @override
  String get fieldRole => 'Role';

  @override
  String get fieldCurrentPassword => 'Current password';

  @override
  String get fieldNewPassword => 'New password';

  @override
  String get actionChangePassword => 'Change password';

  @override
  String get msgPasswordChanged => 'Password updated.';

  @override
  String get labelMembers => 'Members';

  @override
  String get labelPermissions => 'Permissions';

  @override
  String get labelRoleName => 'Role name';

  @override
  String get labelRoleId => 'Role id';

  @override
  String get walletTitle => 'Wallet';

  @override
  String get topupTitle => 'Top up';

  @override
  String get sendTitle => 'Send';

  @override
  String get payQrTitle => 'Pay with QR';

  @override
  String get terminalsTitle => 'Terminals';

  @override
  String get fieldAmount => 'Amount';

  @override
  String get actionTopup => 'Top up';

  @override
  String get actionSend => 'Send';

  @override
  String get actionPay => 'Pay';

  @override
  String get msgPaymentCreated => 'Payment created.';

  @override
  String get clockTitle => 'Clock in';

  @override
  String get payrollMyTitle => 'My payroll';

  @override
  String get payrollEmployeesTitle => 'Employees';

  @override
  String get payrollScheduleTitle => 'Shifts and schedule';

  @override
  String get payrollAttendanceTitle => 'Attendance';

  @override
  String get payrollRunsTitle => 'Payroll runs';

  @override
  String get payrollRunDetailTitle => 'Run detail';

  @override
  String get payslipTitle => 'Payslip';

  @override
  String get kioskTitle => 'Clock kiosk';

  @override
  String get tabClockings => 'Clock-ins';

  @override
  String get tabPayslips => 'Payslips';

  @override
  String get tabVacations => 'Vacations';

  @override
  String get actionClockIn => 'Clock in';

  @override
  String get actionStartBreak => 'Start break';

  @override
  String get actionEndBreak => 'End break';

  @override
  String get actionClockOut => 'Clock out';

  @override
  String get methodQr => 'Scan kiosk QR';

  @override
  String get methodNfc => 'Tap NFC tag';

  @override
  String get methodFace => 'Face';

  @override
  String get methodPin => 'PIN';

  @override
  String labelInsideZone(Object branch) {
    return 'You are at $branch';
  }

  @override
  String get labelOutsideZone => 'You are outside the zone';

  @override
  String get msgOutsideZoneReview => 'Your clock-in will be under review.';

  @override
  String get msgClockSaved => 'Clock-in recorded.';

  @override
  String labelTodayHours(Object hours, Object week) {
    return 'Today: $hours · Week: $week';
  }

  @override
  String get runStatusDraft => 'Draft';

  @override
  String get runStatusApproved => 'Approved';

  @override
  String get runStatusPaying => 'Paying';

  @override
  String get runStatusPaid => 'Paid';

  @override
  String get runStatusPartiallyFailed => 'With failed payments';

  @override
  String get actionNewRun => 'New run';

  @override
  String get actionRecalculate => 'Recalculate';

  @override
  String get labelNetToPay => 'Net to pay';

  @override
  String get labelGross => 'Gross';

  @override
  String get labelNet => 'Net';

  @override
  String get labelEmployee => 'Employee';

  @override
  String get labelPeriod => 'Period';

  @override
  String msgRetryFailedPayments(Object count) {
    return 'Failed payments: $count';
  }

  @override
  String get actionRetryFailed => 'Retry failed';

  @override
  String get labelRatesApplied => 'Applied rates';

  @override
  String msgRatesAsOf(Object date) {
    return 'In force on $date';
  }

  @override
  String get labelReviewsPending => 'Clock-ins under review';

  @override
  String get labelOnlyUnderReview => 'Only under review';

  @override
  String get actionAccept => 'Accept';

  @override
  String get actionCorrect => 'Correct';

  @override
  String get fieldCorrectTime => 'Correct time';

  @override
  String get fieldReason => 'Reason';

  @override
  String get msgCorrectionNeedsReason => 'The reason is required.';

  @override
  String msgNoConnectionPending(Object count) {
    return 'Offline: $count clock-ins saved';
  }

  @override
  String get kioskScanHint => 'Scan with your app';

  @override
  String get msgLeaveKioskNeedsManagerPin =>
      'Leaving the kiosk requires a manager PIN.';

  @override
  String get actionAsk => 'Ask';

  @override
  String get askQuestionTitle => 'Ask about your data';

  @override
  String get askQuestionHint => 'How much did I sell in October?';

  @override
  String get error_QUESTION_NOT_UNDERSTOOD =>
      'I did not understand the question. Try “how much did I sell in October” or “how many orders were there”.';

  @override
  String get alertsTitle => 'Alerts';

  @override
  String get alertsEmpty => 'No active alerts.';

  @override
  String get segmentsTitle => 'Customer segments';

  @override
  String get labelCustomers => 'Customers';

  @override
  String get trendUp => 'Up';

  @override
  String get trendDown => 'Down';

  @override
  String get dashboardsTitle => 'Dashboards';

  @override
  String get exportsTitle => 'Exports';

  @override
  String get actionCreateExport => 'Create export';

  @override
  String get msgExportReady => 'Your export is ready.';

  @override
  String get msgExportPending => 'We are preparing your export.';

  @override
  String get askInterpretationTitle => 'How I read it';

  @override
  String get updateRequiredTitle => 'You need to update PlentyPay';

  @override
  String updateRequiredBody(Object current, Object minimum) {
    return 'This version ($current) is no longer compatible. You need version $minimum or later to keep using it.';
  }

  @override
  String get actionUpdate => 'Update';

  @override
  String get actionExit => 'Exit';

  @override
  String get maintenanceTitle => 'We\'re updating';

  @override
  String get maintenanceGeneric =>
      'We\'re doing maintenance. We\'ll be back soon.';

  @override
  String get confirmingPaymentTitle => 'Your payment';

  @override
  String get confirmingPaymentBody => 'We\'re confirming your payment';

  @override
  String get confirmingPaymentHint =>
      'This can take a few minutes. Don\'t close the app; we\'ll let you know when it\'s done.';

  @override
  String get paymentFailedTitle => 'The payment could not be completed';

  @override
  String get paymentStatusPending => 'Pending';

  @override
  String get paymentStatusConfirming => 'Confirming';

  @override
  String get paymentStatusCaptured => 'Confirmed';

  @override
  String get paymentStatusFailed => 'Not completed';

  @override
  String get paymentStatusRefunded => 'Refunded';

  @override
  String get actionCheckStatus => 'Check status';

  @override
  String get actionDone => 'Done';

  @override
  String get actionClose => 'Close';

  @override
  String get qrScannedTitle => 'Scanned code';

  @override
  String get receiptTotal => 'Total';

  @override
  String get receiptPaidWith => 'Paid with';

  @override
  String receiptOperationCode(Object code) {
    return 'Operation $code';
  }

  @override
  String get actionShareReceipt => 'Share receipt';
}
