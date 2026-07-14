import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/api_client.dart';
import '../auth/auth_store.dart';

/// Holds the user's personalization choices — theme mode, accent colour,
/// background, text size and language — and makes them reactive.
///
/// Mirrors [AuthStore]: a private-constructor singleton [ChangeNotifier].
/// Choices persist locally via `shared_preferences` and, when the user is
/// signed in, sync to identity-service (`PATCH /users/me`) so they follow the
/// account across devices. The `ThemePrefs` blob keeps the documented
/// `{ "mode": "dark" }` shape and extends it with accent/background/textScale.
class SettingsStore extends ChangeNotifier {
  SettingsStore._();
  static final SettingsStore instance = SettingsStore._();

  static const _kThemeMode  = 'settings.themeMode';
  static const _kAccent     = 'settings.accent';
  static const _kBackground = 'settings.background';
  static const _kTextScale  = 'settings.textScale';
  static const _kLanguage   = 'settings.language';
  static const _kFontFamily  = 'settings.fontFamily';
  static const _kBorderStyle = 'settings.borderStyle';

  // ---- Selectable catalogs (id → value). Labels are localized in the UI. ----

  /// Accent (seed) colours for the Material [ColorScheme].
  static const Map<String, Color> accents = {
    'blue'  : Color(0xFF2563EB),
    'teal'  : Color(0xFF0D9488),
    'green' : Color(0xFF059669),
    'purple': Color(0xFF7C3AED),
    'orange': Color(0xFFEA580C),
    'pink'  : Color(0xFFDB2777),
  };

  /// Scaffold background tints used in light mode. Dark mode uses its own
  /// dark surface regardless of this choice.
  static const Map<String, Color> backgrounds = {
    'default' : Color(0xFFF5F7FB),
    'white'   : Color(0xFFFFFFFF),
    'warm'    : Color(0xFFFDF6EC),
    'mint'    : Color(0xFFEFF7F1),
    'lavender': Color(0xFFF3F0FA),
  };

  /// Languages the app is translated into (2-letter ISO codes to match the
  /// identity-service `PreferredLanguage` column).
  static const List<String> supportedLanguages = ['en', 'mr'];

  /// Font-family allow-list (BRIEF §2.5 / guide 04-cross-cutting §4.1).
  static const List<String> fontFamilies = [
    'Roboto',
    'Inter',
    'Noto Sans',
    'Noto Sans Devanagari',
  ];

  /// Border style → corner radius (guide 04-cross-cutting §4.1: soft|sharp|pill).
  static const Map<String, double> borderStyles = {
    'soft' : 12,
    'sharp': 4,
    'pill' : 999,
  };

  /// Font that renders Devanagari cleanly — forced when the UI is in Marathi
  /// so glyphs never fall back to tofu (guide 03-customer-app-flutter §10).
  static const String devanagariFont = 'Noto Sans Devanagari';

  static const double minTextScale = 0.85;
  static const double maxTextScale = 1.40;

  ThemeMode _themeMode   = ThemeMode.system;
  String    _accentId    = 'blue';
  String    _backgroundId = 'default';
  double    _textScale   = 1.0;
  String?   _languageCode; // null = follow system locale
  String    _fontFamily  = 'Roboto';
  String    _borderStyle = 'soft';

  ThemeMode get themeMode    => _themeMode;
  String    get accentId     => _accentId;
  String    get backgroundId => _backgroundId;
  double    get textScale    => _textScale;
  String?   get languageCode => _languageCode;
  String    get fontFamily   => _fontFamily;
  String    get borderStyle  => _borderStyle;

  Color get accentSeed     => accents[_accentId] ?? accents['blue']!;
  Color get lightBackground => backgrounds[_backgroundId] ?? backgrounds['default']!;
  Locale? get locale       => _languageCode == null ? null : Locale(_languageCode!);
  TextScaler get textScaler => TextScaler.linear(_textScale);
  double get borderRadius  => borderStyles[_borderStyle] ?? 12;

  /// The font actually applied. Marathi forces a Devanagari-capable face
  /// regardless of the chosen family so text renders correctly.
  String get effectiveFontFamily =>
      _languageCode == 'mr' ? devanagariFont : _fontFamily;

  // ---- Load / hydrate -------------------------------------------------------

  Future<void> loadFromDisk() async {
    final p = await SharedPreferences.getInstance();
    _themeMode    = _parseMode(p.getString(_kThemeMode));
    _accentId     = accents.containsKey(p.getString(_kAccent))
        ? p.getString(_kAccent)! : 'blue';
    _backgroundId = backgrounds.containsKey(p.getString(_kBackground))
        ? p.getString(_kBackground)! : 'default';
    _textScale    = (p.getDouble(_kTextScale) ?? 1.0).clamp(minTextScale, maxTextScale);
    final lang = p.getString(_kLanguage);
    _languageCode = supportedLanguages.contains(lang) ? lang : null;
    _fontFamily   = fontFamilies.contains(p.getString(_kFontFamily))
        ? p.getString(_kFontFamily)! : 'Roboto';
    _borderStyle  = borderStyles.containsKey(p.getString(_kBorderStyle))
        ? p.getString(_kBorderStyle)! : 'soft';
    notifyListeners();
  }

