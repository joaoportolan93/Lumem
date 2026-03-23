import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dreamshare/models/dream.dart';
import 'package:dreamshare/models/comment.dart';
import 'api_client.dart';

class DreamService {
  final ApiClient _api = ApiClient();

  Future<List<Dream>> getFeed({int page = 1, bool? following}) async {
    try {
      final params = <String, dynamic>{'page': page};
      if (following == true) params['following'] = 'true';
      final response = await _api.dio.get('dreams/', queryParameters: params);

      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);

      return results.map((json) => Dream.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<Dream?> getDreamDetail(String dreamId) async {
    try {
      final response = await _api.dio.get('dreams/$dreamId/');
      return Dream.fromJson(response.data);
    } on DioException {
      return null;
    }
  }

  Future<Dream?> createDream({
    required String conteudoTexto,
    List<String>? hashtags,
    File? imagem,
  }) async {
    try {
      final formData = FormData.fromMap({
        'conteudo_texto': conteudoTexto,
        if (hashtags != null && hashtags.isNotEmpty)
          'hashtags': hashtags.join(','),
        if (imagem != null)
          'imagem': await MultipartFile.fromFile(
            imagem.path,
            filename: imagem.path.split(Platform.pathSeparator).last,
          ),
      });

      final response = await _api.dio.post('dreams/', data: formData);
      return Dream.fromJson(response.data);
    } on DioException catch (e) {
      // Log the error for debugging
      print(
          'CreateDream error: ${e.response?.statusCode} - ${e.response?.data}');
      return null;
    }
  }

  Future<bool> likeDream(String dreamId) async {
    try {
      await _api.dio.post('dreams/$dreamId/like/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<bool> saveDream(String dreamId) async {
    try {
      await _api.dio.post('dreams/$dreamId/save/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<List<Comment>> getComments(String dreamId) async {
    try {
      final response = await _api.dio.get('dreams/$dreamId/comments/');
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Comment.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<Comment?> createComment(String dreamId, String texto,
      {String? parentId}) async {
    try {
      final formData = FormData.fromMap({
        'conteudo_texto': texto,
        if (parentId != null) 'comentario_pai': parentId,
      });

      final response = await _api.dio.post(
        'dreams/$dreamId/comments/',
        data: formData,
      );
      return Comment.fromJson(response.data);
    } on DioException {
      return null;
    }
  }

  Future<bool> deleteComment(String dreamId, String commentId) async {
    try {
      await _api.dio.delete('dreams/$dreamId/comments/$commentId/');
      return true;
    } on DioException {
      return false;
    }
  }

  Future<List<Dream>> getUserDreams(String userId) async {
    try {
      final response = await _api.dio.get('dreams/', queryParameters: {
        'tab': 'user_posts',
        'user_id': userId,
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Dream.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<Dream>> getUserCommunityPosts(String userId) async {
    try {
      final response = await _api.dio.get('dreams/', queryParameters: {
        'tab': 'user_community_posts',
        'user_id': userId,
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Dream.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<Dream>> getUserMediaPosts(String userId) async {
    try {
      final response = await _api.dio.get('dreams/', queryParameters: {
        'tab': 'user_media',
        'user_id': userId,
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Dream.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }

  Future<List<Dream>> getSavedDreams() async {
    try {
      final response = await _api.dio.get('dreams/', queryParameters: {
        'tab': 'saved',
      });
      final results = response.data is Map
          ? (response.data['results'] as List? ?? [])
          : (response.data as List? ?? []);
      return results.map((json) => Dream.fromJson(json)).toList();
    } on DioException {
      return [];
    }
  }
}
