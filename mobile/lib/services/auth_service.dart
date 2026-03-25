import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:dreamshare/models/user.dart';
import 'api_client.dart';

class AuthService {
  final ApiClient _api = ApiClient();

  Future<User> login(String email, String password) async {
    try {
      final response = await _api.dio.post('auth/login/', data: {
        'email': email,
        'password': password,
      });

      await _api.setTokens(
        response.data['access'],
        response.data['refresh'],
      );

      // Get user profile after login
      return await getProfile();
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<User> register({
    required String email,
    required String nomeUsuario,
    required String nomeCompleto,
    required String password,
  }) async {
    try {
      await _api.dio.post('auth/register/', data: {
        'email': email,
        'nome_usuario': nomeUsuario,
        'nome_completo': nomeCompleto,
        'password': password,
      });

      // After registration, login automatically
      return await login(email, password);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<User> getProfile() async {
    try {
      final response = await _api.dio.get('profile/');
      return User.fromJson(response.data);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<void> logout() async {
    try {
      final refreshToken =
          await const FlutterSecureStorageHelper().readRefresh();
      await _api.dio.post('auth/logout/', data: {
        'refresh': refreshToken,
      });
    } catch (_) {
      // Even if logout fails on server, clear local tokens
    } finally {
      await _api.clearTokens();
    }
  }

  Future<bool> isLoggedIn() async {
    return await _api.hasToken();
  }

  String _handleError(DioException e) {
    if (e.response?.data is Map) {
      final data = e.response!.data as Map;
      // Try to extract first error message
      for (var value in data.values) {
        if (value is List && value.isNotEmpty) {
          return value.first.toString();
        }
        if (value is String) {
          return value;
        }
      }
    }
    if (e.response?.statusCode == 401) {
      return 'Email ou senha incorretos';
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'Sem conexão com o servidor';
    }
    return 'Erro Rede: ${e.message}\nURL: ${e.requestOptions.baseUrl}';
  }
}

// Helper to read refresh token outside of ApiClient
class FlutterSecureStorageHelper {
  const FlutterSecureStorageHelper();
  Future<String?> readRefresh() async {
    const storage = FlutterSecureStorage();
    return await storage.read(key: 'refresh_token');
  }
}
