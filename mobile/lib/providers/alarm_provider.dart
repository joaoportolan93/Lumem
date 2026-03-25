import 'package:flutter/material.dart';
import 'dart:async';
import '../models/alarm_model.dart';
import '../services/alarm_service.dart';
import '../main.dart'; // import para navigatorKey

class AlarmProvider with ChangeNotifier {
  List<AlarmModel> _alarms = [];
  final AlarmService _alarmService = AlarmService();
  Timer? _alarmCheckTimer;
  final Map<int, DateTime> _lastFiredTime = {}; // Previnir duplo disparo no msm minuto

  List<AlarmModel> get alarms => _alarms;

  AlarmProvider() {
    loadAlarms();
    _startForegroundCheck();
  }

  void _startForegroundCheck() {
    // Quando o FullScreenIntent acordar e jogar a tela pro Foreground, este Timer será retomado
    _alarmCheckTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
      _checkAlarmsToBeFired();
    });
  }

  void _checkAlarmsToBeFired() {
    if (_alarms.isEmpty || navigatorKey.currentState == null) return;
    
    final now = DateTime.now();
    for (var alarm in _alarms) {
      if (alarm.isActive) {
         if (now.hour == alarm.time.hour && now.minute == alarm.time.minute) {
            bool correctDay = true;
            if (alarm.daysOfWeek.contains(true)) {
               correctDay = alarm.daysOfWeek[now.weekday - 1]; // 0=Mon, ... 6=Sun
            }
            if (correctDay) {
               // Verifica debounce (se já tocou nos ultimos 1 min para esse id)
               if (!_lastFiredTime.containsKey(alarm.id) || now.difference(_lastFiredTime[alarm.id]!).inMinutes >= 1) {
                  _lastFiredTime[alarm.id] = now;
                  debugPrint("Auto-Launch AlarmRingScreen pelo Provider! ID: \${alarm.id}");
                  navigatorKey.currentState?.pushNamed('/alarm_ring', arguments: alarm.id);
               }
            }
         }
      }
    }
  }

  void markAsFired(int id) {
    _lastFiredTime[id] = DateTime.now();
  }

  @override
  void dispose() {
    _alarmCheckTimer?.cancel();
    super.dispose();
  }

  Future<void> loadAlarms() async {
    _alarms = await _alarmService.loadAlarms();
    notifyListeners();
  }

  Future<void> addAlarm(AlarmModel alarm) async {
    // Definimos o ID como o timestamp atual para ser unico
    final newAlarm = alarm.copyWith(id: DateTime.now().millisecondsSinceEpoch % 100000);
    _alarms.add(newAlarm);
    
    // Agenda se estiver ativo
    if (newAlarm.isActive) {
      await _alarmService.scheduleAlarm(newAlarm);
    }
    
    await _alarmService.saveAlarms(_alarms);
    notifyListeners();
  }

  Future<void> updateAlarm(AlarmModel updatedAlarm) async {
    final index = _alarms.indexWhere((a) => a.id == updatedAlarm.id);
    if (index != -1) {
      _alarms[index] = updatedAlarm;
      
      if (updatedAlarm.isActive) {
        await _alarmService.scheduleAlarm(updatedAlarm);
      } else {
        await _alarmService.cancelAlarm(updatedAlarm.id);
      }
      
      await _alarmService.saveAlarms(_alarms);
      notifyListeners();
    }
  }

  Future<void> toggleAlarm(int id) async {
    final index = _alarms.indexWhere((a) => a.id == id);
    if (index != -1) {
      final alarm = _alarms[index];
      final newStatus = !alarm.isActive;
      _alarms[index] = alarm.copyWith(isActive: newStatus);

      if (newStatus) {
        await _alarmService.scheduleAlarm(_alarms[index]);
      } else {
        await _alarmService.cancelAlarm(id);
      }

      await _alarmService.saveAlarms(_alarms);
      notifyListeners();
    }
  }

  Future<void> deleteAlarm(int id) async {
    _alarms.removeWhere((a) => a.id == id);
    await _alarmService.cancelAlarm(id);
    await _alarmService.saveAlarms(_alarms);
    notifyListeners();
  }
}
