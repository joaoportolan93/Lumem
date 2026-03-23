import 'package:dio/dio.dart';
import 'package:dreamshare/models/user.dart';
import 'api_client.dart';

class SettingsService {
  final ApiClient _api = ApiClient();

  Future<Map<String, dynamic>?> getUserSettings() async {
    try {
      final response = await _api.dio.get('settings/');
      return response.data as Map<String, dynamic>;
    } on DioException {
      return null;
    }
  }

  Future<bool> updateUserSettings(Map<String, dynamic> data) async {
    try {
      await _api.dio.patch('settings/', data: data);
      return true;
    } on DioException {
      return false;
    }
  }

  Future<List<User>> getCloseFriendsManage() async {
    try {
      final response = await _api.dio.get('friends/manage/');
      final results = response.data is List ? response.data as List : [];
      return results.map((json) => User.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<bool> toggleCloseFriend(String userId) async {
    try {
      await _api.dio.post('friends/toggle/$userId/');
      return true;
    } on DioException {
      return false;
    }
  }
}
