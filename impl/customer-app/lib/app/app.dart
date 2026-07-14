import 'package:flutter/material.dart';
import 'package:pt_kharade_customer/l10n/app_localizations.dart';
import '../core/settings/settings_store.dart';
import 'theme.dart';
import '../features/splash/splash_screen.dart';
import '../features/auth/phone_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/home/home_screen.dart';
import '../features/booking/booking_screen.dart';
import '../features/orders/orders_list_screen.dart';
import '../features/orders/order_detail_screen.dart';
import '../features/settings/settings_screen.dart';

class PtKharadeApp extends StatelessWidget {
  const PtKharadeApp({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = SettingsStore.instance;
    // Rebuild the whole app when any personalization choice changes so theme,
    // locale and text size apply live without a restart.
    return AnimatedBuilder(
      animation: settings,
      builder: (context, _) {
        return MaterialApp(
          title: 'PT Kharade',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(
            seed: settings.accentSeed,
            background: settings.lightBackground,
            fontFamily: settings.effectiveFontFamily,
            radius: settings.borderRadius,
          ),
          darkTheme: AppTheme.dark(
            seed: settings.accentSeed,
            fontFamily: settings.effectiveFontFamily,
            radius: settings.borderRadius,
          ),
          themeMode: settings.themeMode,
          locale: settings.locale,
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) {
            // Apply the user's text-size preference on top of the platform's.
            final media = MediaQuery.of(context);
            return MediaQuery(
              data: media.copyWith(textScaler: settings.textScaler),
              child: child!,
            );
          },
          initialRoute: '/',
          routes: {
            '/': (_) => const SplashScreen(),
            '/login': (_) => const PhoneScreen(),
            '/otp': (_) => const OtpScreen(),
            '/home': (_) => const HomeScreen(),
            '/booking': (_) => const BookingScreen(),
            '/orders': (_) => const OrdersListScreen(),
            '/settings': (_) => const SettingsScreen(),
          },
          onGenerateRoute: (settings) {
            if (settings.name?.startsWith('/orders/') ?? false) {
              final id = settings.name!.substring('/orders/'.length);
              return MaterialPageRoute(
                builder: (_) => OrderDetailScreen(orderId: id),
                settings: settings,
              );
            }
            return null;
          },
        );
      },
    );
  }
}
