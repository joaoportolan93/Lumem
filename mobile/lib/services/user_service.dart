import 'package:dio/dio.dart';
import 'package:dreamshare/models/user.dart';
import 'api_client.dart';

class UserService {
  final ApiClient _api = ApiClient();

  Future<User?> getUserDetail(String userId) async {
    try {
      final response = await _api.dio.get('users/$userId/');
      return User.fromJson(response.data);
    } on DioException {
      return null;
    }
  }

  Future<String?> followUser(String userId) async {
    try {
      final response = await _api.dio.post('users/$userId/follow/');
      if (response.data is Map && response.data.containsKey('follow_status')) {
        return response.data['follow_status'] as String;
      }
      return 'following';
    } on DioException {
      return null;
    }
  }

  Future<bool> unfollowUser(String userId) async {
    try {
      await _api.dio.delete('users/$userId/follow/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<List<User>> getFollowers(String userId) async {
    try {
      final response = await _api.dio.get('users/$userId/followers/');
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => User.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<User>> getFollowing(String userId) async {
    try {
      final response = await _api.dio.get('users/$userId/following/');
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => User.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<User>> search(String query) async {
    try {
      final response = await _api.dio.get('search/', queryParameters: {
        'q': query,
      });
      final users = response.data['users'] as List? ?? [];
      return users.map((json) => User.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<User>> getSuggestedUsers() async {
    try {
      final response = await _api.dio.get('users/suggested/');
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => User.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<User?> updateUser(String userId, Map<String, dynamic> data) async {
    try {
      final response = await _api.dio.patch('users/$userId/', data: data);
      return User.fromJson(response.data);
    } on DioException catch (e) {
      print('Update user error: ${e.response?.data}');
      return null;
    }
  }

  Future<String?> uploadAvatar(dynamic imageFile) async {
    try {
      final formData = FormData.fromMap({
        'avatar': await MultipartFile.fromFile(
          imageFile.path,
          filename: imageFile.path.split('/').last,
        ),
      });
      final response = await _api.dio.post('profile/avatar/', data: formData); // Adjust URL if different, usually avatar/upload/ or profile/avatar
      return response.data['avatar_url'];
    } on DioException catch (e) {
      print('Upload avatar error: ${e.response?.data}');
      return null;
    }
  }
}
