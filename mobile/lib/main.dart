import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:dreamshare/providers/settings_provider.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await dotenv.load(fileName: '.env');
    debugPrint('DEBUG: Arquivo .env carregado com sucesso.');
  } catch (e) {
    debugPrint('DEBUG: Arquivo .env não encontrado ou erro ao carregar. Usando defaults.');
  }
  timeago.setLocaleMessages('pt_BR', timeago.PtBrMessages());
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ],
      child: const MyApp(),
    ),
  );
}
