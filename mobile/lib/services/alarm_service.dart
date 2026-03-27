import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:provider/provider.dart';
import '../models/alarm_model.dart';
import '../providers/alarm_provider.dart';
import '../main.dart';

class AlarmService {
  static const String _prefsKey = 'lumem_alarms';
  static final FlutterLocalNotificationsPlugin _localNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;

    // Configurar Fuso Horário
    tz.initializeTimeZones();
    final timeZoneInfo = await FlutterTimezone.getLocalTimezone();
    tz.setLocalLocation(tz.getLocation(timeZoneInfo.identifier));

    // Pedir permissões no Android 13+
    final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
        _localNotificationsPlugin.resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>();

    if (androidImplementation != null) {
      await androidImplementation.requestNotificationsPermission();
      await androidImplementation.requestExactAlarmsPermission();
      // Em ROMs capadas como Xiaomi, FullScreen Intent requer permissões manuais (pop-up de exibição no background),
      // MAs o setAlarmClock força a criação do alarme direto no sistema mestre.
    }

    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const InitializationSettings initializationSettings =
        InitializationSettings(android: initializationSettingsAndroid);
        
    await _localNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) async {
        // Redireciona para o AlarmRingScreen se tocada a notificação (ou se iniciada via full screen)
        if (response.payload != null && navigatorKey.currentContext != null) {
          int alarmId = int.parse(response.payload!);
          Provider.of<AlarmProvider>(navigatorKey.currentContext!, listen: false).markAsFired(alarmId);
          navigatorKey.currentState?.pushNamed('/alarm_ring', arguments: alarmId);
        }
      },
    );
  }

  // Persistência
  Future<List<AlarmModel>> loadAlarms() async {
    final prefs = await SharedPreferences.getInstance();
    final String? alarmsJson = prefs.getString(_prefsKey);
    if (alarmsJson == null) return [];

    final List<dynamic> decodedList = json.decode(alarmsJson);
    return decodedList.map((json) => AlarmModel.fromJson(json)).toList();
  }

  Future<void> saveAlarms(List<AlarmModel> alarms) async {
    final prefs = await SharedPreferences.getInstance();
    final String encodedList =
        json.encode(alarms.map((a) => a.toJson()).toList());
    await prefs.setString(_prefsKey, encodedList);
  }

  // Agendamento V2 (ziguezagueando em ROMs da Xiaomi nativo)
  Future<void> scheduleAlarm(AlarmModel alarm) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;

    await cancelAlarm(alarm.id);

    DateTime now = DateTime.now();
    bool requiresRepetition = alarm.daysOfWeek.contains(true);

    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'smart_alarm_id',
      'Smart Alarm',
      channelDescription: 'Despertador Inteligente do Dream Share',
      importance: Importance.max,
      priority: Priority.high,
      fullScreenIntent: true,
      playSound: false,
      enableVibration: true,
      category: AndroidNotificationCategory.alarm,
    );
    const NotificationDetails platformDetails = NotificationDetails(android: androidDetails);

    if (requiresRepetition) {
      for (int i = 0; i < 7; i++) {
        if (alarm.daysOfWeek[i]) {
          DateTime target = DateTime(now.year, now.month, now.day, alarm.time.hour, alarm.time.minute);
          while (target.weekday - 1 != i || target.isBefore(now)) {
            target = target.add(const Duration(days: 1));
          }

          int notifId = (alarm.id * 10) + i;
          await _localNotificationsPlugin.zonedSchedule(
            notifId,
            'Despertador',
            alarm.label.isNotEmpty ? alarm.label : 'É hora de acordar e registrar seu sonho!',
            tz.TZDateTime.from(target, tz.local),
            platformDetails,
            androidScheduleMode: AndroidScheduleMode.alarmClock, // Forca API setAlarmClock (bypassa kills de background na MIUI)
            uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
            matchDateTimeComponents: DateTimeComponents.dayOfWeekAndTime,
            payload: alarm.id.toString(),
          );
        }
      }
    } else {
      DateTime scheduledDate = DateTime(
        now.year,
        now.month,
        now.day,
        alarm.time.hour,
        alarm.time.minute,
      );
      if (scheduledDate.isBefore(now)) {
         scheduledDate = scheduledDate.add(const Duration(days: 1));
      }

      await _localNotificationsPlugin.zonedSchedule(
        alarm.id * 10,
        'Despertador',
        alarm.label.isNotEmpty ? alarm.label : 'É hora de acordar e registrar seu sonho!',
        tz.TZDateTime.from(scheduledDate, tz.local),
        platformDetails,
        androidScheduleMode: AndroidScheduleMode.alarmClock,
        uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.absoluteTime,
        payload: alarm.id.toString(),
      );
    }
    
    debugPrint("Alarm ${alarm.id} (Via LocalNotifs) scheduled correctly.");
  }

  Future<void> cancelAlarm(int id) async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    for (int i = 0; i < 7; i++) {
      await _localNotificationsPlugin.cancel((id * 10) + i);
    }
    await _localNotificationsPlugin.cancel(id * 10);
  }
}

