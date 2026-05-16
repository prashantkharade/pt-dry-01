import 'package:flutter/material.dart';
import '../features/splash/splash_screen.dart';
import '../features/auth/phone_screen.dart';
import '../features/auth/otp_screen.dart';
import '../features/home/home_screen.dart';
import '../features/booking/booking_screen.dart';
import '../features/orders/orders_list_screen.dart';
import '../features/orders/order_detail_screen.dart';

class PtKharadeApp extends StatelessWidget {
  const PtKharadeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PT Kharade',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          surface: const Color(0xFFFFFFFF),
        ),
        scaffoldBackgroundColor: const Color(0xFFF5F7FB),
        fontFamily: 'Roboto',
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFFFFFFFF),
          foregroundColor: Color(0xFF1A2230),
          elevation: 0,
          centerTitle: false,
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: Color(0xFFDDE3EC)),
          ),
        ),
      ),
      initialRoute: '/',
      routes: {
        '/': (_) => const SplashScreen(),
        '/login': (_) => const PhoneScreen(),
        '/otp': (_) => const OtpScreen(),
        '/home': (_) => const HomeScreen(),
        '/booking': (_) => const BookingScreen(),
        '/orders': (_) => const OrdersListScreen(),
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
  }
}
