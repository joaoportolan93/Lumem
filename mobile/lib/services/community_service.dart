import 'package:dio/dio.dart';
import 'package:dreamshare/models/community.dart';
import 'package:dreamshare/models/dream.dart';
import 'api_client.dart';

class CommunityService {
  final ApiClient _api = ApiClient();

  Future<List<Community>> getCommunities() async {
    try {
      final response = await _api.dio.get('communities/');
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Community.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<Community?> getCommunityDetail(String communityId) async {
    try {
      final response = await _api.dio.get('communities/$communityId/');
      return Community.fromJson(response.data);
    } on DioException {
      return null;
    }
  }

  Future<List<Dream>> getCommunityPosts(String communityId) async {
    try {
      final response = await _api.dio.get('dreams/', queryParameters: {
        'comunidade': communityId,
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Dream.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<bool> joinCommunity(String communityId) async {
    try {
      await _api.dio.post('communities/$communityId/join/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<List<Community>> getUserMemberCommunities(String userId) async {
    try {
      final response = await _api.dio.get('communities/', queryParameters: {
        'user_id': userId,
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Community.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<Community>> getUserAdminCommunities(String userId) async {
    try {
      final response = await _api.dio.get('communities/', queryParameters: {
        'user_id': userId,
        'role': 'admin,moderator',
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Community.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<Community?> createCommunity(FormData data) async {
    try {
      final response = await _api.dio.post('communities/', data: data);
      return Community.fromJson(response.data);
    } on DioException catch (e) {
      print('Erro ao criar comunidade: ${e.response?.data}');
      return null;
    }
  }

  Future<bool> leaveCommunity(String communityId) async {
    try {
      await _api.dio.post('communities/$communityId/leave/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<bool> deleteCommunity(String communityId) async {
    try {
      await _api.dio.delete('communities/$communityId/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<Community?> updateCommunity(String communityId, Map<String, dynamic> data) async {
    try {
      final response = await _api.dio.patch('communities/$communityId/', data: data);
      return Community.fromJson(response.data);
    } on DioException catch (e) {
      print('Erro ao atualizar comunidade: ${e.response?.data}');
      return null;
    }
  }

  Future<String?> uploadCommunityBanner(String communityId, FormData data) async {
    try {
      final response = await _api.dio.post('communities/$communityId/banner/', data: data);
      return response.data['banner'];
    } on DioException catch (e) {
      print('Erro ao fazer upload do banner: ${e.response?.data}');
      return null;
    }
  }

  Future<String?> uploadCommunityIcon(String communityId, FormData data) async {
    try {
      final response = await _api.dio.post('communities/$communityId/icon/', data: data);
      return response.data['imagem'];
    } on DioException catch (e) {
      print('Erro ao fazer upload do ícone: ${e.response?.data}');
      return null;
    }
  }
}
