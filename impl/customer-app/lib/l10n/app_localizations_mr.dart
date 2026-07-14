// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Marathi (`mr`).
class AppLocalizationsMr extends AppLocalizations {
  AppLocalizationsMr([String locale = 'mr']) : super(locale);

  @override
  String get appTitle => 'पीटी खराडे';

  @override
  String get brandFull => 'पीटी खराडे ड्रायक्लीनर्स';

  @override
  String greeting(String name) {
    return 'नमस्कार, $name!';
  }

  @override
  String get customer => 'ग्राहक';

  @override
  String get chooseService => 'सेवा निवडा';

  @override
  String get serviceDryClean => 'ड्राय क्लीन';

  @override
  String get serviceLaundry => 'लाँड्री';

  @override
  String get servicePressOnly => 'फक्त इस्त्री';

  @override
  String get myOrders => 'माझ्या ऑर्डर्स';

  @override
  String get logout => 'लॉग आउट';

  @override
  String get settingsTooltip => 'सेटिंग्ज';

  @override
  String get signIn => 'साइन इन';

  @override
  String get welcome => 'पीटी खराडेमध्ये आपले स्वागत आहे';

  @override
  String get signInSubtitle =>
      'पिकअप बुक करण्यासाठी, ऑर्डर ट्रॅक करण्यासाठी आणि पैसे भरण्यासाठी साइन इन करा.';

  @override
  String get mobileNumber => 'मोबाइल नंबर';

  @override
  String get sendOtp => 'OTP पाठवा';

  @override
  String get invalidMobile => '10-अंकी भारतीय मोबाइल नंबर टाका';

  @override
  String get failedSendOtp => 'OTP पाठवण्यात अयशस्वी';

  @override
  String get verifyOtp => 'OTP पडताळा';

  @override
  String otpSentTo(String phone) {
    return '$phone वर पाठवलेला 6-अंकी OTP टाका';
  }

  @override
  String get otpDevHint =>
      'डेव्हलपमेंटमध्ये, OTP मूल्यासाठी identity-service लॉग तपासा.';

  @override
  String get otpLabel => 'OTP';

  @override
  String get verifyContinue => 'पडताळा आणि पुढे जा';

  @override
  String get enter6Digit => '6-अंकी कोड टाका';

  @override
  String get verificationFailed => 'पडताळणी अयशस्वी';

  @override
  String bookTitle(String service) {
    return 'बुक करा — $service';
  }

  @override
  String get collection => 'संकलन';

  @override
  String get dropAtShop => 'दुकानात द्या';

  @override
  String get homePickup => 'घरून पिकअप';

  @override
  String get delivery => 'डिलिव्हरी';

  @override
  String get pickupAtShop => 'दुकानातून घ्या';

  @override
  String get homeDelivery => 'घरपोच डिलिव्हरी';

  @override
  String get express => 'एक्सप्रेस / त्याच दिवशी (+25%)';

  @override
  String get pricePreview => 'किंमत पूर्वावलोकन';

  @override
  String get subtotal => 'उपएकूण';

  @override
  String get expressLine => 'एक्सप्रेस';

  @override
  String get gst => 'जीएसटी';

  @override
  String get total => 'एकूण';

  @override
  String get getQuote => 'कोट मिळवा';

  @override
  String get placeOrder => 'ऑर्डर द्या';

  @override
  String get failedLoadItems => 'आयटम लोड करण्यात अयशस्वी';

  @override
  String get quoteFailed => 'कोट अयशस्वी';

  @override
  String get setupProfileFirst =>
      'प्रथम अ‍ॅडमिन पोर्टलद्वारे आपले ग्राहक प्रोफाइल सेट करा.';

  @override
  String get failedPlaceOrder => 'ऑर्डर देण्यात अयशस्वी';

  @override
  String get myOrdersTitle => 'माझ्या ऑर्डर्स';

  @override
  String get noOrders => 'अद्याप ऑर्डर नाही — आपली पहिली सेवा बुक करा.';

  @override
  String errorWithMessage(String message) {
    return 'त्रुटी: $message';
  }

  @override
  String get orderTitle => 'ऑर्डर';

  @override
  String get timeline => 'टाइमलाइन';

  @override
  String get settings => 'सेटिंग्ज';

  @override
  String get appearance => 'स्वरूप';

  @override
  String get theme => 'थीम';

  @override
  String get themeSystem => 'सिस्टम';

  @override
  String get themeLight => 'उजळ';

  @override
  String get themeDark => 'गडद';

  @override
  String get accentColor => 'अ‍ॅक्सेंट रंग';

  @override
  String get background => 'पार्श्वभूमी';

  @override
  String get font => 'फॉन्ट';

  @override
  String get cornerStyle => 'कोपरा शैली';

  @override
  String get borderSoft => 'मऊ';

  @override
  String get borderSharp => 'तीक्ष्ण';

  @override
  String get borderPill => 'पिल';

  @override
  String get textSize => 'मजकूर आकार';

  @override
  String get previewText => 'नमुना मजकूर असा दिसतो.';

  @override
  String get language => 'भाषा';

  @override
  String get languageSystem => 'सिस्टम डीफॉल्ट';

  @override
  String get resetDefaults => 'डीफॉल्टवर रीसेट करा';

  @override
  String get settingsSaved => 'सेटिंग्ज जतन केल्या';

  @override
  String get accentBlue => 'निळा';

  @override
  String get accentTeal => 'टील';

  @override
  String get accentGreen => 'हिरवा';

  @override
  String get accentPurple => 'जांभळा';

  @override
  String get accentOrange => 'केशरी';

  @override
  String get accentPink => 'गुलाबी';

  @override
  String get bgDefault => 'डीफॉल्ट';

  @override
  String get bgWhite => 'पांढरा';

  @override
  String get bgWarm => 'उबदार';

  @override
  String get bgMint => 'मिंट';

  @override
  String get bgLavender => 'लॅव्हेंडर';

  @override
  String get langEnglish => 'English';

  @override
  String get langMarathi => 'मराठी';
}
