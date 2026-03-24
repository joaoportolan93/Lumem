import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter/foundation.dart' show kIsWeb, debugPrint;
import 'dart:io' show Platform;

class ApiClient {
  static final ApiClient _instance = ApiClient._internal();
  factory ApiClient() => _instance;

  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiClient._internal() {
    // Nota: Em dispositivos físicos, use o IP da sua rede (Ex: 192.168.0.12)
    String defaultUrl = 'http://127.0.0.1:8000/api/';
    if (!kIsWeb && Platform.isAndroid) {
      defaultUrl = 'http://10.0.2.2:8000/api/';
    }
    String baseUrl = dotenv.env['API_BASE_URL'] ?? defaultUrl;
    
    debugPrint('DEBUG: ApiClient inicializado com BaseURL: $baseUrl');
    if (baseUrl.contains('127.0.0.1') && !kIsWeb && Platform.isAndroid) {
      debugPrint('WARNING: Você está tentando usar 127.0.0.1 em um Android (Nativo). Isso falhará a menos que use adb reverse!');
    }

    dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Interceptor to add JWT token to requests
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        // If 401, try to refresh the token (only once per request)
        if (error.response?.statusCode == 401 &&
            error.requestOptions.extra['retry'] != true) {
          error.requestOptions.extra['retry'] = true;
          final refreshed = await _tryRefreshToken();
          if (refreshed) {
            // Retry the original request
            final token = await _storage.read(key: 'access_token');
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await dio.fetch(error.requestOptions);
            return handler.resolve(response);
          } else {
            await clearTokens();
          }
        }
        return handler.next(error);
      },
    ));
  }

  Future<bool> _tryRefreshToken() async {
    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) return false;

      final response = await Dio().post(
        '${dio.options.baseUrl}auth/refresh/',
        data: {'refresh': refreshToken},
      );

      if (response.statusCode == 200) {
        await _storage.write(
          key: 'access_token',
          value: response.data['access'],
        );
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<void> setTokens(String access, String refresh) async {
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  Future<bool> hasToken() async {
    final token = await _storage.read(key: 'access_token');
    return token != null;
  }
}
