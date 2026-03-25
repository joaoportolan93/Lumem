import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:dreamshare/models/alarm_model.dart';
import 'package:dreamshare/providers/alarm_provider.dart';
import 'package:provider/provider.dart';

class AlarmRingScreen extends StatefulWidget {
  const AlarmRingScreen({super.key});

  @override
  _AlarmRingScreenState createState() => _AlarmRingScreenState();
}

class _AlarmRingScreenState extends State<AlarmRingScreen> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  AlarmModel? _currentAlarm;
  bool _isPlaying = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_currentAlarm == null) {
      final alarmId = ModalRoute.of(context)?.settings.arguments as int?;
      if (alarmId != null) {
        final provider = Provider.of<AlarmProvider>(context, listen: false);
        _currentAlarm = provider.alarms.cast<AlarmModel?>().firstWhere(
              (a) => a?.id == alarmId,
              orElse: () => null,
            );
        if (_currentAlarm != null) {
          _startAlarmSound();
        }
      }
    }
  }

  Future<void> _startAlarmSound() async {
    if (_isPlaying) return;
    _isPlaying = true;

    try {
      // Começa com volume zerado
      await _audioPlayer.setVolume(0.0);
      await _audioPlayer.setReleaseMode(ReleaseMode.loop);

      if (_currentAlarm!.selectedSound.startsWith('assets/')) {
        await _audioPlayer.play(AssetSource(_currentAlarm!.selectedSound.replaceFirst('assets/', '')));
      } else {
        await _audioPlayer.play(DeviceFileSource(_currentAlarm!.selectedSound));
      }

      // Inicia o fade-in progrssivo
      int steps = _currentAlarm!.fadeInDurationSeconds;
      double increment = 1.0 / steps;
      
      for (int i = 1; i <= steps; i++) {
        if (!mounted || !_isPlaying) break;
        await Future.delayed(const Duration(seconds: 1));
        await _audioPlayer.setVolume(i * increment);
      }
    } catch (e) {
      debugPrint("Erro ao tocar alarme: $e");
    }
  }

  Future<void> _stopAlarm() async {
    _isPlaying = false;
    await _audioPlayer.stop();
  }

  void _dismissAlarm() {
    _stopAlarm();
    Navigator.of(context).pop();
  }

  void _recordDream() {
    _stopAlarm();
    // Substitui a rota atual pela de criar sonho
    Navigator.of(context).pushReplacementNamed('/create_dream');
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_currentAlarm == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final timeString = "${_currentAlarm!.time.hour.toString().padLeft(2, '0')}:${_currentAlarm!.time.minute.toString().padLeft(2, '0')}";

    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF0F172A), Color(0xFF1E1B4B)], // Cores noturnas/espaciais
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              const Icon(Icons.nights_stay, size: 64, color: Colors.amber),
              const SizedBox(height: 24),
              Text(
                timeString,
                style: const TextStyle(
                  fontSize: 72,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: 2.0,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _currentAlarm!.label,
                style: const TextStyle(
                  fontSize: 24,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 48),
              const Spacer(),
              
              if (_currentAlarm!.showRecordDreamShortcut)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 8.0),
                  child: ElevatedButton(
                    onPressed: _recordDream,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 64),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(32),
                      ),
                      elevation: 8,
                    ),
                    child: const Text(
                      'Registrar Sonho Agora',
                      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0, vertical: 16.0),
                child: OutlinedButton(
                  onPressed: _dismissAlarm,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white70,
                    side: const BorderSide(color: Colors.white30, width: 2),
                    minimumSize: const Size(double.infinity, 56),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(32),
                    ),
                  ),
                  child: const Text(
                    'Dispensar',
                    style: TextStyle(fontSize: 18),
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
