import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_mr.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
      : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
    delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
  ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('mr')
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'PT Kharade'**
  String get appTitle;

  /// No description provided for @brandFull.
  ///
  /// In en, this message translates to:
  /// **'PT Kharade Drycleaners'**
  String get brandFull;

  /// No description provided for @greeting.
  ///
  /// In en, this message translates to:
  /// **'Hello, {name}!'**
  String greeting(String name);

  /// No description provided for @customer.
  ///
  /// In en, this message translates to:
  /// **'Customer'**
  String get customer;

  /// No description provided for @chooseService.
  ///
  /// In en, this message translates to:
  /// **'Choose a service'**
  String get chooseService;

  /// No description provided for @serviceDryClean.
  ///
  /// In en, this message translates to:
  /// **'Dry Clean'**
  String get serviceDryClean;

  /// No description provided for @serviceLaundry.
  ///
  /// In en, this message translates to:
  /// **'Laundry'**
  String get serviceLaundry;

  /// No description provided for @servicePressOnly.
  ///
  /// In en, this message translates to:
  /// **'Press Only'**
  String get servicePressOnly;

  /// No description provided for @myOrders.
  ///
  /// In en, this message translates to:
  /// **'My Orders'**
  String get myOrders;

  /// No description provided for @logout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get logout;

  /// No description provided for @settingsTooltip.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTooltip;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome to PT Kharade'**
  String get welcome;

  /// No description provided for @signInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to book pickup, track orders & pay.'**
  String get signInSubtitle;

  /// No description provided for @mobileNumber.
  ///
  /// In en, this message translates to:
  /// **'Mobile number'**
  String get mobileNumber;

  /// No description provided for @sendOtp.
  ///
  /// In en, this message translates to:
  /// **'Send OTP'**
  String get sendOtp;

  /// No description provided for @invalidMobile.
  ///
  /// In en, this message translates to:
  /// **'Enter a 10-digit Indian mobile number'**
  String get invalidMobile;

  /// No description provided for @failedSendOtp.
  ///
  /// In en, this message translates to:
  /// **'Failed to send OTP'**
  String get failedSendOtp;

  /// No description provided for @verifyOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify OTP'**
  String get verifyOtp;

  /// No description provided for @otpSentTo.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit OTP sent to {phone}'**
  String otpSentTo(String phone);

  /// No description provided for @otpDevHint.
  ///
  /// In en, this message translates to:
  /// **'In development, check the identity-service logs for the OTP value.'**
  String get otpDevHint;

  /// No description provided for @otpLabel.
  ///
  /// In en, this message translates to:
  /// **'OTP'**
  String get otpLabel;

  /// No description provided for @verifyContinue.
  ///
  /// In en, this message translates to:
  /// **'Verify & continue'**
  String get verifyContinue;

  /// No description provided for @enter6Digit.
  ///
  /// In en, this message translates to:
  /// **'Enter the 6-digit code'**
  String get enter6Digit;

  /// No description provided for @verificationFailed.
  ///
  /// In en, this message translates to:
  /// **'Verification failed'**
  String get verificationFailed;

  /// No description provided for @bookTitle.
  ///
  /// In en, this message translates to:
  /// **'Book — {service}'**
  String bookTitle(String service);

  /// No description provided for @collection.
  ///
  /// In en, this message translates to:
  /// **'Collection'**
  String get collection;

  /// No description provided for @dropAtShop.
  ///
  /// In en, this message translates to:
  /// **'Drop at shop'**
  String get dropAtShop;

  /// No description provided for @homePickup.
  ///
  /// In en, this message translates to:
  /// **'Home pickup'**
  String get homePickup;

  /// No description provided for @delivery.
  ///
  /// In en, this message translates to:
  /// **'Delivery'**
  String get delivery;

  /// No description provided for @pickupAtShop.
  ///
  /// In en, this message translates to:
  /// **'Pickup at shop'**
  String get pickupAtShop;

  /// No description provided for @homeDelivery.
  ///
  /// In en, this message translates to:
  /// **'Home delivery'**
  String get homeDelivery;

  /// No description provided for @express.
  ///
  /// In en, this message translates to:
  /// **'Express / same-day (+25%)'**
  String get express;

  /// No description provided for @pricePreview.
  ///
  /// In en, this message translates to:
  /// **'Price preview'**
  String get pricePreview;

  /// No description provided for @subtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get subtotal;

  /// No description provided for @expressLine.
  ///
  /// In en, this message translates to:
  /// **'Express'**
  String get expressLine;

  /// No description provided for @gst.
  ///
  /// In en, this message translates to:
  /// **'GST'**
  String get gst;

  /// No description provided for @total.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get total;

  /// No description provided for @getQuote.
  ///
  /// In en, this message translates to:
  /// **'Get quote'**
  String get getQuote;

  /// No description provided for @placeOrder.
  ///
  /// In en, this message translates to:
  /// **'Place order'**
  String get placeOrder;

  /// No description provided for @failedLoadItems.
  ///
  /// In en, this message translates to:
  /// **'Failed to load items'**
  String get failedLoadItems;

  /// No description provided for @quoteFailed.
  ///
  /// In en, this message translates to:
  /// **'Quote failed'**
  String get quoteFailed;

  /// No description provided for @setupProfileFirst.
  ///
  /// In en, this message translates to:
  /// **'Set up your customer profile via the admin portal first.'**
  String get setupProfileFirst;

  /// No description provided for @failedPlaceOrder.
  ///
  /// In en, this message translates to:
  /// **'Failed to place order'**
  String get failedPlaceOrder;

  /// No description provided for @myOrdersTitle.
  ///
  /// In en, this message translates to:
  /// **'My orders'**
  String get myOrdersTitle;

  /// No description provided for @noOrders.
  ///
  /// In en, this message translates to:
  /// **'No orders yet — book your first service.'**
  String get noOrders;

  /// No description provided for @errorWithMessage.
  ///
  /// In en, this message translates to:
  /// **'Error: {message}'**
  String errorWithMessage(String message);

  /// No description provided for @orderTitle.
  ///
  /// In en, this message translates to:
  /// **'Order'**
  String get orderTitle;

  /// No description provided for @timeline.
  ///
  /// In en, this message translates to:
  /// **'Timeline'**
  String get timeline;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @appearance.
  ///
  /// In en, this message translates to:
  /// **'Appearance'**
  String get appearance;

  /// No description provided for @theme.
  ///
  /// In en, this message translates to:
  /// **'Theme'**
  String get theme;

  /// No description provided for @themeSystem.
  ///
  /// In en, this message translates to:
  /// **'System'**
  String get themeSystem;

  /// No description provided for @themeLight.
  ///
  /// In en, this message translates to:
  /// **'Light'**
  String get themeLight;

  /// No description provided for @themeDark.
  ///
  /// In en, this message translates to:
  /// **'Dark'**
  String get themeDark;

  /// No description provided for @accentColor.
  ///
  /// In en, this message translates to:
  /// **'Accent color'**
  String get accentColor;

  /// No description provided for @background.
  ///
  /// In en, this message translates to:
  /// **'Background'**
  String get background;

  /// No description provided for @font.
  ///
  /// In en, this message translates to:
  /// **'Font'**
  String get font;

  /// No description provided for @cornerStyle.
  ///
  /// In en, this message translates to:
  /// **'Corner style'**
  String get cornerStyle;

  /// No description provided for @borderSoft.
  ///
  /// In en, this message translates to:
  /// **'Soft'**
  String get borderSoft;

  /// No description provided for @borderSharp.
  ///
  /// In en, this message translates to:
  /// **'Sharp'**
  String get borderSharp;

  /// No description provided for @borderPill.
  ///
  /// In en, this message translates to:
  /// **'Pill'**
  String get borderPill;

  /// No description provided for @textSize.
  ///
  /// In en, this message translates to:
  /// **'Text size'**
  String get textSize;

  /// No description provided for @previewText.
  ///
  /// In en, this message translates to:
  /// **'The quick brown fox jumps over the lazy dog.'**
  String get previewText;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @languageSystem.
  ///
  /// In en, this message translates to:
  /// **'System default'**
  String get languageSystem;

  /// No description provided for @resetDefaults.
  ///
  /// In en, this message translates to:
  /// **'Reset to defaults'**
  String get resetDefaults;

  /// No description provided for @settingsSaved.
  ///
  /// In en, this message translates to:
  /// **'Settings saved'**
  String get settingsSaved;

  /// No description provided for @accentBlue.
  ///
  /// In en, this message translates to:
  /// **'Blue'**
  String get accentBlue;

  /// No description provided for @accentTeal.
  ///
  /// In en, this message translates to:
  /// **'Teal'**
  String get accentTeal;

  /// No description provided for @accentGreen.
  ///
  /// In en, this message translates to:
  /// **'Green'**
  String get accentGreen;

  /// No description provided for @accentPurple.
  ///
  /// In en, this message translates to:
  /// **'Purple'**
  String get accentPurple;

  /// No description provided for @accentOrange.
  ///
  /// In en, this message translates to:
  /// **'Orange'**
  String get accentOrange;

  /// No description provided for @accentPink.
  ///
  /// In en, this message translates to:
  /// **'Pink'**
  String get accentPink;

  /// No description provided for @bgDefault.
  ///
  /// In en, this message translates to:
  /// **'Default'**
  String get bgDefault;

  /// No description provided for @bgWhite.
  ///
  /// In en, this message translates to:
  /// **'White'**
  String get bgWhite;

  /// No description provided for @bgWarm.
  ///
  /// In en, this message translates to:
  /// **'Warm'**
  String get bgWarm;

  /// No description provided for @bgMint.
  ///
  /// In en, this message translates to:
  /// **'Mint'**
  String get bgMint;

  /// No description provided for @bgLavender.
  ///
  /// In en, this message translates to:
  /// **'Lavender'**
  String get bgLavender;

  /// No description provided for @langEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get langEnglish;

  /// No description provided for @langMarathi.
  ///
  /// In en, this message translates to:
  /// **'मराठी'**
  String get langMarathi;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'mr'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'mr':
      return AppLocalizationsMr();
  }

  throw FlutterError(
      'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
      'an issue with the localizations generation tool. Please file an issue '
      'on GitHub with a reproducible sample app and the gen-l10n configuration '
      'that was used.');
}
