import 'package:flutter/material.dart';

class AlarmModel {
  final int id;
  final TimeOfDay time;
  final String label;
  final bool isActive;
  final List<bool> daysOfWeek; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  final String selectedSound; // path local ou asset
  final int fadeInDurationSeconds;
  final bool showRecordDreamShortcut;

  AlarmModel({
    required this.id,
    required this.time,
    this.label = 'Despertador',
    this.isActive = true,
    List<bool>? daysOfWeek,
    this.selectedSound = 'assets/sounds/natureza.mp3',
    this.fadeInDurationSeconds = 30,
    this.showRecordDreamShortcut = true,
  }) : daysOfWeek = daysOfWeek ?? List.filled(7, false);

  AlarmModel copyWith({
    int? id,
    TimeOfDay? time,
    String? label,
    bool? isActive,
    List<bool>? daysOfWeek,
    String? selectedSound,
    int? fadeInDurationSeconds,
    bool? showRecordDreamShortcut,
  }) {
    return AlarmModel(
      id: id ?? this.id,
      time: time ?? this.time,
      label: label ?? this.label,
      isActive: isActive ?? this.isActive,
      daysOfWeek: daysOfWeek ?? List.from(this.daysOfWeek),
      selectedSound: selectedSound ?? this.selectedSound,
      fadeInDurationSeconds: fadeInDurationSeconds ?? this.fadeInDurationSeconds,
      showRecordDreamShortcut: showRecordDreamShortcut ?? this.showRecordDreamShortcut,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'hour': time.hour,
      'minute': time.minute,
      'label': label,
      'isActive': isActive,
      'daysOfWeek': daysOfWeek,
      'selectedSound': selectedSound,
      'fadeInDurationSeconds': fadeInDurationSeconds,
      'showRecordDreamShortcut': showRecordDreamShortcut,
    };
  }

  factory AlarmModel.fromJson(Map<String, dynamic> json) {
    return AlarmModel(
      id: json['id'],
      time: TimeOfDay(hour: json['hour'], minute: json['minute']),
      label: json['label'] ?? 'Despertador',
      isActive: json['isActive'] ?? true,
      daysOfWeek: List<bool>.from(json['daysOfWeek'] ?? List.filled(7, false)),
      selectedSound: json['selectedSound'] ?? 'assets/sounds/natureza.mp3',
      fadeInDurationSeconds: json['fadeInDurationSeconds'] ?? 30,
      showRecordDreamShortcut: json['showRecordDreamShortcut'] ?? true,
    );
  }
}
