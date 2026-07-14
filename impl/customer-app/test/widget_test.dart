// Smoke tests for the customer app's personalization plumbing.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:pt_kharade_customer/core/settings/settings_store.dart';

void main() {
  setUp(() {
    // SettingsStore persists via shared_preferences; use an in-memory backing.
    SharedPreferences.setMockInitialValues({});
  });

  test('SettingsStore round-trips theme, accent, background, scale, language',
      () async {
    final s = SettingsStore.instance;
    await s.loadFromDisk();

    await s.setThemeMode(ThemeMode.dark);
    await s.setAccent('teal');
    await s.setBackground('warm');
    await s.setTextScale(1.25);
    await s.setLanguage('mr');

    expect(s.themeMode, ThemeMode.dark);
    expect(s.accentSeed, SettingsStore.accents['teal']);
    expect(s.lightBackground, SettingsStore.backgrounds['warm']);
    expect(s.textScale, 1.25);
    expect(s.locale, const Locale('mr'));
  });

  test('SettingsStore clamps text scale and ignores unknown ids', () async {
    final s = SettingsStore.instance;
    await s.loadFromDisk();

    await s.setTextScale(99);
    expect(s.textScale, SettingsStore.maxTextScale);

    await s.setAccent('not-a-colour');
    expect(SettingsStore.accents.containsKey(s.accentId), isTrue);

    await s.setLanguage('zz'); // unsupported → falls back to system (null)
    expect(s.languageCode, isNull);
  });

  test('hydrateFromServer applies account-level ThemePrefs', () async {
    final s = SettingsStore.instance;
    await s.loadFromDisk();

    await s.hydrateFromServer({
      'PreferredLanguage': 'mr',
      'ThemePrefs': {'mode': 'dark', 'accent': 'green', 'textScale': 1.1},
    });

    expect(s.languageCode, 'mr');
    expect(s.themeMode, ThemeMode.dark);
    expect(s.accentId, 'green');
    expect(s.textScale, 1.1);
  });
}
