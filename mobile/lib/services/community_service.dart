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
        'tab': 'community',
        'community_id': communityId,
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
      final response = await _api.dio.post('communities/$communityId/upload-icon/', data: data);
      return response.data['imagem'];
    } on DioException catch (e) {
      print('Erro ao fazer upload do ícone: ${e.response?.data}');
      return null;
    }
  }

  Future<String?> uploadCommunityBannerImage(String communityId, FormData data) async {
    try {
      final response = await _api.dio.post('communities/$communityId/upload-banner/', data: data);
      return response.data['banner'];
    } on DioException catch (e) {
      print('Erro ao fazer upload do banner: ${e.response?.data}');
      return null;
    }
  }

  Future<List<Map<String, dynamic>>> getCommunityMembers(String communityId) async {
    try {
      final response = await _api.dio.get('communities/$communityId/members/');
      final results = response.data is List ? response.data as List : [];
      return results.cast<Map<String, dynamic>>();
    } on DioException {
      return [];
    }
  }

  Future<Map<String, dynamic>?> getCommunityStats(String communityId) async {
    try {
      final response = await _api.dio.get('communities/$communityId/moderator_stats/');
      return response.data as Map<String, dynamic>;
    } on DioException {
      return null;
    }
  }

  Future<bool> manageCommunityRole(String communityId, String userId, String role) async {
    try {
      await _api.dio.post('communities/$communityId/manage-role/', data: {
        'user_id': userId,
        'role': role,
      });
      return true;
    } on DioException {
      return false;
    }
  }

  Future<bool> banCommunityMember(String communityId, String userId, {String motivo = ''}) async {
    try {
      await _api.dio.post('communities/$communityId/ban-member/', data: {
        'user_id': userId,
        'motivo': motivo,
      });
      return true;
    } on DioException {
      return false;
    }
  }

  Future<bool> unbanCommunityMember(String communityId, String userId) async {
    try {
      await _api.dio.post('communities/$communityId/unban-member/', data: {
        'user_id': userId,
      });
      return true;
    } on DioException {
      return false;
    }
  }

  Future<List<Map<String, dynamic>>> getBannedMembers(String communityId) async {
    try {
      final response = await _api.dio.get('communities/$communityId/banned-members/');
      final results = response.data is List ? response.data as List : [];
      return results.cast<Map<String, dynamic>>();
    } on DioException {
      return [];
    }
  }
}
