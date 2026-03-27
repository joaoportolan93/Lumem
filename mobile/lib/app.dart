import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lumem/util/const.dart';
import 'package:lumem/util/theme_config.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'package:lumem/providers/settings_provider.dart';
import 'package:lumem/views/screens/splash_screen.dart';
import 'package:lumem/main.dart';
import 'package:lumem/views/screens/alarm_ring_screen.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<SettingsProvider>(
      builder: (context, settingsProvider, child) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: Constants.appName,
          theme: themeData(ThemeConfig.lightTheme),
          darkTheme: themeData(ThemeConfig.darkTheme),
          themeMode: settingsProvider.themeMode,
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [
            Locale('pt', 'BR'),
            Locale('en', 'US'),
          ],
          locale: settingsProvider.locale,
          navigatorKey: navigatorKey,
          home: const SplashScreen(),
          routes: {
            '/alarm_ring': (context) => const AlarmRingScreen(),
          },
        );
      },
    );
  }

  ThemeData themeData(ThemeData theme) {
    return theme.copyWith(
      textTheme: GoogleFonts.interTextTheme(
        theme.textTheme,
      ),
    );
  }
}