  /// Applies personalization returned by `GET /users/me` (called after login /
  /// on splash) so account-level preferences win over a fresh install. Writes
  /// through to local storage but does NOT push back to the server.
  Future<void> hydrateFromServer(Map<String, dynamic> user) async {
    var changed = false;
    final lang = user['PreferredLanguage'] as String?;
    if (lang != null && supportedLanguages.contains(lang) && lang != _languageCode) {
      _languageCode = lang;
      changed = true;
    }
    final prefs = (user['ThemePrefs'] as Map?)?.cast<String, dynamic>();
    if (prefs != null) {
      final mode = _parseMode(prefs['mode'] as String?);
      if (mode != _themeMode) { _themeMode = mode; changed = true; }
      final accent = prefs['accent'] as String?;
      if (accent != null && accents.containsKey(accent) && accent != _accentId) {
        _accentId = accent; changed = true;
      }
      final bg = prefs['background'] as String?;
      if (bg != null && backgrounds.containsKey(bg) && bg != _backgroundId) {
        _backgroundId = bg; changed = true;
      }
      final ts = (prefs['textScale'] as num?)?.toDouble();
      if (ts != null) {
        final clamped = ts.clamp(minTextScale, maxTextScale);
        if (clamped != _textScale) { _textScale = clamped; changed = true; }
      }
      final font = prefs['fontFamily'] as String?;
      if (font != null && fontFamilies.contains(font) && font != _fontFamily) {
        _fontFamily = font; changed = true;
      }
      final border = prefs['borderStyle'] as String?;
      if (border != null && borderStyles.containsKey(border) && border != _borderStyle) {
        _borderStyle = border; changed = true;
      }
    }
    if (changed) {
      await _persist();
      notifyListeners();
    }
  }

  // ---- Mutators (persist locally + sync to backend) -------------------------

  Future<void> setThemeMode(ThemeMode mode) async {
    if (mode == _themeMode) return;
    _themeMode = mode;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  Future<void> setAccent(String id) async {
    if (!accents.containsKey(id) || id == _accentId) return;
    _accentId = id;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  Future<void> setBackground(String id) async {
    if (!backgrounds.containsKey(id) || id == _backgroundId) return;
    _backgroundId = id;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  Future<void> setTextScale(double scale) async {
    final clamped = scale.clamp(minTextScale, maxTextScale);
    if (clamped == _textScale) return;
    _textScale = clamped;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  /// [code] must be a supported 2-letter code, or null to follow the system.
  Future<void> setLanguage(String? code) async {
    final next = (code != null && supportedLanguages.contains(code)) ? code : null;
    if (next == _languageCode) return;
    _languageCode = next;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  Future<void> setFontFamily(String family) async {
    if (!fontFamilies.contains(family) || family == _fontFamily) return;
    _fontFamily = family;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  Future<void> setBorderStyle(String style) async {
    if (!borderStyles.containsKey(style) || style == _borderStyle) return;
    _borderStyle = style;
    await _persist();
    notifyListeners();
    _syncToServer();
  }

  // ---- Internals ------------------------------------------------------------

  Future<void> _persist() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kThemeMode, _themeMode.name);
    await p.setString(_kAccent, _accentId);
    await p.setString(_kBackground, _backgroundId);
    await p.setDouble(_kTextScale, _textScale);
    await p.setString(_kFontFamily, _fontFamily);
    await p.setString(_kBorderStyle, _borderStyle);
    if (_languageCode == null) {
      await p.remove(_kLanguage);
    } else {
      await p.setString(_kLanguage, _languageCode!);
    }
  }

  /// Fire-and-forget push to identity-service. No-op when signed out; failures
  /// are swallowed so personalization never blocks the UI.
  void _syncToServer() {
    if (!AuthStore.instance.isAuthenticated) return;
    ApiClient.updateMe(
      // `mode` keeps back-compat with the documented ThemePrefs example.
      themePrefs: {
        'mode'       : _themeMode.name,
        'accent'     : _accentId,
        'background' : _backgroundId,
        'textScale'  : _textScale,
        'fontFamily' : _fontFamily,
        'borderStyle': _borderStyle,
      },
      preferredLanguage: _languageCode, // omitted when null (follow system)
    ).catchError((_) {});
  }

  ThemeMode _parseMode(String? raw) {
    switch (raw) {
      case 'light': return ThemeMode.light;
      case 'dark':  return ThemeMode.dark;
      default:      return ThemeMode.system;
    }
  }
}
