// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'PT Kharade';

  @override
  String get brandFull => 'PT Kharade Drycleaners';

  @override
  String greeting(String name) {
    return 'Hello, $name!';
  }

  @override
  String get customer => 'Customer';

  @override
  String get chooseService => 'Choose a service';

  @override
  String get serviceDryClean => 'Dry Clean';

  @override
  String get serviceLaundry => 'Laundry';

  @override
  String get servicePressOnly => 'Press Only';

  @override
  String get myOrders => 'My Orders';

  @override
  String get logout => 'Log out';

  @override
  String get settingsTooltip => 'Settings';

  @override
  String get signIn => 'Sign in';

  @override
  String get welcome => 'Welcome to PT Kharade';

  @override
  String get signInSubtitle => 'Sign in to book pickup, track orders & pay.';

  @override
  String get mobileNumber => 'Mobile number';

  @override
  String get sendOtp => 'Send OTP';

  @override
  String get invalidMobile => 'Enter a 10-digit Indian mobile number';

  @override
  String get failedSendOtp => 'Failed to send OTP';

  @override
  String get verifyOtp => 'Verify OTP';

  @override
  String otpSentTo(String phone) {
    return 'Enter the 6-digit OTP sent to $phone';
  }

  @override
  String get otpDevHint =>
      'In development, check the identity-service logs for the OTP value.';

  @override
  String get otpLabel => 'OTP';

  @override
  String get verifyContinue => 'Verify & continue';

  @override
  String get enter6Digit => 'Enter the 6-digit code';

  @override
  String get verificationFailed => 'Verification failed';

  @override
  String bookTitle(String service) {
    return 'Book — $service';
  }

  @override
  String get collection => 'Collection';

  @override
  String get dropAtShop => 'Drop at shop';

  @override
  String get homePickup => 'Home pickup';

  @override
  String get delivery => 'Delivery';

  @override
  String get pickupAtShop => 'Pickup at shop';

  @override
  String get homeDelivery => 'Home delivery';

  @override
  String get express => 'Express / same-day (+25%)';

  @override
  String get pricePreview => 'Price preview';

  @override
  String get subtotal => 'Subtotal';

  @override
  String get expressLine => 'Express';

  @override
  String get gst => 'GST';

  @override
  String get total => 'Total';

  @override
  String get getQuote => 'Get quote';

  @override
  String get placeOrder => 'Place order';

  @override
  String get failedLoadItems => 'Failed to load items';

  @override
  String get quoteFailed => 'Quote failed';

  @override
  String get setupProfileFirst =>
      'Set up your customer profile via the admin portal first.';

  @override
  String get failedPlaceOrder => 'Failed to place order';

  @override
  String get myOrdersTitle => 'My orders';

  @override
  String get noOrders => 'No orders yet — book your first service.';

  @override
  String errorWithMessage(String message) {
    return 'Error: $message';
  }

  @override
  String get orderTitle => 'Order';

  @override
  String get timeline => 'Timeline';

  @override
  String get settings => 'Settings';

  @override
  String get appearance => 'Appearance';

  @override
  String get theme => 'Theme';

  @override
  String get themeSystem => 'System';

  @override
  String get themeLight => 'Light';

  @override
  String get themeDark => 'Dark';

  @override
  String get accentColor => 'Accent color';

  @override
  String get background => 'Background';

  @override
  String get font => 'Font';

  @override
  String get cornerStyle => 'Corner style';

  @override
  String get borderSoft => 'Soft';

  @override
  String get borderSharp => 'Sharp';

  @override
  String get borderPill => 'Pill';

  @override
  String get textSize => 'Text size';

  @override
  String get previewText => 'The quick brown fox jumps over the lazy dog.';

  @override
  String get language => 'Language';

  @override
  String get languageSystem => 'System default';

  @override
  String get resetDefaults => 'Reset to defaults';

  @override
  String get settingsSaved => 'Settings saved';

  @override
  String get accentBlue => 'Blue';

  @override
  String get accentTeal => 'Teal';

  @override
  String get accentGreen => 'Green';

  @override
  String get accentPurple => 'Purple';

  @override
  String get accentOrange => 'Orange';

  @override
  String get accentPink => 'Pink';

  @override
  String get bgDefault => 'Default';

  @override
  String get bgWhite => 'White';

  @override
  String get bgWarm => 'Warm';

  @override
  String get bgMint => 'Mint';

  @override
  String get bgLavender => 'Lavender';

  @override
  String get langEnglish => 'English';

  @override
  String get langMarathi => 'मराठी';

  @override
  String get newOrder => 'New order';

  @override
  String get noOrdersHint => 'Your orders will appear here once you place one.';

  @override
  String get trackOrder => 'Track order';

  @override
  String get trackingTitle => 'Order tracking';

  @override
  String get yourOrder => 'Your order';

  @override
  String moreCount(int count) {
    return '$count more';
  }

  @override
  String get pickup => 'Pickup';

  @override
  String get orderDelivery => 'Delivery';

  @override
  String collectedItems(int count) {
    return '$count item(s) collected';
  }

  @override
  String partnerOnWay(String name) {
    return '$name is on the way';
  }

  @override
  String get callPartner => 'Call';

  @override
  String get viewReceipt => 'View receipt';

  @override
  String get downloadReceipt => 'Download receipt';

  @override
  String get orderCancelled => 'This order was cancelled.';

  @override
  String get somethingWrong => 'Something went wrong';

  @override
  String get tryAgain => 'Try again';

  @override
  String get refresh => 'Refresh';

  @override
  String get chooseItems => 'Choose items';

  @override
  String get howToStart => 'How should we start?';

  @override
  String get howToReturn => 'How should we return it?';

  @override
  String get expressHint => 'Ready faster, +25%';

  @override
  String get whereAndWhen => 'Where & when';

  @override
  String get yourSociety => 'Your society';

  @override
  String get selectSociety => 'Select your society';

  @override
  String get noSocietiesHint =>
      'No delivery areas are set up yet. Choose drop at shop for now.';

  @override
  String get noSlotsThatDay =>
      'No slots available that day — try another date.';

  @override
  String get addItemsFirst => 'Add at least one item.';

  @override
  String get chooseSocietyFirst => 'Choose your society.';

  @override
  String get choosePickupSlot => 'Choose a pickup slot.';

  @override
  String get chooseDeliverySlot => 'Choose a delivery slot.';
}
