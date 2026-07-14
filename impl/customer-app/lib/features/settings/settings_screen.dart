import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../../core/settings/settings_store.dart';

/// Lets the user personalize the app: theme mode, accent colour, background,
/// text size and language. All controls write to [SettingsStore], which
/// applies changes live and syncs them to the account when signed in.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = AppLocalizations.of(context);
    final settings = SettingsStore.instance;

    return Scaffold(
      appBar: AppBar(title: Text(t.settings)),
      body: AnimatedBuilder(
        animation: settings,
        builder: (context, _) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _sectionTitle(context, t.appearance),

              // ---- Theme mode ----
              _card(
                context,
                title: t.theme,
                child: SegmentedButton<ThemeMode>(
                  segments: [
                    ButtonSegment(value: ThemeMode.system, label: Text(t.themeSystem), icon: const Icon(Icons.brightness_auto)),
                    ButtonSegment(value: ThemeMode.light, label: Text(t.themeLight), icon: const Icon(Icons.light_mode)),
                    ButtonSegment(value: ThemeMode.dark, label: Text(t.themeDark), icon: const Icon(Icons.dark_mode)),
                  ],
                  selected: {settings.themeMode},
                  onSelectionChanged: (s) => settings.setThemeMode(s.first),
                ),
              ),

              // ---- Accent colour ----
              _card(
                context,
                title: t.accentColor,
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: SettingsStore.accents.entries.map((e) {
                    final selected = settings.accentId == e.key;
                    return _swatch(
                      color: e.value,
                      selected: selected,
                      label: _accentLabel(t, e.key),
                      onTap: () => settings.setAccent(e.key),
                    );
                  }).toList(),
                ),
              ),

              // ---- Font family ----
              _card(
                context,
                title: t.font,
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: SettingsStore.fontFamilies.map((f) {
                    final selected = settings.fontFamily == f;
                    return ChoiceChip(
                      selected: selected,
                      onSelected: (_) => settings.setFontFamily(f),
                      label: Text(f),
                    );
                  }).toList(),
                ),
              ),

              // ---- Corner (border) style ----
              _card(
                context,
                title: t.cornerStyle,
                child: SegmentedButton<String>(
                  segments: [
                    ButtonSegment(value: 'soft', label: Text(t.borderSoft)),
                    ButtonSegment(value: 'sharp', label: Text(t.borderSharp)),
                    ButtonSegment(value: 'pill', label: Text(t.borderPill)),
                  ],
                  selected: {settings.borderStyle},
                  onSelectionChanged: (s) => settings.setBorderStyle(s.first),
                ),
              ),

              // ---- Background ----
              _card(
                context,
                title: t.background,
                child: Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: SettingsStore.backgrounds.entries.map((e) {
                    final selected = settings.backgroundId == e.key;
                    return _swatch(
                      color: e.value,
                      selected: selected,
                      label: _backgroundLabel(t, e.key),
                      onTap: () => settings.setBackground(e.key),
                      bordered: true,
                    );
                  }).toList(),
                ),
              ),

              // ---- Text size ----
              _card(
                context,
                title: t.textSize,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Text('A', style: TextStyle(fontSize: 14)),
                        Expanded(
                          child: Slider(
                            value: settings.textScale,
                            min: SettingsStore.minTextScale,
                            max: SettingsStore.maxTextScale,
                            divisions: 11,
                            label: '${(settings.textScale * 100).round()}%',
                            onChanged: (v) => settings.setTextScale(v),
                          ),
                        ),
                        const Text('A', style: TextStyle(fontSize: 24)),
                      ],
                    ),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(t.previewText),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 8),
              _sectionTitle(context, t.language),

              // ---- Language ----
              _card(
                context,
                title: t.language,
                child: RadioGroup<String?>(
                  groupValue: settings.languageCode,
                  onChanged: (v) => settings.setLanguage(v),
                  child: Column(
                    children: [
                      RadioListTile<String?>(
                        value: null,
                        title: Text(t.languageSystem),
                        contentPadding: EdgeInsets.zero,
                      ),
                      RadioListTile<String?>(
                        value: 'en',
                        title: Text(t.langEnglish),
                        contentPadding: EdgeInsets.zero,
                      ),
                      RadioListTile<String?>(
                        value: 'mr',
                        title: Text(t.langMarathi),
                        contentPadding: EdgeInsets.zero,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: () async {
                  await settings.setThemeMode(ThemeMode.system);
                  await settings.setAccent('blue');
                  await settings.setBackground('default');
                  await settings.setFontFamily('Roboto');
                  await settings.setBorderStyle('soft');
                  await settings.setTextScale(1.0);
                  await settings.setLanguage(null);
                },
                icon: const Icon(Icons.restart_alt),
                label: Text(t.resetDefaults),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _sectionTitle(BuildContext context, String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8, top: 4),
        child: Text(
          text,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: Theme.of(context).colorScheme.primary,
              ),
        ),
      );

  Widget _card(BuildContext context, {required String title, required Widget child}) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 12),
              child,
            ],
          ),
        ),
      );

  Widget _swatch({
    required Color color,
    required bool selected,
    required String label,
    required VoidCallback onTap,
    bool bordered = false,
  }) {
    return Tooltip(
      message: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            border: Border.all(
              color: selected
                  ? Colors.black87
                  : (bordered ? const Color(0xFFDDE3EC) : Colors.transparent),
              width: selected ? 3 : 1,
            ),
          ),
          child: selected
              ? Icon(Icons.check,
                  size: 20,
                  color: ThemeData.estimateBrightnessForColor(color) == Brightness.dark
                      ? Colors.white
                      : Colors.black87)
              : null,
        ),
      ),
    );
  }

  String _accentLabel(AppLocalizations t, String id) {
    switch (id) {
      case 'teal':   return t.accentTeal;
      case 'green':  return t.accentGreen;
      case 'purple': return t.accentPurple;
      case 'orange': return t.accentOrange;
      case 'pink':   return t.accentPink;
      default:       return t.accentBlue;
    }
  }

  String _backgroundLabel(AppLocalizations t, String id) {
    switch (id) {
      case 'white':    return t.bgWhite;
      case 'warm':     return t.bgWarm;
      case 'mint':     return t.bgMint;
      case 'lavender': return t.bgLavender;
      default:         return t.bgDefault;
    }
  }
}
