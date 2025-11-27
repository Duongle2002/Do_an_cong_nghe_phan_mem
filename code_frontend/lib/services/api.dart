import 'dart:convert';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;

class Api {
  // Base URL selection rules:
  // - If built/run with `--dart-define=API_BASE=...` that value is used.
  // - Otherwise on Android emulator use 10.0.2.2 to reach host machine.
  // - On other platforms default to localhost:4000.
  static String baseUrl = (() {
    final fromEnv = const String.fromEnvironment('API_BASE', defaultValue: '');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (Platform.isAndroid) return 'http://10.0.2.2:4000';
    return 'http://localhost:4000';
  })();

  /// Change the base URL at runtime (useful for in-app settings)
  static void setBaseUrl(String url) => baseUrl = url;

  static Map<String, String> _authHeaders(String? token) {
    final headers = {'Content-Type': 'application/json'};
    if (token != null && token.isNotEmpty)
      headers['Authorization'] = 'Bearer $token';
    return headers;
  }

  static Future<http.Response> post(String path, Map body, {String? token}) {
    final url = Uri.parse('$baseUrl$path');
    return http.post(url, headers: _authHeaders(token), body: jsonEncode(body));
  }

  static Future<http.Response> get(
    String path, {
    String? token,
    Map<String, String>? query,
  }) {
    var uri = Uri.parse('$baseUrl$path');
    if (query != null) uri = uri.replace(queryParameters: query);
    return http.get(uri, headers: _authHeaders(token));
  }

  static dynamic _decodeBody(http.Response resp) {
    try {
      return jsonDecode(resp.body);
    } catch (_) {
      return resp.body;
    }
  }

  static Future<Map<String, dynamic>> login(
    String email,
    String password,
  ) async {
    final resp = await post('/api/auth/login', {'email': email, 'password': password});
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null ? body['message'] : resp.reasonPhrase;
      throw Exception('Login failed: $msg');
    }
    if (body is Map<String, dynamic>) return body;
    throw Exception('Unexpected login response');
  }

  static Future<Map<String, dynamic>> register(
    String name,
    String email,
    String password,
  ) async {
    final resp = await post('/api/auth/register', {'name': name, 'email': email, 'password': password});
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null ? body['message'] : resp.reasonPhrase;
      throw Exception('Register failed: $msg');
    }
    if (body is Map<String, dynamic>) return body;
    throw Exception('Unexpected register response');
  }

  static Future<List<dynamic>> getDevices(String token) async {
    final resp = await get('/api/devices', token: token);
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null ? body['message'] : resp.reasonPhrase;
      throw Exception('Error fetching devices: $msg');
    }
    // some endpoints might wrap the list in an object: { devices: [...] }
    if (body is List) return body as List<dynamic>;
    if (body is Map && body['devices'] is List) return body['devices'] as List<dynamic>;
    throw Exception('Unexpected devices response: ${body.runtimeType}');
  }

  static Future<Map<String, dynamic>> getDevice(String token, String id) async {
    final resp = await get('/api/devices/$id', token: token);
    return jsonDecode(resp.body) as Map<String, dynamic>;
  }

  static Future<List<dynamic>> getSensorData(
    String token,
    String deviceId, {
    String? from,
    String? to,
    int limit = 100,
  }) async {
    final q = {'deviceId': deviceId, 'limit': limit.toString()};
    if (from != null) q['from'] = from;
    if (to != null) q['to'] = to;
    final resp = await get('/api/sensors', token: token, query: q);
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null ? body['message'] : resp.reasonPhrase;
      throw Exception('Error fetching sensor data: $msg');
    }
    if (body is List) return body as List<dynamic>;
    if (body is Map && body['items'] is List) return body['items'] as List<dynamic>;
    throw Exception('Unexpected sensors response: ${body.runtimeType}');
  }

  // Commands
  static Future<Map<String, dynamic>> createCommand(String token, Map<String, dynamic> body) async {
    final resp = await post('/api/commands', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null ? b['message'] : resp.reasonPhrase;
      throw Exception('Error creating command: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected command response');
  }

  static Future<List<dynamic>> listCommands(String token, {required String deviceId, String? status}) async {
    final q = {'deviceId': deviceId};
    if (status != null) q['status'] = status;
    final resp = await get('/api/commands', token: token, query: q);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null ? b['message'] : resp.reasonPhrase;
      throw Exception('Error listing commands: $msg');
    }
    if (b is List) return b;
    return [];
  }

  // Alerts
  static Future<List<dynamic>> getAlerts(String token, {String? deviceId, bool? read}) async {
    final q = <String, String>{};
    if (deviceId != null) q['deviceId'] = deviceId;
    if (read != null) q['read'] = read.toString();
    final resp = await get('/api/alerts', token: token, query: q.isEmpty ? null : q);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null ? b['message'] : resp.reasonPhrase;
      throw Exception('Error fetching alerts: $msg');
    }
    if (b is List) return b;
    return [];
  }

  // Sensor ingest (for devices or manual testing)
  static Future<Map<String, dynamic>> ingestSensor(String token, Map<String, dynamic> body) async {
    final resp = await post('/api/sensors/ingest', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null ? b['message'] : resp.reasonPhrase;
      throw Exception('Error ingesting sensor data: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected ingest response');
  }
}
