import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'package:lumem/providers/settings_provider.dart';
import 'package:lumem/providers/alarm_provider.dart';
import 'package:lumem/services/alarm_service.dart';
import 'app.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await dotenv.load(fileName: '.env');
    debugPrint('DEBUG: Arquivo .env carregado com sucesso.');
  } catch (e) {
    debugPrint('DEBUG: Arquivo .env não encontrado ou erro ao carregar. Usando defaults.');
  }
  timeago.setLocaleMessages('pt_BR', timeago.PtBrMessages());
  
  // Inicialização do Alarm Manager e Local Notifications
  await AlarmService.initialize();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
        ChangeNotifierProvider(create: (_) => AlarmProvider()),
      ],
      child: const MyApp(),
    ),
  );
}
