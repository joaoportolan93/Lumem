import 'package:dio/dio.dart';
import 'package:dreamshare/models/notification_model.dart';
import 'api_client.dart';

class NotificationService {
  final ApiClient _api = ApiClient();

  Future<List<AppNotification>> getNotifications() async {
    try {
      final response = await _api.dio.get('notifications/');
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => AppNotification.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<bool> markAsRead(String notificationId) async {
    try {
      await _api.dio.patch('notifications/$notificationId/', data: {
        'lida': true,
      });
      return true;
    } on DioException {
      return false;
    }
  }

  Future<bool> markAllAsRead() async {
    try {
      await _api.dio.patch('notifications/read_all/');
      return true;
    } on DioException {
      return false;
    }
  }
}
