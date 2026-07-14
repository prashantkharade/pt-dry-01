import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Builds the app's [ThemeData] from the user's personalization choices.
///
/// Extracted from the old inline theme in `app.dart` and parameterized per the
/// BRIEF §2.5 theming token set — accent (seed) colour, background tint,
/// brightness, **font family** and **border style** all change at runtime.
class AppTheme {
  const AppTheme._();

  static ThemeData light({
    required Color seed,
    required Color background,
    required String fontFamily,
    required double radius,
  }) {
    return _base(
      brightness: Brightness.light,
      seed: seed,
      scaffoldBackground: background,
      surface: const Color(0xFFFFFFFF),
      appBarBackground: const Color(0xFFFFFFFF),
      appBarForeground: const Color(0xFF1A2230),
      inputFill: Colors.white,
      inputBorder: const Color(0xFFDDE3EC),
      fontFamily: fontFamily,
      radius: radius,
    );
  }

  static ThemeData dark({
    required Color seed,
    required String fontFamily,
    required double radius,
  }) {
    return _base(
      brightness: Brightness.dark,
      seed: seed,
      scaffoldBackground: const Color(0xFF0F141C),
      surface: const Color(0xFF1A2230),
      appBarBackground: const Color(0xFF1A2230),
      appBarForeground: const Color(0xFFE7ECF3),
      inputFill: const Color(0xFF1A2230),
      inputBorder: const Color(0xFF35415A),
      fontFamily: fontFamily,
      radius: radius,
    );
  }

  static ThemeData _base({
    required Brightness brightness,
    required Color seed,
    required Color scaffoldBackground,
    required Color surface,
    required Color appBarBackground,
    required Color appBarForeground,
    required Color inputFill,
    required Color inputBorder,
    required String fontFamily,
    required double radius,
  }) {
    // Corner radius: inputs/buttons use the full value; cards are capped so a
    // "pill" (999) choice doesn't clip card content into a lozenge.
    final cardRadius = radius > 16 ? 16.0 : radius;

    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: ColorScheme.fromSeed(
        seedColor: seed,
        brightness: brightness,
        surface: surface,
      ),
      scaffoldBackgroundColor: scaffoldBackground,
      appBarTheme: AppBarTheme(
        backgroundColor: appBarBackground,
        foregroundColor: appBarForeground,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(cardRadius),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: inputFill,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radius),
          borderSide: BorderSide(color: inputBorder),
        ),
      ),
    );

    // Apply the chosen Google font across the text theme (also covers AppBar
    // and buttons via primaryTextTheme).
    return base.copyWith(
      textTheme: _fontTextTheme(fontFamily, base.textTheme),
      primaryTextTheme: _fontTextTheme(fontFamily, base.primaryTextTheme),
    );
  }

  static TextTheme _fontTextTheme(String family, TextTheme base) {
    switch (family) {
      case 'Inter':
        return GoogleFonts.interTextTheme(base);
      case 'Noto Sans':
        return GoogleFonts.notoSansTextTheme(base);
      case 'Noto Sans Devanagari':
        return GoogleFonts.notoSansDevanagariTextTheme(base);
      case 'Roboto':
      default:
        return GoogleFonts.robotoTextTheme(base);
    }
  }
}
