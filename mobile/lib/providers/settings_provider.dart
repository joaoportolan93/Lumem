import 'package:flutter/material.dart';
import 'package:dreamshare/services/settings_service.dart';

class SettingsProvider extends ChangeNotifier {
  final SettingsService _settingsService = SettingsService();

  ThemeMode _themeMode = ThemeMode.system;
  Locale _locale = const Locale('pt', 'BR');
  bool _showAlgorithmicFeed = true;

  ThemeMode get themeMode => _themeMode;
  Locale get locale => _locale;
  bool get showAlgorithmicFeed => _showAlgorithmicFeed;

  SettingsProvider() {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final settings = await _settingsService.getUserSettings();
      if (settings != null) {
        final temaId = settings['tema_interface'] ?? 2;
        if (temaId == 1) {
          _themeMode = ThemeMode.light;
        } else if (temaId == 2) {
          _themeMode = ThemeMode.dark;
        } else {
          _themeMode = ThemeMode.system;
        }

        final idiomaStr = settings['idioma'] ?? 'pt-BR';
        if (idiomaStr == 'en') {
          _locale = const Locale('en', 'US');
        } else {
          _locale = const Locale('pt', 'BR');
        }
        
        _showAlgorithmicFeed = settings['mostrar_feed_algoritmico'] ?? true;
        
        notifyListeners();
      }
    } catch (e) {
      // Ignora erro e mantem padrao
    }
  }

  void setTheme(int temaId) {
    if (temaId == 1) {
      _themeMode = ThemeMode.light;
    } else if (temaId == 2) {
      _themeMode = ThemeMode.dark;
    } else {
      _themeMode = ThemeMode.system;
    }
    notifyListeners();
  }

  void setLocale(String idiomaStr) {
    if (idiomaStr == 'en') {
      _locale = const Locale('en', 'US');
    } else {
      _locale = const Locale('pt', 'BR');
    }
    notifyListeners();
  }

  void setShowAlgorithmicFeed(bool value) {
    _showAlgorithmicFeed = value;
    notifyListeners();
  }
}
