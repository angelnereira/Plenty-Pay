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
  String get fieldDv => 'Check digit';

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

  @override
  String get legalUnavailableTitle => 'Legal document';

  @override
  String get legalUnavailableNotConfigured =>
      'This document isn\'t published yet. Come back soon or contact us for a copy.';

  @override
  String get legalUnavailableFetchFailed =>
      'We couldn\'t load the document. Check your connection and try again.';

  @override
  String get legalUnavailableGeneric =>
      'This document isn\'t available right now.';

  @override
  String legalVersionAndDate(Object date, Object version) {
    return 'Version $version · published on $date';
  }

  @override
  String get actionAcceptTerms => 'Accept';

  @override
  String get catalogTitle => 'Products';

  @override
  String get searchProductsHint => 'Search by name, code or SKU';

  @override
  String get scanBarcode => 'Scan barcode';

  @override
  String get actionNewProduct => 'New product';

  @override
  String get actionImport => 'Import';

  @override
  String get emptyCatalogTitle => 'You have no products yet';

  @override
  String get emptyCatalogBody =>
      'Create your first product or import them from a file.';

  @override
  String get statusArchived => 'Archived';

  @override
  String get statusOutOfStock => 'Out of stock';

  @override
  String get inventoryTitle => 'Stock';

  @override
  String get adjustStock => 'Adjust';

  @override
  String get transferStock => 'Transfer';

  @override
  String get warehouse => 'Warehouse';

  @override
  String get lowStock => 'Low stock';

  @override
  String get outOfStock => 'Out of stock';

  @override
  String get expiringSoon => 'Expiring soon';

  @override
  String get posTitle => 'Point of sale';

  @override
  String get parkSale => 'Park sale';

  @override
  String get voidSale => 'Void';

  @override
  String get searchProduct => 'Search product';

  @override
  String get emptySale => 'Add products to start the sale.';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get tax => 'Tax';

  @override
  String get total => 'Total';

  @override
  String get logisticsTitle => 'Deliveries';

  @override
  String get mapView => 'Map';

  @override
  String get emptyDeliveries => 'No deliveries for this filter.';

  @override
  String get newDelivery => 'New delivery';

  @override
  String get fiscalProfileTitle => 'Fiscal profile';

  @override
  String get fieldRuc => 'Tax ID';

  @override
  String get fieldPac => 'PAC provider';

  @override
  String get fieldEnvironment => 'Environment';

  @override
  String get folioStatus => 'Available folios';

  @override
  String get folioOk => 'OK';

  @override
  String get invoicesTitle => 'Invoices';

  @override
  String get issueInvoice => 'Issue invoice';

  @override
  String get emptyInvoices => 'No invoices issued.';

  @override
  String get newProduct => 'New product';

  @override
  String get editProduct => 'Edit product';

  @override
  String get archiveProduct => 'Archive';

  @override
  String get sectionBasic => 'Basic';

  @override
  String get sectionIdentification => 'Identification';

  @override
  String get sectionSale => 'Sale';

  @override
  String get sectionTaxes => 'Taxes';

  @override
  String get sectionInventory => 'Inventory';

  @override
  String get sectionRestrictions => 'Restrictions';

  @override
  String get sectionWarranty => 'Warranty and returns';

  @override
  String get fieldProductName => 'Name';

  @override
  String get fieldDescription => 'Description';

  @override
  String get fieldCategory => 'Category';

  @override
  String get fieldSku => 'SKU';

  @override
  String get fieldBarcode => 'Barcode';

  @override
  String get fieldUnit => 'Unit of measure';

  @override
  String get sellByWeight => 'Sold by weight';

  @override
  String get fieldPrice => 'Sale price';

  @override
  String get priceIncludesTax => 'Price includes tax';

  @override
  String get fieldCost => 'Cost';

  @override
  String get fieldTaxTreatment => 'Treatment';

  @override
  String get fieldTaxRate => 'Tax rate';

  @override
  String get trackStock => 'Track stock';

  @override
  String get trackLot => 'Track lot and expiry';

  @override
  String get fieldMinStock => 'Minimum stock';

  @override
  String get onlyAdults => 'Adults only';

  @override
  String get requiresPrescription => 'Requires prescription';

  @override
  String get fieldWarrantyDays => 'Warranty days';

  @override
  String get readinessTitle => 'Ready to sell / publish';

  @override
  String get readinessReadyToSell => 'Ready to sell: yes';

  @override
  String get readinessReadyToPublish => 'Ready to publish: yes';

  @override
  String get cartTitle => 'Cart';

  @override
  String get emptyCart => 'Your cart is empty.';

  @override
  String get actionCheckout => 'Checkout';

  @override
  String get checkoutTitle => 'Checkout';

  @override
  String get deliveryMethod => 'Delivery method';

  @override
  String get paymentMethod => 'Payment method';

  @override
  String get orderSummary => 'Order summary';

  @override
  String get actionPlaceOrder => 'Place order';

  @override
  String get ordersTitle => 'My orders';

  @override
  String get emptyOrders => 'You have no orders yet.';

  @override
  String get actionCancel => 'Cancel';

  @override
  String get actionAdd => 'Add';

  @override
  String get actionEdit => 'Edit';

  @override
  String get actionSuspend => 'Suspend';

  @override
  String get actionReactivate => 'Reactivate';

  @override
  String get actionResend => 'Resend';

  @override
  String get actionArchive => 'Archive';

  @override
  String get actionDuplicate => 'Duplicate';

  @override
  String get moduleAppointments => 'Appointments';

  @override
  String get businessLegalSection => 'Legal details';

  @override
  String get businessBranchesSection => 'Branches';

  @override
  String get businessProfileSection => 'Business profile';

  @override
  String get businessAdminSection => 'Administration';

  @override
  String businessVerticalLabel(Object vertical) {
    return 'Business type: $vertical';
  }

  @override
  String businessSecondaryLabel(Object verticals) {
    return 'Also: $verticals';
  }

  @override
  String get businessLegalLocked =>
      'Legal details cannot be edited after approval.';

  @override
  String get fieldBranchCode => 'DGI code';

  @override
  String get fieldBranchName => 'Branch name';

  @override
  String get fieldAddress => 'Address';

  @override
  String get hintBranchCode => '4 digits. 0000 is the head office.';

  @override
  String get errorBranchCode => 'Enter 4 digits, for example 0001.';

  @override
  String get errorBranchName => 'Enter the branch name.';

  @override
  String get branchHeadquarters => 'Head office';

  @override
  String get branchActive => 'Active';

  @override
  String get branchInactive => 'Inactive';

  @override
  String get branchNewTitle => 'New branch';

  @override
  String get branchEditTitle => 'Edit branch';

  @override
  String get msgBranchSaved => 'Branch saved.';

  @override
  String get emptyBranches => 'No branches yet.';

  @override
  String get modulesTitle => 'Modules and features';

  @override
  String get integrationsTitle => 'Integrations';

  @override
  String get templatesTitle => 'Message templates';

  @override
  String get auditTitle => 'Audit log';

  @override
  String get privacyTitle => 'Privacy';

  @override
  String get teamTabMembers => 'Members';

  @override
  String get teamTabInvitations => 'Invitations';

  @override
  String get fieldScope => 'Scope';

  @override
  String get scopeTenant => 'All branches';

  @override
  String get scopeBranches => 'Specific branches';

  @override
  String get fieldJobTitle => 'Job title (optional)';

  @override
  String get errorJobTitle => 'Use 60 characters or fewer.';

  @override
  String get errorBranchesRequired => 'Choose at least one branch.';

  @override
  String get errorRoleRequired => 'Choose a role.';

  @override
  String get memberStatusActive => 'Active';

  @override
  String get memberStatusSuspended => 'Suspended';

  @override
  String get memberStatusDeactivated => 'Removed';

  @override
  String get memberOwner => 'Owner';

  @override
  String get memberNoRole => 'No role';

  @override
  String memberLastAccess(Object date) {
    return 'Last access: $date';
  }

  @override
  String memberBranchCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count branches',
      one: '1 branch',
    );
    return '$_temp0';
  }

  @override
  String get actionChangeAccess => 'Change role and scope';

  @override
  String get actionRemoveMember => 'Remove from team';

  @override
  String confirmRemoveTitle(Object name) {
    return 'Remove $name?';
  }

  @override
  String get confirmRemoveBody =>
      'They will lose access to the business and their sessions will end.';

  @override
  String confirmSuspendTitle(Object name) {
    return 'Suspend $name?';
  }

  @override
  String get confirmSuspendBody =>
      'They cannot sign in until you reactivate them. Their sessions end now.';

  @override
  String get msgMemberUpdated => 'Changes saved.';

  @override
  String get emptyInvitations => 'No pending invitations.';

  @override
  String invitationExpiresOn(Object date) {
    return 'Expires on $date';
  }

  @override
  String get invitationExpired => 'Expired';

  @override
  String get msgInvitationResent => 'We sent a new link.';

  @override
  String get msgInvitationRevoked => 'Invitation revoked.';

  @override
  String get stepUpInvite => 'Confirm the invitation';

  @override
  String get stepUpAccess => 'Confirm the access change';

  @override
  String get stepUpRole => 'Confirm the role';

  @override
  String get stepUpCapabilities => 'Confirm the feature change';

  @override
  String get rolesTemplatesSection => 'Templates';

  @override
  String get rolesOwnSection => 'Business roles';

  @override
  String get roleNewTitle => 'New role';

  @override
  String get roleEditTitle => 'Edit role';

  @override
  String get fieldRoleName => 'Role name';

  @override
  String get fieldRoleDescription => 'Description (optional)';

  @override
  String get errorRoleName => 'Enter a role name.';

  @override
  String roleFromTemplate(Object template) {
    return 'Based on $template';
  }

  @override
  String roleMembers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count members',
      one: '1 member',
      zero: 'No members',
    );
    return '$_temp0';
  }

  @override
  String rolePermissionCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count permissions',
      one: '1 permission',
    );
    return '$_temp0';
  }

  @override
  String get roleTemplateReadOnly =>
      'Templates cannot be edited: duplicate one to create your role.';

  @override
  String get roleSodWarning =>
      'This role combines duties that are best kept separate.';

  @override
  String get roleMoneyPermission => 'Moves money';

  @override
  String get roleUnavailablePermission => 'Feature turned off in your business';

  @override
  String get msgRoleSaved => 'Role saved.';

  @override
  String get msgRoleArchived => 'Role archived.';

  @override
  String get level_VIEW => 'View';

  @override
  String get level_OPERATE => 'Operate';

  @override
  String get level_MANAGE => 'Manage';

  @override
  String get level_APPROVE => 'Approve';

  @override
  String get level_CONFIGURE => 'Configure';

  @override
  String modulesPlan(Object plan) {
    return 'Plan: $plan';
  }

  @override
  String get capabilityGated => 'Pending legal review';

  @override
  String get actionSaveCapabilities => 'Save features';

  @override
  String get confirmDisableTitle => 'Turn off these features?';

  @override
  String get confirmDisableBody =>
      'Related permissions will no longer be available to your team. Data is kept.';

  @override
  String get actionDisable => 'Turn off';

  @override
  String get msgCapabilitiesSaved => 'Features saved.';

  @override
  String get msgNoChanges => 'There are no changes to save.';

  @override
  String get error_PERMISSION_NOT_HELD =>
      'You cannot grant permissions you do not have.';

  @override
  String get error_SELF_ASSIGNMENT_FORBIDDEN =>
      'You cannot change your own access.';

  @override
  String get error_BRANCH_OUT_OF_SCOPE => 'That branch is outside your scope.';

  @override
  String get error_ROLE_IN_USE =>
      'This role has members: reassign them before archiving it.';

  @override
  String get error_BRANCH_CODE_TAKEN =>
      'A branch with that code already exists.';

  @override
  String get error_INVALID_BRANCH_CODE => 'The code must have 4 digits.';

  @override
  String get error_CANNOT_DEACTIVATE_LAST_BRANCH =>
      'The business needs at least one active branch.';

  @override
  String get error_CANNOT_DEACTIVATE_OWNER =>
      'The business cannot be left without an active owner.';

  @override
  String get error_CAPABILITY_DISABLED =>
      'That feature is not available in your business.';

  @override
  String get error_PRESET_READ_ONLY =>
      'Templates cannot be edited: duplicate one.';

  @override
  String get error_PERMISSION_DENIED =>
      'You do not have permission for this action.';

  @override
  String get error_STEP_UP_REQUIRED => 'This action needs confirmation.';

  @override
  String get error_STEP_UP_INVALID =>
      'The confirmation is not valid. Try again.';

  @override
  String get error_ROLE_NOT_FOUND => 'That role no longer exists.';

  @override
  String get error_ALREADY_EXISTS => 'A role with that name already exists.';

  @override
  String get error_INVALID_REQUEST => 'Check the details and try again.';

  @override
  String get error_NOT_FOUND => 'We could not find that record.';

  @override
  String get error_VERTICAL_NOT_FOUND => 'That business type is not available.';

  @override
  String get error_ACCOUNT_SUSPENDED =>
      'Your account is suspended. Contact your business administrator.';

  @override
  String get vertical_retail => 'Retail store';

  @override
  String get vertical_food_and_beverage => 'Food and beverage';

  @override
  String get vertical_services_appointments => 'Appointment services';

  @override
  String get vertical_professional_services => 'Professional services';

  @override
  String get vertical_wholesale_distribution => 'Wholesale and distribution';

  @override
  String get vertical_logistics_courier => 'Courier and logistics';

  @override
  String get vertical_beauty_wellness => 'Beauty and wellness';

  @override
  String get vertical_health_clinic => 'Health clinic';

  @override
  String get vertical_education_courses => 'Education and courses';

  @override
  String get vertical_general_commercial => 'General business';

  @override
  String get template_manager => 'Manager';

  @override
  String get template_supervisor => 'Shift supervisor';

  @override
  String get template_cashier => 'Cashier';

  @override
  String get template_stock_keeper => 'Stock keeper';

  @override
  String get template_courier => 'Courier';

  @override
  String get template_accountant => 'Accountant';

  @override
  String get template_viewer => 'Viewer';

  @override
  String get template_waiter => 'Waiter';

  @override
  String get template_host => 'Host';

  @override
  String get template_kitchen => 'Kitchen';

  @override
  String get template_bartender => 'Bartender';

  @override
  String get template_stylist => 'Professional (stylist, barber)';

  @override
  String get template_receptionist => 'Receptionist';

  @override
  String get template_salon_manager => 'Salon manager';

  @override
  String get template_sales_rep => 'Sales rep';

  @override
  String get template_credit_officer => 'Credit officer';

  @override
  String get template_warehouse_lead => 'Warehouse lead';

  @override
  String get template_dispatcher => 'Dispatcher';

  @override
  String get template_fleet_manager => 'Fleet manager';

  @override
  String get template_billing_clerk => 'Billing clerk';

  @override
  String get template_sales_associate => 'Sales associate';

  @override
  String get cap_pos_counter => 'Counter sales';

  @override
  String get capDesc_pos_counter => 'Sell and charge at the counter.';

  @override
  String get cap_pos_offline => 'Offline sales';

  @override
  String get capDesc_pos_offline => 'Keep selling when the internet is down.';

  @override
  String get cap_pos_customer_display => 'Customer display';

  @override
  String get capDesc_pos_customer_display =>
      'Show the total to the customer on a second screen.';

  @override
  String get cap_pos_house_credit => 'House credit';

  @override
  String get capDesc_pos_house_credit => 'Sell on credit to known customers.';

  @override
  String get cap_pos_loyalty => 'Loyalty points';

  @override
  String get capDesc_pos_loyalty =>
      'Earn and redeem points with your customers.';

  @override
  String get cap_pos_tables => 'Tables';

  @override
  String get capDesc_pos_tables => 'Open, move, merge and split tables.';

  @override
  String get cap_pos_kitchen_display => 'Kitchen display';

  @override
  String get capDesc_pos_kitchen_display =>
      'See and mark orders in the kitchen or bar.';

  @override
  String get cap_pos_split_bill => 'Split bill';

  @override
  String get capDesc_pos_split_bill => 'Charge one bill in several parts.';

  @override
  String get cap_pos_tips => 'Tips';

  @override
  String get capDesc_pos_tips => 'Receive tips at checkout.';

  @override
  String get cap_pos_weighed_items => 'Weighed items';

  @override
  String get capDesc_pos_weighed_items => 'Sell items by weight.';

  @override
  String get cap_orders_marketplace => 'Online orders';

  @override
  String get capDesc_orders_marketplace =>
      'Receive and manage marketplace orders.';

  @override
  String get cap_orders_quotes => 'Quotes';

  @override
  String get capDesc_orders_quotes => 'Quote and turn quotes into orders.';

  @override
  String get cap_orders_b2b => 'Business orders';

  @override
  String get capDesc_orders_b2b => 'Orders from business customers.';

  @override
  String get cap_appointments_calendar => 'Appointment calendar';

  @override
  String get capDesc_appointments_calendar => 'Book and serve appointments.';

  @override
  String get cap_appointments_queue => 'Walk-in queue';

  @override
  String get capDesc_appointments_queue =>
      'Serve customers in order of arrival.';

  @override
  String get cap_appointments_online_booking => 'Online booking';

  @override
  String get capDesc_appointments_online_booking =>
      'Let customers book on their own.';

  @override
  String get cap_appointments_deposits => 'Booking deposits';

  @override
  String get capDesc_appointments_deposits => 'Charge a deposit when booking.';

  @override
  String get cap_catalog_products => 'Products';

  @override
  String get capDesc_catalog_products =>
      'Product catalog with prices and taxes.';

  @override
  String get cap_catalog_services => 'Services';

  @override
  String get capDesc_catalog_services => 'Services with duration and price.';

  @override
  String get cap_catalog_variants => 'Variants';

  @override
  String get capDesc_catalog_variants => 'Options of the same product.';

  @override
  String get cap_catalog_modifiers => 'Modifiers';

  @override
  String get capDesc_catalog_modifiers => 'Add-ons chosen when preparing.';

  @override
  String get cap_catalog_listing => 'Marketplace listing';

  @override
  String get capDesc_catalog_listing => 'Show your products on PlentyPay.';

  @override
  String get cap_catalog_price_lists => 'Price lists';

  @override
  String get capDesc_catalog_price_lists => 'Prices per customer or segment.';

  @override
  String get cap_inventory_stock => 'Stock';

  @override
  String get capDesc_inventory_stock =>
      'Track how much you have of each product.';

  @override
  String get cap_inventory_lots => 'Lots and expiry';

  @override
  String get capDesc_inventory_lots => 'Sell what expires first.';

  @override
  String get cap_inventory_transfers => 'Transfers';

  @override
  String get capDesc_inventory_transfers => 'Move goods between branches.';

  @override
  String get cap_inventory_purchasing => 'Purchasing';

  @override
  String get capDesc_inventory_purchasing => 'Purchase orders and receiving.';

  @override
  String get cap_inventory_recipes => 'Recipes';

  @override
  String get capDesc_inventory_recipes => 'Deduct ingredients per dish sold.';

  @override
  String get cap_logistics_own_fleet => 'Own delivery';

  @override
  String get capDesc_logistics_own_fleet => 'Deliver with your own couriers.';

  @override
  String get cap_logistics_carriers => 'Carriers';

  @override
  String get capDesc_logistics_carriers => 'Deliver with external companies.';

  @override
  String get cap_logistics_geofences => 'Delivery zones';

  @override
  String get capDesc_logistics_geofences =>
      'Define where you deliver and at what cost.';

  @override
  String get cap_logistics_fleet => 'Fleet';

  @override
  String get capDesc_logistics_fleet => 'Vehicles and maintenance.';

  @override
  String get cap_logistics_freight => 'Freight';

  @override
  String get capDesc_logistics_freight => 'Transport by weight or volume.';

  @override
  String get cap_logistics_routes => 'Routes';

  @override
  String get capDesc_logistics_routes => 'Plan delivery routes.';

  @override
  String get cap_finance_payments => 'Payments';

  @override
  String get capDesc_finance_payments =>
      'Receive payments from your customers.';

  @override
  String get cap_finance_terminals => 'QR terminals';

  @override
  String get capDesc_finance_terminals => 'Charge with QR codes per register.';

  @override
  String get cap_finance_settlement => 'Settlements';

  @override
  String get capDesc_finance_settlement => 'Receive money in your account.';

  @override
  String get cap_finance_fiscal => 'E-invoicing';

  @override
  String get capDesc_finance_fiscal => 'Issue invoices to the DGI.';

  @override
  String get cap_payroll_attendance => 'Attendance';

  @override
  String get capDesc_payroll_attendance => 'Clock in and out.';

  @override
  String get cap_payroll_kiosk => 'Clock-in kiosk';

  @override
  String get capDesc_payroll_kiosk => 'Clock in from a shared device.';

  @override
  String get cap_payroll_runs => 'Payroll';

  @override
  String get capDesc_payroll_runs => 'Calculate and pay payroll.';

  @override
  String get cap_payroll_commissions => 'Commissions';

  @override
  String get capDesc_payroll_commissions => 'Commission per service or sale.';

  @override
  String get cap_payroll_tips_distribution => 'Tip distribution';

  @override
  String get capDesc_payroll_tips_distribution => 'Share tips with the team.';

  @override
  String get cap_analytics_dashboards => 'Dashboards';

  @override
  String get capDesc_analytics_dashboards => 'Your business indicators.';

  @override
  String get cap_analytics_ask => 'Ask';

  @override
  String get capDesc_analytics_ask => 'Ask in plain language.';

  @override
  String get cap_analytics_forecast => 'Forecasts';

  @override
  String get capDesc_analytics_forecast => 'Estimate future sales.';

  @override
  String get cap_analytics_export => 'Export';

  @override
  String get capDesc_analytics_export =>
      'Download records for your accountant.';

  @override
  String get perm_payments_charge => 'Charge';

  @override
  String get perm_payments_read => 'View payments';

  @override
  String get perm_payments_refund => 'Refund';

  @override
  String get perm_payments_terminal_manage => 'Configure terminals';

  @override
  String get perm_payments_fees_read => 'View fees';

  @override
  String get perm_payments_fees_manage => 'Configure fees';

  @override
  String get perm_settlement_read => 'View settlements';

  @override
  String get perm_settlement_schedule_manage => 'Configure settlements';

  @override
  String get perm_settlement_reconcile => 'Reconcile';

  @override
  String get perm_catalog_read => 'View catalog';

  @override
  String get perm_catalog_write => 'Edit catalog';

  @override
  String get perm_catalog_import => 'Import catalog';

  @override
  String get perm_catalog_listing_manage => 'Manage listings';

  @override
  String get perm_catalog_pricelist_manage => 'Manage price lists';

  @override
  String get perm_inventory_read => 'View stock';

  @override
  String get perm_inventory_adjust => 'Adjust stock';

  @override
  String get perm_inventory_purchase_manage => 'Manage purchasing';

  @override
  String get perm_inventory_receive => 'Receive goods';

  @override
  String get perm_inventory_recipe_manage => 'Manage recipes';

  @override
  String get perm_pos_read => 'View sales and cash counts';

  @override
  String get perm_pos_sell => 'Sell';

  @override
  String get perm_pos_void => 'Void sales';

  @override
  String get perm_pos_refund => 'Refund sales';

  @override
  String get perm_pos_session_manage => 'Open and close register';

  @override
  String get perm_pos_settings_manage => 'Configure register';

  @override
  String get perm_pos_discount_apply => 'Apply discounts';

  @override
  String get perm_pos_table_manage => 'Manage tables';

  @override
  String get perm_pos_kitchen_update => 'Update kitchen orders';

  @override
  String get perm_pos_credit_approve => 'Approve credit';

  @override
  String get perm_fiscal_read => 'View invoices';

  @override
  String get perm_fiscal_issue => 'Issue invoices';

  @override
  String get perm_fiscal_note_issue => 'Issue credit notes';

  @override
  String get perm_fiscal_profile_manage => 'Configure invoicing';

  @override
  String get perm_orders_read => 'View orders';

  @override
  String get perm_orders_manage => 'Manage orders';

  @override
  String get perm_orders_quote_manage => 'Manage quotes';

  @override
  String get perm_appointments_read => 'View all appointments';

  @override
  String get perm_appointments_read_self => 'View my appointments';

  @override
  String get perm_appointments_book => 'Book appointments';

  @override
  String get perm_appointments_checkin => 'Check in customers';

  @override
  String get perm_appointments_manage => 'Manage calendar';

  @override
  String get perm_appointments_settings_manage => 'Configure calendar';

  @override
  String get perm_logistics_read => 'View deliveries';

  @override
  String get perm_logistics_manage => 'Manage deliveries';

  @override
  String get perm_logistics_deliver => 'Deliver';

  @override
  String get perm_logistics_geofence_manage => 'Configure zones';

  @override
  String get perm_logistics_fleet_manage => 'Manage fleet';

  @override
  String get perm_logistics_route_plan => 'Plan routes';

  @override
  String get perm_payroll_employee_read => 'View employees';

  @override
  String get perm_payroll_employee_manage => 'Manage employees';

  @override
  String get perm_payroll_attendance_record => 'Record attendance';

  @override
  String get perm_payroll_attendance_read => 'View attendance';

  @override
  String get perm_payroll_run_create => 'Prepare payroll';

  @override
  String get perm_payroll_run_approve => 'Approve payroll';

  @override
  String get perm_payroll_run_pay => 'Pay payroll';

  @override
  String get perm_payroll_payslip_read_self => 'View my payslips';

  @override
  String get perm_payroll_commission_read_self => 'View my commissions';

  @override
  String get perm_payroll_commission_manage => 'Manage commissions';

  @override
  String get perm_analytics_read => 'View analytics';

  @override
  String get perm_analytics_dashboard_manage => 'Manage dashboards';

  @override
  String get perm_analytics_alert_manage => 'Manage alerts';

  @override
  String get perm_analytics_export => 'Export records';

  @override
  String get perm_admin_users_manage => 'Manage team';

  @override
  String get perm_admin_roles_manage => 'Manage roles';

  @override
  String get perm_admin_business_manage => 'Configure business';

  @override
  String get perm_admin_integrations_manage => 'Configure integrations';

  @override
  String get perm_admin_audit_read => 'View audit log';

  @override
  String get perm_notifications_template_manage => 'Manage message templates';

  @override
  String invitationHeadline(Object business, Object role) {
    return '$business invites you as $role';
  }

  @override
  String invitationScope(Object scope) {
    return 'Scope: $scope';
  }

  @override
  String get invitationInvalid =>
      'This invitation is no longer valid. Ask your business for a new one.';

  @override
  String get invitationExistingAccount =>
      'You already have a PlentyPay account: sign in with your current password and keep your wallet.';

  @override
  String get actionAcceptInvitation => 'Accept invitation';

  @override
  String get actionAcceptAndCreate => 'Accept and create account';

  @override
  String get error_TOKEN_INVALID =>
      'This invitation is no longer valid. Ask your business for a new one.';

  @override
  String get error_ALREADY_USED => 'This invitation was already used.';

  @override
  String get error_ALREADY_HAS_TENANT =>
      'That account already belongs to another business.';

  @override
  String get homeGreeting => 'Hello';

  @override
  String get homeNotifications => 'Notifications';

  @override
  String get walletAvailable => 'Available balance';

  @override
  String walletHeld(String amount) {
    return 'On hold: $amount';
  }

  @override
  String get walletHeldExplain => 'Money set aside for payments in progress.';

  @override
  String get walletHideBalance => 'Hide balance';

  @override
  String get walletShowBalance => 'Show balance';

  @override
  String get walletBalanceHidden => 'Balance hidden';

  @override
  String get walletReceive => 'Receive';

  @override
  String get walletPay => 'Pay';

  @override
  String get walletMovements => 'Activity';

  @override
  String get walletEmpty => 'You don\'t have any activity yet.';

  @override
  String get walletUnavailable =>
      'Your wallet isn\'t available yet. Please try again later.';

  @override
  String get walletSandbox => 'Test mode: no real money is moved.';

  @override
  String get txType_WALLET_TOPUP => 'Top-up';

  @override
  String get txType_WALLET_PAYMENT => 'Payment';

  @override
  String get txType_P2P_TRANSFER => 'Transfer';

  @override
  String get txType_PAYOUT_TO_WALLET => 'Payout to your wallet';

  @override
  String get txType_REFUND => 'Refund';

  @override
  String get txType_PAYROLL_PAYMENT => 'Payroll payment';

  @override
  String get txType_REVERSAL => 'Correction';

  @override
  String get txTypeOther => 'Activity';

  @override
  String get txDetailTitle => 'Activity details';

  @override
  String get txStatusCompleted => 'Completed';

  @override
  String get txFieldType => 'Type';

  @override
  String get txFieldDate => 'Date and time';

  @override
  String get txFieldReference => 'Reference';

  @override
  String get txFieldConcept => 'Description';

  @override
  String get txCopyReference => 'Copy reference';

  @override
  String get txReferenceCopied => 'Reference copied.';

  @override
  String get featureUnavailableTitle => 'Not available yet';

  @override
  String get topupUnavailable =>
      'Top-ups aren\'t available yet. We\'ll let you know when you can top up.';

  @override
  String get sendUnavailable =>
      'Person-to-person transfers aren\'t available yet. We\'ll let you know when you can send money.';

  @override
  String get receiveUnavailable =>
      'Your code for receiving money isn\'t available yet.';

  @override
  String get payScanHint => 'Point at the merchant\'s QR code';

  @override
  String get payEnterCode => 'Enter code';

  @override
  String get payCodeLabel => 'Payment code';

  @override
  String get actionContinue => 'Continue';

  @override
  String get payNotPlentyPay => 'This code isn\'t from PlentyPay.';

  @override
  String get payInvalidCode => 'That payment code isn\'t valid.';

  @override
  String get payPointUnavailable => 'This payment point isn\'t available.';

  @override
  String get payCameraUnavailable =>
      'We couldn\'t use the camera. Enter the printed code instead.';

  @override
  String get payVerifiedMerchant => 'Verified merchant';

  @override
  String payWithBalance(String available) {
    return 'Pay with: PlentyPay balance ($available)';
  }

  @override
  String get payInsufficient => 'Insufficient balance';

  @override
  String get payBreakdownPurchase => 'Purchase';

  @override
  String get payBreakdownFee => 'Service fee';

  @override
  String get payBreakdownTax => 'ITBMS';

  @override
  String get payBreakdownTotal => 'Total';

  @override
  String payButton(String total) {
    return 'Pay $total';
  }

  @override
  String payStepUpTitle(String merchant) {
    return 'Confirm payment to $merchant';
  }

  @override
  String get payAmountInvalid => 'Enter an amount greater than zero.';

  @override
  String get payResultSuccess => 'Payment complete';

  @override
  String payResultReference(String code) {
    return 'Reference $code';
  }

  @override
  String get payResultFailed => 'We couldn\'t complete the payment';

  @override
  String get payResultNotCharged => 'You weren\'t charged.';

  @override
  String get payResultConfirming => 'We\'re confirming your payment';

  @override
  String get payResultConfirmingBody =>
      'It may take a few minutes. Don\'t pay again: we\'ll let you know the result.';

  @override
  String get actionUnderstood => 'Got it';

  @override
  String get actionTryAgain => 'Try again';

  @override
  String get error_INSUFFICIENT_FUNDS => 'Insufficient balance.';

  @override
  String get error_TENANT_NOT_ACTIVE =>
      'This merchant can\'t accept payments yet.';

  @override
  String get error_TERMINAL_INACTIVE => 'This payment point isn\'t available.';

  @override
  String get error_AMOUNT_OUT_OF_RANGE =>
      'The amount is outside the allowed limit.';

  @override
  String get error_AMOUNT_BELOW_FEES =>
      'The amount is too low for this payment.';

  @override
  String get error_FEE_POLICY_MISSING =>
      'This merchant can\'t accept payments yet.';

  @override
  String get error_RAIL_DISABLED => 'This payment method isn\'t available.';

  @override
  String get error_INVALID_STATE_TRANSITION =>
      'This payment can no longer be paid.';

  @override
  String get error_INVALID_LABEL => 'The name must be 1 to 60 characters long.';

  @override
  String get error_DEPENDENCY_UNAVAILABLE =>
      'The service isn\'t available. Please try again in a moment.';

  @override
  String get terminalsEmpty => 'You don\'t have any payment points yet.';

  @override
  String get terminalsCreate => 'New payment point';

  @override
  String get terminalNameLabel => 'Name';

  @override
  String get terminalNameHint => 'For example: Register 1';

  @override
  String get terminalActive => 'Active';

  @override
  String get terminalInactive => 'Inactive';

  @override
  String get terminalCopyLink => 'Copy link';

  @override
  String get terminalLinkCopied => 'Link copied.';

  @override
  String get terminalScanToPay => 'Scan to pay with PlentyPay';

  @override
  String terminalDeactivateConfirm(String name) {
    return 'Deactivate $name? Nobody will be able to pay with this code until you turn it back on.';
  }

  @override
  String get paymentsTitle => 'Payments';

  @override
  String get paymentsEmpty => 'You don\'t have any payments yet.';

  @override
  String paymentsNet(String amount) {
    return 'You receive $amount';
  }

  @override
  String get paymentStatus_CAPTURED => 'Completed';

  @override
  String get paymentStatus_CONFIRMING => 'Confirming';

  @override
  String get paymentStatus_FAILED => 'Declined';

  @override
  String get paymentStatus_CANCELLED => 'Cancelled';

  @override
  String get paymentStatus_EXPIRED => 'Expired';

  @override
  String get paymentStatus_PENDING => 'Pending';

  @override
  String get payTorch => 'Flashlight';

  @override
  String get payOpenSettings => 'Open settings';

  @override
  String get financeTitle => 'Finance';

  @override
  String get financeToday => 'Today';

  @override
  String get finance7Days => '7 days';

  @override
  String get financeMonth => 'Month';

  @override
  String get financeCaptured => 'Collected';

  @override
  String get financeFees => 'Fees';

  @override
  String get financeRefunds => 'Refunds';

  @override
  String get financeNet => 'Net';

  @override
  String get featureUnavailableBody =>
      'This feature isn\'t available yet. We\'ll let you know when you can use it.';

  @override
  String get homeRegisterBusiness => 'Register my business';

  @override
  String get topupHowMuch => 'How much do you want to top up?';

  @override
  String get topupMinimum => 'The minimum is \$1.00.';

  @override
  String get topupMethod => 'Method';

  @override
  String get railYappy => 'Yappy';

  @override
  String get railClave => 'Clave';

  @override
  String get railSandbox => 'Test';

  @override
  String get topupAmountLine => 'Top-up';

  @override
  String get topupFeeLine => 'Fee';

  @override
  String get topupTotalLine => 'Total to pay';

  @override
  String topupButton(String total) {
    return 'Top up $total';
  }

  @override
  String topupResult(String rail) {
    return 'Top-up from $rail';
  }

  @override
  String get catFilterActive => 'Active';

  @override
  String get catFilterArchived => 'Archived';

  @override
  String get catEmpty => 'You have no products yet.';

  @override
  String get catNewProduct => 'New product';

  @override
  String get catCategories => 'Categories';

  @override
  String catSkuValue(String sku) {
    return 'SKU $sku';
  }

  @override
  String get catArchivedChip => 'Archived';

  @override
  String get catLoadMore => 'Load more';

  @override
  String get catUnavailable =>
      'The catalog is not available right now. Try again later.';

  @override
  String get catEditTitle => 'Edit product';

  @override
  String get catSectionBasic => 'Basics';

  @override
  String get catName => 'Name';

  @override
  String get catNameError => 'Use 2 to 120 characters.';

  @override
  String get catDescription => 'Description';

  @override
  String get catCategory => 'Category';

  @override
  String get catNoCategory => 'No category';

  @override
  String get catPhotos => 'Photos';

  @override
  String get catAddPhoto => 'Add photo';

  @override
  String get catRemovePhoto => 'Remove photo';

  @override
  String get catSectionId => 'Identification';

  @override
  String get catSkuLabel => 'SKU';

  @override
  String get catSkuHelper => 'Leave it empty to generate one.';

  @override
  String get catBarcode => 'Barcode';

  @override
  String get catBarcodeInvalid => 'The barcode is not valid.';

  @override
  String get catBarcodeInternal =>
      'This is an in-store code; it does not identify the product outside your business.';

  @override
  String get catGenerateInternal => 'Generate in-store code';

  @override
  String get catSectionSale => 'Sale';

  @override
  String get catUnit => 'Unit of measure';

  @override
  String get unit_UNIT => 'Unit (ea)';

  @override
  String get unit_KG => 'Kilogram (kg)';

  @override
  String get unit_LITER => 'Liter (L)';

  @override
  String get unit_METER => 'Meter (m)';

  @override
  String get catUnitLocked =>
      'The unit cannot change after the product is created.';

  @override
  String get catPrice => 'Sale price';

  @override
  String get catPriceError => 'The price must be greater than \$0.00.';

  @override
  String get catPriceIncludesTax => 'The price includes ITBMS.';

  @override
  String get catSectionTax => 'Taxes';

  @override
  String get catTaxTreatment => 'Treatment';

  @override
  String get catTaxed => 'Taxed';

  @override
  String get catExempt => 'Exempt';

  @override
  String get catTaxRate => 'ITBMS rate';

  @override
  String get taxKind_STANDARD => 'Standard';

  @override
  String get taxKind_ALCOHOL => 'Alcohol and lodging';

  @override
  String get taxKind_TOBACCO => 'Tobacco';

  @override
  String catTaxRateOption(String kind, String percent) {
    return '$kind · $percent';
  }

  @override
  String get catTaxRatesUnavailable =>
      'We could not load the current ITBMS rates.';

  @override
  String get catSectionInventory => 'Inventory';

  @override
  String get catTrackStock => 'Track stock';

  @override
  String get catArchive => 'Archive';

  @override
  String catArchiveConfirmTitle(String name) {
    return 'Archive $name?';
  }

  @override
  String get catArchiveConfirmBody =>
      'The product stops being sold. It is not deleted and its history is kept.';

  @override
  String get catReadyToSell => 'Ready to sell';

  @override
  String catMissingToSell(String missing) {
    return 'Missing to sell: $missing';
  }

  @override
  String get catSaved => 'Product saved.';

  @override
  String get catCategoriesEmpty => 'You have no categories yet.';

  @override
  String get catNewCategory => 'New category';

  @override
  String get catParentCategory => 'Parent category';

  @override
  String get catNoParent => 'None (top level)';

  @override
  String get error_SKU_TAKEN => 'You already have a product with that SKU.';

  @override
  String get error_BARCODE_TAKEN =>
      'You already have a product with that barcode.';

  @override
  String get error_INVALID_BARCODE => 'The barcode is not valid.';

  @override
  String get error_INVALID_TAX_RATE => 'The ITBMS rate is not a current rate.';

  @override
  String get error_TAX_TREATMENT_MISSING => 'Choose the ITBMS treatment.';

  @override
  String get error_CATEGORY_DEPTH_EXCEEDED => 'Up to 4 category levels.';

  @override
  String get error_VERSION_CONFLICT =>
      'Someone else changed this record. Reload it.';

  @override
  String get invTitle => 'Stock';

  @override
  String invLowCard(String n) {
    return '$n running low';
  }

  @override
  String invOutCard(String n) {
    return '$n out of stock';
  }

  @override
  String get invAllWarehouses => 'All warehouses';

  @override
  String get invAvailable => 'Available';

  @override
  String get invReserved => 'Reserved';

  @override
  String get invMinimum => 'Minimum';

  @override
  String get invEmpty =>
      'No stock recorded yet. Make a count adjustment to start.';

  @override
  String get invAdjust => 'Adjust';

  @override
  String get invTransfer => 'Transfer';

  @override
  String get invWarehouses => 'Warehouses';

  @override
  String get invUnknownProduct => 'Product unavailable';

  @override
  String get invByWarehouse => 'By warehouse';

  @override
  String get invMovements => 'Movements';

  @override
  String get invNoMovements => 'No movements yet.';

  @override
  String get mov_RECEIPT => 'Receipt';

  @override
  String get mov_SALE => 'Sale';

  @override
  String get mov_ADJUSTMENT => 'Adjustment';

  @override
  String get mov_TRANSFER_OUT => 'Transfer (out)';

  @override
  String get mov_TRANSFER_IN => 'Transfer (in)';

  @override
  String get mov_RETURN => 'Return';

  @override
  String get mov_WRITE_OFF => 'Write-off';

  @override
  String get invAdjustTitle => 'Stock adjustment';

  @override
  String get invWarehouse => 'Warehouse';

  @override
  String get invProduct => 'Product';

  @override
  String get invSelectProduct => 'Choose a product';

  @override
  String invSystemQty(String qty) {
    return 'System $qty';
  }

  @override
  String get invCounted => 'Counted';

  @override
  String invDifferenceQty(String qty) {
    return 'Difference $qty';
  }

  @override
  String get invReason => 'Reason';

  @override
  String get invReason_COUNT => 'Physical count';

  @override
  String get invReason_DAMAGE => 'Damage';

  @override
  String get invReason_EXPIRED => 'Expiry';

  @override
  String get invReason_LOSS => 'Theft or loss';

  @override
  String get invReason_ERROR => 'Recording error';

  @override
  String get invReason_OTHER => 'Other';

  @override
  String get invReasonOtherHint => 'Describe the reason';

  @override
  String get invApplyAdjust => 'Apply adjustment';

  @override
  String get invAdjustConfirmTitle => 'Apply the adjustment?';

  @override
  String get invAdjustConfirmBody =>
      'An adjustment is never edited or deleted: it is corrected with another adjustment.';

  @override
  String get invAdjustDone => 'Adjustment applied.';

  @override
  String get invNoDifference => 'The count matches the system.';

  @override
  String get invTransferTitle => 'Transfer';

  @override
  String get invFrom => 'From';

  @override
  String get invTo => 'To';

  @override
  String get invQuantity => 'Quantity';

  @override
  String get invQtyError => 'Enter a quantity greater than 0.';

  @override
  String get invTransferDone => 'Transfer recorded.';

  @override
  String get invNeedTwoWarehouses =>
      'You need at least two warehouses to transfer.';

  @override
  String get invNewWarehouse => 'New warehouse';

  @override
  String get invDefaultChip => 'Main';

  @override
  String get invActive => 'Active';

  @override
  String get invInactive => 'Inactive';

  @override
  String get error_OUT_OF_STOCK => 'Not enough stock.';

  @override
  String get error_MOVEMENT_REASON_REQUIRED =>
      'Give the reason for the adjustment.';

  @override
  String get error_VARIANT_NOT_FOUND =>
      'The product does not exist or is archived.';

  @override
  String get error_INVENTORY_NOT_TRACKED =>
      'This product does not track stock.';

  @override
  String get error_SAME_WAREHOUSE => 'Choose two different warehouses.';

  @override
  String get error_INVALID_WAREHOUSE => 'The warehouse is invalid or inactive.';

  @override
  String get error_IDEMPOTENCY_KEY_REUSED =>
      'This operation was already recorded with other data.';

  @override
  String get posOpenTitle => 'Open register';

  @override
  String get posTerminal => 'Register';

  @override
  String get posTerminalHelper =>
      'Each register collects through one of your payment points.';

  @override
  String get posNoTerminals => 'First create a payment point in Finance.';

  @override
  String get posOpeningFloat => 'Opening cash float';

  @override
  String get posOpen => 'Open register';

  @override
  String get posSearchHint => 'Search or scan';

  @override
  String get posTicket => 'Ticket';

  @override
  String get posTicketEmpty => 'Add products to the sale.';

  @override
  String get posSubtotal => 'Subtotal';

  @override
  String posTaxLine(String percent) {
    return 'ITBMS $percent';
  }

  @override
  String get posExempt => 'Exempt';

  @override
  String get posTotal => 'Total';

  @override
  String posCharge(String total) {
    return 'Charge $total';
  }

  @override
  String get posClear => 'Clear';

  @override
  String get posClearConfirm => 'Clear the ticket?';

  @override
  String get posCustomerFinal => 'Walk-in customer';

  @override
  String get posNotFound => 'No product matches that code.';

  @override
  String posQtyTitle(String name) {
    return 'Quantity of $name';
  }

  @override
  String posStockQty(String qty) {
    return 'Stock: $qty';
  }

  @override
  String get posMenuSales => 'Shift sales';

  @override
  String get posMenuCash => 'Cash movements';

  @override
  String get posMenuClose => 'Close register';

  @override
  String get posProductsEmpty => 'You have no products in the catalog yet.';

  @override
  String posRemoveLine(String name) {
    return 'Remove $name';
  }

  @override
  String get posIncrease => 'Add one';

  @override
  String get posDecrease => 'Remove one';

  @override
  String get posPayTitle => 'Payment';

  @override
  String posRemaining(String amount) {
    return 'Remaining $amount';
  }

  @override
  String get posMethodCash => 'Cash';

  @override
  String get posMethodWallet => 'PlentyPay balance';

  @override
  String get posReceived => 'Received';

  @override
  String posChange(String amount) {
    return 'Change $amount';
  }

  @override
  String get posExact => 'Exact amount';

  @override
  String get posWalletWaiting => 'Waiting for the customer…';

  @override
  String posWalletScan(String amount) {
    return 'Scan to pay $amount';
  }

  @override
  String get posFinish => 'Finish sale';

  @override
  String get posConfirming => 'Confirming';

  @override
  String get posPaidChip => 'Paid';

  @override
  String get posLeaveWaiting => 'Leave the sale pending';

  @override
  String get posWalletFailed =>
      'The customer did not complete the payment. Choose another method.';

  @override
  String get posCashShort => 'The amount received does not cover the total.';

  @override
  String get posWalletAmount => 'Amount with PlentyPay balance';

  @override
  String get posReceiptTitle => 'Receipt';

  @override
  String posReceiptNumber(String number) {
    return 'Receipt $number';
  }

  @override
  String get posInternalReceipt => 'Internal receipt';

  @override
  String get posNotFiscal => 'This document is not a tax invoice.';

  @override
  String get posNewSale => 'New sale';

  @override
  String get posPayments => 'Payments';

  @override
  String get posSalesTitle => 'Shift sales';

  @override
  String get posSalesEmpty => 'No sales in this shift yet.';

  @override
  String get saleStatus_PAID => 'Paid';

  @override
  String get saleStatus_AWAITING_PAYMENT => 'Pending confirmation';

  @override
  String get saleStatus_VOIDED => 'Voided';

  @override
  String get saleStatus_OPEN => 'Open';

  @override
  String posSaleNumber(String number) {
    return 'No. $number';
  }

  @override
  String get posCashTitle => 'Cash movements';

  @override
  String get posExpected => 'Expected in drawer';

  @override
  String get posCashIn => 'Cash in';

  @override
  String get posCashOut => 'Cash out';

  @override
  String get posAmount => 'Amount';

  @override
  String get posReason_CHANGE => 'Change';

  @override
  String get posReason_SUPPLIER => 'Supplier payment';

  @override
  String get posReason_SAFE => 'Safe drop';

  @override
  String get posReason_OTHER => 'Other';

  @override
  String get posCashRecorded => 'Movement recorded.';

  @override
  String get posAmountError => 'Enter an amount greater than \$0.00.';

  @override
  String get posCloseTitle => 'Close and count';

  @override
  String get posCounted => 'Counted cash';

  @override
  String get posConfirmCount => 'Confirm count';

  @override
  String posExpectedValue(String amount) {
    return 'Expected $amount';
  }

  @override
  String posCountedValue(String amount) {
    return 'Counted $amount';
  }

  @override
  String posDifferenceValue(String amount) {
    return 'Difference $amount';
  }

  @override
  String get posCloseNotes => 'Note';

  @override
  String get posCloseNotesRequired => 'Explain the difference.';

  @override
  String get posCloseDo => 'Close register';

  @override
  String get posClosed => 'Register closed.';

  @override
  String get posVoid => 'Void sale';

  @override
  String get posVoidReason => 'Reason for voiding';

  @override
  String get error_SESSION_ALREADY_OPEN =>
      'This register already has an open session.';

  @override
  String get error_SESSION_CLOSED => 'The register session is closed.';

  @override
  String get error_NOT_SESSION_OWNER =>
      'The session belongs to another cashier.';

  @override
  String get error_SALES_PENDING => 'You have parked or unconfirmed sales.';

  @override
  String get error_EMPTY_SALE => 'Add products to the sale.';

  @override
  String get error_TENDERS_MISMATCH =>
      'The payments do not add up to the total.';

  @override
  String get error_RAIL_NOT_SUPPORTED =>
      'That payment method is not available at the register yet.';

  @override
  String get error_PRODUCT_NOT_FOUND =>
      'The product does not exist or is archived.';

  @override
  String get error_DISCOUNT_EXCEEDS_LIMIT =>
      'The discount exceeds the allowed maximum.';

  @override
  String get error_HAS_CAPTURED_PAYMENTS =>
      'The sale already has payments; make a return.';

  @override
  String get error_REASON_REQUIRED => 'Give the reason.';

  @override
  String get error_TENANT_REQUIRED => 'You need an active business.';

  @override
  String get paySaleAt => 'Payment for a register sale';

  @override
  String get mktSearchHint => 'Search products or stores';

  @override
  String mktNoResults(String query) {
    return 'We found no results for “$query”.';
  }

  @override
  String get mktEmpty => 'No products are published yet.';

  @override
  String get mktSoldOut => 'Sold out';

  @override
  String get mktTaxIncluded => 'ITBMS included';

  @override
  String mktPerUnit(String unit) {
    return 'per $unit';
  }

  @override
  String mktSoldBy(String store) {
    return 'Sold by $store';
  }

  @override
  String get mktSeeStore => 'See store';

  @override
  String get mktPickupFree => 'Free in-store pickup';

  @override
  String get mktAddToCart => 'Add to cart';

  @override
  String get mktAdded => 'Added to cart.';

  @override
  String get mktQuantity => 'Quantity';

  @override
  String get mktCart => 'Cart';

  @override
  String get mktCartEmpty => 'Your cart is empty.';

  @override
  String get mktExplore => 'Explore stores';

  @override
  String mktSubtotal(String amount) {
    return 'Subtotal $amount';
  }

  @override
  String mktItemsTotal(String amount) {
    return 'Products total $amount';
  }

  @override
  String get mktShippingNext => 'Shipping is calculated in the next step.';

  @override
  String get mktContinue => 'Continue';

  @override
  String mktRemoved(String name) {
    return '$name removed from the cart.';
  }

  @override
  String get mktUndo => 'Undo';

  @override
  String get mktCheckoutTitle => 'Pay for the order';

  @override
  String get mktPickup => 'In-store pickup';

  @override
  String get mktDeliverySoon => 'Home delivery is coming soon.';

  @override
  String get mktPayMethod => 'Payment method';

  @override
  String mktProducts(String amount) {
    return 'Products $amount';
  }

  @override
  String mktTaxIncludedAmount(String amount) {
    return 'ITBMS included $amount';
  }

  @override
  String get mktTotalToPay => 'Total to pay';

  @override
  String get mktAcceptNotice =>
      'Each store has 15 minutes to accept your order. If one does not, we refund its part.';

  @override
  String mktPay(String total) {
    return 'Pay $total';
  }

  @override
  String get mktPriceChangedTitle => 'The total changed';

  @override
  String get mktPriceChangedBody =>
      'Prices changed since you opened the cart. Review the new total.';

  @override
  String get mktReviewCart => 'Review cart';

  @override
  String get mktMyOrders => 'My orders';

  @override
  String get mktOrdersEmpty => 'You have not placed any orders yet.';

  @override
  String get mktInProgress => 'In progress';

  @override
  String get mktPast => 'Past';

  @override
  String mktOrderNumber(String number) {
    return 'Order $number';
  }

  @override
  String mktStores(String n) {
    return '$n stores';
  }

  @override
  String get orderStatus_PENDING_PAYMENT => 'To pay';

  @override
  String get orderStatus_PAID => 'Paid';

  @override
  String get orderStatus_PARTIALLY_FULFILLED => 'Partly fulfilled';

  @override
  String get orderStatus_COMPLETED => 'Completed';

  @override
  String get orderStatus_CANCELLED => 'Cancelled';

  @override
  String get orderStatus_REFUNDED => 'Refunded';

  @override
  String get subStatus_PENDING_PAYMENT => 'To pay';

  @override
  String get subStatus_AWAITING_ACCEPTANCE => 'Waiting for the store';

  @override
  String get subStatus_ACCEPTED => 'Accepted';

  @override
  String get subStatus_READY => 'Ready for pickup';

  @override
  String get subStatus_IN_DELIVERY => 'On the way';

  @override
  String get subStatus_COMPLETED => 'Delivered';

  @override
  String get subStatus_REJECTED => 'Rejected';

  @override
  String get subStatus_CANCELLED => 'Cancelled';

  @override
  String mktPickupCode(String code) {
    return 'Show this code at pickup: $code';
  }

  @override
  String mktRejectedRefund(String store, String amount) {
    return '$store could not accept your order. We refunded $amount.';
  }

  @override
  String get mktCancelOrder => 'Cancel order';

  @override
  String get mktCancelConfirm =>
      'Cancel the order? If you already paid, we refund the money.';

  @override
  String mktCountdown(String time) {
    return '$time left for the store to accept';
  }

  @override
  String get mktOrderPaying => 'Confirming the payment…';

  @override
  String get mktStoreFallback => 'Store';

  @override
  String get error_LISTING_UNAVAILABLE => 'The product is no longer available.';

  @override
  String get error_CART_LIMIT =>
      'Your cart reached the maximum number of products.';

  @override
  String get error_PRICE_CHANGED => 'Prices changed; review your cart.';

  @override
  String get error_DELIVERY_UNAVAILABLE =>
      'Home delivery is not available yet.';

  @override
  String get error_EMPTY_CART => 'Your cart is empty.';

  @override
  String get error_ACCEPT_DEADLINE_PASSED =>
      'The time to accept ended. The order was refunded.';

  @override
  String get error_PICKUP_CODE_MISMATCH => 'The code does not match.';

  @override
  String get error_LISTING_INCOMPLETE =>
      'The product needs a photo and a price to be published.';

  @override
  String ordTabToAccept(String n) {
    return 'To accept ($n)';
  }

  @override
  String ordTabPreparing(String n) {
    return 'Preparing ($n)';
  }

  @override
  String ordTabReady(String n) {
    return 'Ready ($n)';
  }

  @override
  String get ordTabHistory => 'History';

  @override
  String get ordEmpty => 'No orders here.';

  @override
  String ordItems(String n) {
    return '$n products';
  }

  @override
  String get ordAccept => 'Accept order';

  @override
  String get ordMarkReady => 'Mark ready';

  @override
  String get ordHandOver => 'Hand over to the customer';

  @override
  String get ordReject => 'Reject';

  @override
  String get ordRejectReason => 'Reason for rejecting';

  @override
  String get ordReason_STOCK => 'Out of stock';

  @override
  String get ordReason_CLOSED => 'Store closed';

  @override
  String get ordReason_OTHER => 'Other';

  @override
  String ordRejectConfirm(String amount) {
    return 'Reject and refund $amount';
  }

  @override
  String get ordCustomerCode => 'Customer code';

  @override
  String get ordPickupLabel => 'In-store pickup';

  @override
  String get ordDone => 'Order updated.';

  @override
  String get sfTitle => 'My online store';

  @override
  String get sfVisible => 'Your store is visible';

  @override
  String get sfHidden => 'Your store is hidden';

  @override
  String get sfName => 'Store name';

  @override
  String get sfDescription => 'Description';

  @override
  String get sfPublishStore => 'Show my store in the marketplace';

  @override
  String get sfProducts => 'Published products';

  @override
  String get sfPublish => 'Publish';

  @override
  String get sfSaved => 'Store saved.';

  @override
  String get sfNoProducts => 'First create products in your catalog.';

  @override
  String get mktVerified => 'Verified business';

  @override
  String get mktAcceptNewTotal => 'Accept new total';

  @override
  String mktPriceChangedFromTo(String from, String to) {
    return 'The total changed from $from to $to.';
  }

  @override
  String get mktShowInMarketplace => 'Show in the marketplace';

  @override
  String get mktListedChip => 'In the marketplace';

  @override
  String get mktStoreHiddenHint =>
      'Your store is hidden: the product will show once you make it visible.';

  @override
  String get mktListingOn => 'Product published in the marketplace.';

  @override
  String get mktListingOff => 'Product hidden from the marketplace.';

  @override
  String get stepUpTitle => 'Confirm it\'s you';

  @override
  String get stepUpConfirm => 'Confirm';

  @override
  String get error_PIN_INVALID => 'Wrong PIN.';

  @override
  String get error_PIN_LOCKED => 'Too many attempts. Wait a few minutes.';

  @override
  String get error_PIN_NOT_SET => 'Create your confirmation PIN first.';

  @override
  String get error_PASSKEY_VERIFICATION_FAILED =>
      'We couldn\'t verify your key. Use your PIN.';

  @override
  String get error_PASSKEYS_UNAVAILABLE => 'Passkeys aren\'t available yet.';

  @override
  String get error_STEP_UP_METHOD_NOT_ALLOWED =>
      'That method doesn\'t work for this operation.';

  @override
  String get error_UNKNOWN_OPERATION =>
      'We couldn\'t prepare the confirmation.';

  @override
  String get stepUpPinLabel => '6-digit PIN';

  @override
  String get stepUpPasswordLabel => 'Password';

  @override
  String stepUpPinAttempts(num count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count attempts',
      one: '1 attempt',
    );
    return 'Wrong PIN. $_temp0 left.';
  }

  @override
  String stepUpPinLockedMinutes(num minutes) {
    String _temp0 = intl.Intl.pluralLogic(
      minutes,
      locale: localeName,
      other: '$minutes minutes',
      one: '1 minute',
    );
    return 'Too many attempts. Wait $_temp0.';
  }

  @override
  String get stepUpCreatePin => 'Create PIN';

  @override
  String get stepUpExpired => 'The confirmation expired. Try again.';

  @override
  String get stepUpOpPayment => 'Payment';

  @override
  String get stepUpOpRefund => 'Refund';

  @override
  String get stepUpOpTransfer => 'Transfer';

  @override
  String get stepUpOpRole => 'Save a role';

  @override
  String get stepUpOpInvite => 'Invite a person';

  @override
  String get stepUpOpMembership => 'Change a person\'s access';

  @override
  String get stepUpOpCapabilities => 'Change business features';

  @override
  String get stepUpOpPasswordChange => 'Change your password';

  @override
  String get stepUpOpPinSet => 'Create or change your PIN';

  @override
  String get pinSetupTitle => 'Confirmation PIN';

  @override
  String get pinSetupHelper =>
      '6 digits. We ask for it to confirm payments and important changes.';

  @override
  String get pinNew => 'New PIN';

  @override
  String get pinRepeat => 'Repeat the PIN';

  @override
  String get pinMismatch => 'The PINs don\'t match.';

  @override
  String get pinFormatHint => 'Enter 6 digits.';

  @override
  String get pinSaved => 'PIN saved.';

  @override
  String get actionSavePin => 'Save PIN';

  @override
  String get securityTitle => 'Security';

  @override
  String get securityPinRow => 'Confirmation PIN';

  @override
  String get securityPinSet => 'Set up';

  @override
  String get securityPinNotSet => 'Not set up';

  @override
  String get securityPinLocked => 'Locked after too many attempts';

  @override
  String get fieldRepeatNewPassword => 'Repeat the new password';

  @override
  String get passwordMismatch => 'The passwords don\'t match.';

  @override
  String get catTakePhoto => 'Take photo';

  @override
  String get catChooseFromGallery => 'Choose from gallery';

  @override
  String get error_FILE_TOO_LARGE =>
      'The photo is over 5 MB. Choose a smaller one.';

  @override
  String get error_UNSUPPORTED_FILE_TYPE =>
      'The photo must be JPEG, PNG or WebP.';

  @override
  String get error_PROFILE_MISSING =>
      'Complete your tax profile to issue invoices.';

  @override
  String get error_INVALID_RUC => 'Check the RUC and DV: the DV has 2 digits.';

  @override
  String get error_INVALID_TAXPAYER =>
      'Check the tax customer details: the address is missing or something is not valid.';

  @override
  String get error_TOTALS_MISMATCH =>
      'The amounts don\'t add up. Check the lines.';

  @override
  String get error_PAC_NOT_CONFIGURED =>
      'Production is enabled after legal validation.';

  @override
  String get error_RELATED_NOT_ACCEPTED =>
      'Notes can only be issued for authorized invoices.';

  @override
  String get error_EXCEEDS_ORIGINAL => 'Credit notes exceed the invoice total.';

  @override
  String get fiscalInvoicesTitle => 'Tax documents';

  @override
  String get fiscalTaxpayersTitle => 'Tax customers';

  @override
  String get fiscalDemoBanner => 'Test mode: documents have no tax validity.';

  @override
  String get fiscalDocInvoice => 'Invoice';

  @override
  String get fiscalDocCredit => 'Credit note';

  @override
  String get fiscalDocDebit => 'Debit note';

  @override
  String get fiscalStatusDraft => 'Draft';

  @override
  String get fiscalStatusQueued => 'Queued';

  @override
  String get fiscalStatusSent => 'Sent';

  @override
  String get fiscalStatusAccepted => 'Authorized';

  @override
  String get fiscalStatusRejected => 'Rejected';

  @override
  String get fiscalStatusVoided => 'Voided';

  @override
  String get fiscalFilterAllTypes => 'All types';

  @override
  String get fiscalFilterAllStatuses => 'All statuses';

  @override
  String get fiscalInvoicesEmpty => 'There are no tax documents yet.';

  @override
  String get fiscalNewInvoice => 'New invoice';

  @override
  String get fiscalFinalConsumer => 'Final consumer';

  @override
  String get fiscalCustomer => 'Customer';

  @override
  String get fiscalChooseCustomer => 'Choose a frequent customer';

  @override
  String get fiscalLines => 'Lines';

  @override
  String get fiscalAddLine => 'Add line';

  @override
  String get fiscalRemoveLine => 'Remove line';

  @override
  String get fiscalLineDescription => 'Description';

  @override
  String get fiscalLineQty => 'Quantity';

  @override
  String get fiscalLinePrice => 'Price';

  @override
  String get fiscalLineRate => 'ITBMS';

  @override
  String get fiscalExempt => 'Exempt';

  @override
  String fiscalRatePercent(Object percent) {
    return '$percent%';
  }

  @override
  String get fiscalPaymentMethod => 'Payment method';

  @override
  String get fiscalPayCash => 'Cash';

  @override
  String get fiscalPayCard => 'Card';

  @override
  String get fiscalPayTransfer => 'Transfer';

  @override
  String get fiscalPayWallet => 'Wallet';

  @override
  String get fiscalSubtotal => 'Subtotal';

  @override
  String get fiscalTax => 'ITBMS';

  @override
  String get fiscalTotal => 'Total';

  @override
  String get fiscalIssue => 'Issue invoice';

  @override
  String get fiscalIssued => 'Invoice queued for authorization.';

  @override
  String get fiscalCopyCufe => 'Copy CUFE';

  @override
  String get fiscalCopied => 'Copied.';

  @override
  String get fiscalPending => 'Receipt pending authorization.';

  @override
  String fiscalRejectionReason(Object reason) {
    return 'Provider\'s reason: $reason';
  }

  @override
  String get fiscalIssueCreditNote => 'Issue credit note';

  @override
  String get fiscalIssueDebitNote => 'Issue debit note';

  @override
  String get fiscalNoteReason => 'Reason';

  @override
  String get fiscalNoteIssued => 'Note queued for authorization.';

  @override
  String get fiscalNoteRequired => 'Enter the reason for the note.';

  @override
  String get fiscalIssuer => 'Issuer';

  @override
  String get fiscalReceiver => 'Receiver';

  @override
  String fiscalNumber(Object number) {
    return 'No. $number';
  }

  @override
  String get fiscalTaxpayersEmpty => 'You don\'t have tax customers yet.';

  @override
  String get fiscalAddTaxpayer => 'Add customer';

  @override
  String get fiscalSearch => 'Search by name or ID';

  @override
  String get fiscalIdType => 'ID type';

  @override
  String get fiscalIdRucJuridico => 'Company RUC';

  @override
  String get fiscalIdRucNatural => 'Individual RUC';

  @override
  String get fiscalIdCedula => 'Cédula';

  @override
  String get fiscalIdPasaporte => 'Passport';

  @override
  String get fiscalIdExtranjero => 'Foreign ID';

  @override
  String get fiscalTaxId => 'RUC or ID';

  @override
  String get fiscalDv => 'DV';

  @override
  String get fiscalLegalName => 'Name or company name';

  @override
  String get fiscalEmail => 'Email (optional)';

  @override
  String get fiscalTaxpayerSaved => 'Customer saved.';

  @override
  String get fiscalFieldRequired => 'This field is required.';

  @override
  String fiscalIssuerData(String ruc, String dv) {
    return 'RUC $ruc · DV $dv';
  }

  @override
  String get fiscalBranch => 'Branch';

  @override
  String get fiscalPos => 'Point of sale';

  @override
  String get fiscalPac => 'Invoicing provider (PAC)';

  @override
  String get fiscalPacSimulator => 'Simulator (test)';

  @override
  String get fiscalEnvironment => 'Environment';

  @override
  String get fiscalEnvTest => 'Test';

  @override
  String get fiscalEnvProd => 'Production';

  @override
  String get fiscalProdUnavailable =>
      'Production is enabled after legal validation.';

  @override
  String get fiscalPreference => 'Which document to issue';

  @override
  String get fiscalPrefAlways => 'Always an invoice';

  @override
  String get fiscalPrefInternal => 'Internal receipt only';

  @override
  String get fiscalPrefAsk => 'Ask';

  @override
  String get fiscalPrefAuto => 'Automatic above an amount';

  @override
  String get fiscalThreshold => 'Invoice from';

  @override
  String fiscalFolios(Object count) {
    return 'Available folios: $count';
  }

  @override
  String get fiscalFoliosUnlimited => 'No folio limit';

  @override
  String get fiscalProfileSaved => 'Tax profile saved.';

  @override
  String get fiscalNoProfileYet =>
      'You don\'t have a tax profile yet. Complete it to issue invoices.';

  @override
  String get stepUpOpCredentials => 'Set up electronic invoicing';

  @override
  String get fiscalIdGobierno => 'Government entity';

  @override
  String get fiscalPacCredentials => 'PAC credentials';

  @override
  String get fiscalPacConfigured => 'Configured';

  @override
  String get fiscalPacChangeCredentials => 'Change credentials';

  @override
  String get fiscalProdConfirm => 'Your invoices will have tax validity.';

  @override
  String fiscalPacFolios(int count) {
    return 'In your PAC account: $count';
  }

  @override
  String get fiscalAddress => 'Address';

  @override
  String get fiscalAddressOptional => 'Address (optional)';

  @override
  String get fiscalAddressHelp => 'The DGI requires it to invoice a RUC.';

  @override
  String get fiscalAddressInvalid => 'Enter 5 to 100 characters.';

  @override
  String get fiscalLocation => 'Province-district-township (optional)';

  @override
  String get fiscalLocationInvalid =>
      'Use the province-district-township format, for example 8-8-7.';

  @override
  String get navMore => 'More';

  @override
  String homeGreetingName(String name) {
    return 'Hello, $name';
  }

  @override
  String get homePendingReview => 'Your business is under review';

  @override
  String get homePendingReviewBody =>
      'We\'ll let you know when we finish reviewing your documents. You can\'t collect payments until then.';

  @override
  String get homePendingRejected => 'Your business was rejected.';

  @override
  String get homePendingSuspended => 'Your business was suspended.';

  @override
  String get homePendingBusinessBody => 'See the reason in My business.';

  @override
  String get homePendingFiscal => 'Complete your tax profile';

  @override
  String get homePendingFiscalBody =>
      'You need it to issue electronic invoices.';

  @override
  String get homeSalesToday => 'Today\'s sales';

  @override
  String homeSalesCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sales',
      one: '1 sale',
      zero: 'No sales yet',
    );
    return '$_temp0';
  }

  @override
  String get homeOrdersPending => 'Orders to accept';

  @override
  String homeOrdersCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count orders',
      one: '1 order',
    );
    return '$_temp0';
  }

  @override
  String homeOrdersDeadline(String time) {
    return 'due in $time';
  }

  @override
  String get homeOrdersExpired => 'deadline passed';

  @override
  String homeAlerts(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count alerts',
      one: '1 alert',
    );
    return '$_temp0';
  }

  @override
  String homeAlertLowStock(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count products with low stock',
      one: '1 product with low stock',
    );
    return '$_temp0';
  }

  @override
  String homeAlertFolios(int count) {
    return 'Few folios left: $count';
  }

  @override
  String get settlementsTitle => 'Payouts';

  @override
  String get settlementPending => 'Pending payout';

  @override
  String settlementProcessing(String amount) {
    return 'Processing: $amount';
  }

  @override
  String get settlementManual => 'Manual payouts';

  @override
  String settlementNext(String date) {
    return 'Next payout: $date';
  }

  @override
  String get settleNow => 'Pay out now';

  @override
  String settleNowPaid(String amount) {
    return '$amount was paid to your wallet.';
  }

  @override
  String settleNowProcessing(String amount) {
    return 'Payout of $amount in progress: we\'ll let you know when it reaches your account.';
  }

  @override
  String get settlementsEmpty => 'You don\'t have payouts yet.';

  @override
  String settlementBatchNumber(String id) {
    return 'Batch $id';
  }

  @override
  String get settlementSandbox => 'Test';

  @override
  String get settlementSandboxNotice =>
      'Includes test charges: it isn\'t real money and is only paid to your wallet.';

  @override
  String get settlementGross => 'Charges included';

  @override
  String get settlementRefunds => 'Refunds deducted';

  @override
  String get settlementNet => 'Total paid out';

  @override
  String get settlementDestination => 'Destination';

  @override
  String get settlementBankRef => 'Bank reference';

  @override
  String get settlementPaidAt => 'Paid on';

  @override
  String get settlementFailedHint => 'Check your destination account.';

  @override
  String settlementItems(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String get settlementItemPayment => 'Charge';

  @override
  String get settlementItemRefund => 'Refund';

  @override
  String get batchStatusOpen => 'Open';

  @override
  String get batchStatusProcessing => 'Processing';

  @override
  String get batchStatusPaid => 'Paid';

  @override
  String get batchStatusFailed => 'Failed';

  @override
  String payoutDestinationBankMasked(String last4) {
    return 'Account •••• $last4';
  }

  @override
  String get payoutDestinationWallet => 'Business wallet';

  @override
  String get payoutDestinationBank => 'Bank account';

  @override
  String get payoutSettingsTitle => 'Payout schedule';

  @override
  String get payoutSettingsSaved => 'Schedule saved.';

  @override
  String get payoutFrequency => 'Frequency';

  @override
  String get payoutDaily => 'Daily';

  @override
  String get payoutWeekly => 'Weekly';

  @override
  String get payoutManual => 'Manual';

  @override
  String get payoutWeekday => 'Day of the week';

  @override
  String get payoutCutoffHint =>
      'Paid out automatically at 5:00 p.m. Panama time.';

  @override
  String get payoutMinimum => 'Pay out only above';

  @override
  String get payoutDestination => 'Destination';

  @override
  String get payoutBank => 'Bank';

  @override
  String get payoutAccountChecking => 'Checking';

  @override
  String get payoutAccountSavings => 'Savings';

  @override
  String get payoutAccountNumber => 'Account number';

  @override
  String get payoutHolder => 'Account holder';

  @override
  String get payoutChangeAccount => 'Change account';

  @override
  String get payoutChangeNotice =>
      'For security, payouts to a new bank account start 48 hours after the change.';

  @override
  String payoutBlockedUntil(String date) {
    return 'Payouts on hold until $date.';
  }

  @override
  String get weekdayMonday => 'Monday';

  @override
  String get weekdayTuesday => 'Tuesday';

  @override
  String get weekdayWednesday => 'Wednesday';

  @override
  String get weekdayThursday => 'Thursday';

  @override
  String get weekdayFriday => 'Friday';

  @override
  String get weekdaySaturday => 'Saturday';

  @override
  String get weekdaySunday => 'Sunday';

  @override
  String get error_NOTHING_TO_SETTLE => 'You have no charges ready to pay out.';

  @override
  String get error_BELOW_MINIMUM =>
      'The available amount doesn\'t reach your payout minimum.';

  @override
  String get error_SANDBOX_FUNDS =>
      'Your test charges can only be paid out to the business wallet.';

  @override
  String get error_PAYOUTS_BLOCKED =>
      'For security, payouts to your new account start 48 hours after the change.';

  @override
  String get error_INVALID_DESTINATION =>
      'The account holder doesn\'t match your business.';

  @override
  String get error_CONCURRENT_BATCH =>
      'A payout was already being created. Refresh and try again.';

  @override
  String financePendingSettlement(String amount) {
    return 'Pending payout $amount';
  }

  @override
  String get invPurchasingMenu => 'Purchasing';

  @override
  String get invSuppliersTitle => 'Suppliers';

  @override
  String get supplierAdd => 'Add supplier';

  @override
  String get suppliersEmpty =>
      'You have no suppliers yet. Add one to create purchase orders.';

  @override
  String supplierRucLine(String taxId, String dv) {
    return 'RUC $taxId DV $dv';
  }

  @override
  String supplierLeadLine(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'Delivers in $days days',
      one: 'Delivers in 1 day',
    );
    return '$_temp0';
  }

  @override
  String get supplierInactive => 'Inactive';

  @override
  String get supplierSaved => 'Supplier saved.';

  @override
  String get supplierName => 'Legal name';

  @override
  String get supplierPhone => 'Phone (optional)';

  @override
  String get supplierLeadTime => 'Delivery days';

  @override
  String get supplierActive => 'Active';

  @override
  String get poTitle => 'Purchase orders';

  @override
  String get poNew => 'New order';

  @override
  String get poFilterAll => 'All';

  @override
  String get poEmpty => 'There are no purchase orders.';

  @override
  String poNumber(String number, String supplier) {
    return 'Order $number · $supplier';
  }

  @override
  String get poCancelTitle => 'Cancel the order?';

  @override
  String get poCancelBody =>
      'The order will be cancelled and can no longer be received. This cannot be undone.';

  @override
  String get poKeep => 'Keep the order';

  @override
  String get poCancel => 'Cancel order';

  @override
  String poCreatedOn(String date) {
    return 'Created on $date';
  }

  @override
  String poExpectedOn(String date) {
    return 'Expected on $date';
  }

  @override
  String poLineSummary(String ordered, String received, String cost) {
    return 'Ordered $ordered · Received $received · Cost $cost';
  }

  @override
  String get poTotal => 'Total';

  @override
  String get poMarkSent => 'Mark as sent';

  @override
  String get poReceive => 'Receive';

  @override
  String get poSaved => 'Draft saved.';

  @override
  String get poNeedsSupplier =>
      'Add an active supplier before creating an order.';

  @override
  String get poSupplier => 'Supplier';

  @override
  String get poWarehouse => 'Destination warehouse';

  @override
  String get poExpected => 'Expected date';

  @override
  String get poExpectedNone => 'No date';

  @override
  String get poLines => 'Products';

  @override
  String get poAddLine => 'Add product';

  @override
  String get poSaveDraft => 'Save draft';

  @override
  String get poProduct => 'Product';

  @override
  String get poDuplicateProduct => 'This product is already in the order.';

  @override
  String get poQuantity => 'Quantity';

  @override
  String get poUnitCost => 'Unit cost';

  @override
  String get poRemoveLine => 'Remove';

  @override
  String get poStatusDraft => 'Draft';

  @override
  String get poStatusSent => 'Sent';

  @override
  String get poStatusPartial => 'Partially received';

  @override
  String get poStatusReceived => 'Received';

  @override
  String get poStatusCancelled => 'Cancelled';

  @override
  String get poReceived => 'Receipt recorded.';

  @override
  String get poReceiveTitle => 'Receiving';

  @override
  String poReceiveLine(String ordered, String before) {
    return 'Ordered $ordered · Received before $before';
  }

  @override
  String get poReceiveNow => 'Received now';

  @override
  String get poSupplierInvoice => 'Supplier invoice (optional)';

  @override
  String get poSupplierInvoiceTooLong => '60 characters at most.';

  @override
  String get poReceiveSubmit => 'Record receipt';

  @override
  String get poInvalidQuantity => 'Enter a valid quantity.';

  @override
  String get reorderTitle => 'Reorder suggestions';

  @override
  String get reorderEmpty => 'Nothing to restock: your stock covers demand.';

  @override
  String get reorderHint =>
      'Based on the last 28 days of sales and the supplier delivery days.';

  @override
  String get reorderCreateOrder => 'Create purchase order';

  @override
  String reorderCover(int days) {
    String _temp0 = intl.Intl.pluralLogic(
      days,
      locale: localeName,
      other: 'Covers $days days',
      one: 'Covers 1 day',
      zero: 'No cover',
    );
    return '$_temp0';
  }

  @override
  String get reorderNoSales => 'No recent sales';

  @override
  String reorderAbc(String abc) {
    return 'Class $abc';
  }

  @override
  String reorderStockLine(String available, String transit, String daily) {
    return 'Available $available · In transit $transit · Daily sales $daily';
  }

  @override
  String get reorderNoSupplier => 'No usual supplier';

  @override
  String reorderSupplier(String name) {
    return 'Usual supplier: $name';
  }

  @override
  String reorderSuggested(String quantity) {
    return 'Suggested: $quantity';
  }

  @override
  String get error_INVALID_SUPPLIER =>
      'Check the supplier details: RUC with DV, valid email and phone.';

  @override
  String get error_RECEIPT_EXCEEDS_ORDERED =>
      'You are receiving more than was ordered.';

  @override
  String get error_UNKNOWN_ORDER_LINE => 'That product is not in the order.';

  @override
  String get error_PO_STATE =>
      'The order already changed status. Refresh and try again.';

  @override
  String get posPark => 'Park';

  @override
  String get posParkTitle => 'Park sale';

  @override
  String get posParkLabel => 'Note to recognize it (optional)';

  @override
  String get posParked => 'Sale parked.';

  @override
  String get posMenuParked => 'Parked sales';

  @override
  String get posParkedTitle => 'Parked sales';

  @override
  String get posParkedBusy =>
      'Charge, park or clear the current sale to resume another one.';

  @override
  String get posParkedEmpty => 'You have no parked sales.';

  @override
  String get posParkedNoLabel => 'No note';

  @override
  String posParkedAt(String date, String time) {
    return 'Parked on $date at $time';
  }

  @override
  String posParkedItems(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items',
      one: '1 item',
    );
    return '$_temp0';
  }

  @override
  String get posParkedResume => 'Resume';

  @override
  String get posParkedVoid => 'Void';

  @override
  String get posParkedVoidTitle => 'Void the parked sale?';

  @override
  String get posParkedVoided => 'Sale voided.';

  @override
  String posParkedRemoved(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count items are no longer for sale and were removed.',
      one: '1 item is no longer for sale and was removed.',
    );
    return '$_temp0';
  }

  @override
  String get scanHint => 'Point the camera at the barcode or QR code.';

  @override
  String get scanSwitchCamera => 'Switch camera';

  @override
  String get scanCameraDenied => 'No camera permission. You can type the code.';

  @override
  String get scanEnableCamera => 'Turn on camera';

  @override
  String get scanManualLabel => 'Or type the code';

  @override
  String get scanManualSubmit => 'Use this code';

  @override
  String get payVerifiedPerson => 'Verified PlentyPay user';

  @override
  String sendButton(String total) {
    return 'Send $total';
  }

  @override
  String get sendNoFee => 'Sending between people has no fee.';

  @override
  String get sendScanHint => 'Scan the recipient\'s code or type it below.';

  @override
  String get receiveScanToSend => 'Code to send you money with PlentyPay';

  @override
  String get receiveHint =>
      'Show this code to receive money. It identifies you without showing your email or phone.';

  @override
  String receiveValidUntil(String date) {
    return 'Valid until $date';
  }

  @override
  String get receiveAmount => 'Request an amount (optional)';

  @override
  String get receiveAppOnly =>
      'For now this code is read with the PlentyPay app.';

  @override
  String get error_SELF_TRANSFER => 'You can\'t send money to yourself.';

  @override
  String get catTrackLots => 'Tracks lots and expiry dates';

  @override
  String get catTrackLotsHint =>
      'Each intake asks for the supplier lot; sales take what expires first.';

  @override
  String get invLots => 'Lots';

  @override
  String get invNoLots => 'No lots in stock.';

  @override
  String invLotLabel(String code) {
    return 'Lot $code';
  }

  @override
  String invLotExpires(String date) {
    return 'Expires on $date';
  }

  @override
  String get invLotNoExpiry => 'No expiry date';

  @override
  String get invLotExpired => 'Expired';

  @override
  String get invLotExpiringSoon => 'Expires soon';

  @override
  String get invLotCode => 'Supplier lot';

  @override
  String get invLotExpiry => 'Expiry date';

  @override
  String get invLotClearExpiry => 'Clear expiry date';

  @override
  String get invLotOut => 'Lot taken out';

  @override
  String get invLotAuto => 'Automatic (what expires first)';

  @override
  String invLotOption(String code, String qty) {
    return '$code · $qty';
  }

  @override
  String get error_LOT_REQUIRED => 'This product tracks lots: enter the lot.';

  @override
  String get error_LOT_EXPIRED => 'That lot is expired.';

  @override
  String get error_LOT_NOT_FOUND =>
      'That lot does not exist in this warehouse.';

  @override
  String get error_LOTS_REQUIRE_INVENTORY =>
      'To track lots, the product must track inventory.';

  @override
  String get saleStatus_PARTIALLY_REFUNDED => 'Partially refunded';

  @override
  String get saleStatus_REFUNDED => 'Refunded';

  @override
  String get posRefund => 'Refund';

  @override
  String get posRefundTitle => 'Refund';

  @override
  String posRefundSoldRefunded(String sold, String refunded) {
    return 'Sold $sold · already refunded $refunded';
  }

  @override
  String get posRefundQty => 'To refund';

  @override
  String posRefundLess(String product) {
    return 'Refund one less of $product';
  }

  @override
  String posRefundMore(String product) {
    return 'Refund one more of $product';
  }

  @override
  String get posRefundReason => 'Reason';

  @override
  String get posRefundReason_DEFECTIVE => 'Defective';

  @override
  String get posRefundReason_EXCHANGE => 'Exchange';

  @override
  String get posRefundReason_BILLING_ERROR => 'Billing error';

  @override
  String get posRefundReason_WARRANTY => 'Warranty';

  @override
  String get posRefundReason_OTHER => 'Other';

  @override
  String get posRefundRestock => 'Goes back to inventory';

  @override
  String get posRefundRestockHint =>
      'Turn it off if the product cannot be sold again.';

  @override
  String posRefundByRail(String method, String amount) {
    return 'By the same method: $method $amount';
  }

  @override
  String get posRefundTotal => 'Refund';

  @override
  String get posRefundTax => 'ITBMS';

  @override
  String get posRefundCreditNotePending =>
      'The electronic credit note arrives with invoicing from the sale.';

  @override
  String posRefundSubmit(String amount) {
    return 'Refund $amount';
  }

  @override
  String get posRefundPickLines => 'Choose which products are refunded.';

  @override
  String posRefundDone(String amount) {
    return 'Refund recorded: $amount.';
  }

  @override
  String get posRefunded => 'Refunded';

  @override
  String posRefundedLine(String qty, String amount) {
    return 'Refunded $qty: $amount';
  }

  @override
  String get stepUpOpPosRefund => 'Point-of-sale refund';

  @override
  String get error_EXCEEDS_SOLD_QTY => 'You cannot refund more than was sold.';
}
