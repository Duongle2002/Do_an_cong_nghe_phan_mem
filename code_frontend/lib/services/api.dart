import 'dart:convert';
import 'dart:io' show Platform;
import 'package:http/http.dart' as http;
import 'dart:async';

class Api {
  // Base URL selection rules:
  // - If built/run with `--dart-define=API_BASE=...` that value is used.
  // - Otherwise on Android emulator use 10.0.2.2 to reach host machine.
  // - On other platforms default to localhost:4000.
  static String baseUrl = (() {
    final fromEnv = const String.fromEnvironment('API_BASE', defaultValue: '');
    if (fromEnv.isNotEmpty) return fromEnv;
    if (Platform.isAndroid) return 'http://10.0.2.2:4000';

    return 'http://192.168.2.142:4000';
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
    final resp = await post('/api/auth/login', {
      'email': email,
      'password': password,
    });
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null
          ? body['message']
          : resp.reasonPhrase;
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
    final resp = await post('/api/auth/register', {
      'name': name,
      'email': email,
      'password': password,
    });
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null
          ? body['message']
          : resp.reasonPhrase;
      throw Exception('Register failed: $msg');
    }
    if (body is Map<String, dynamic>) return body;
    throw Exception('Unexpected register response');
  }

  static Future<List<dynamic>> getDevices(String token) async {
    final resp = await get('/api/devices', token: token);
    final body = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = body is Map && body['message'] != null
          ? body['message']
          : resp.reasonPhrase;
      throw Exception('Error fetching devices: $msg');
    }
    // some endpoints might wrap the list in an object: { devices: [...] }
    if (body is List) return body as List<dynamic>;
    if (body is Map && body['devices'] is List)
      return body['devices'] as List<dynamic>;
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
      final msg = body is Map && body['message'] != null
          ? body['message']
          : resp.reasonPhrase;
      throw Exception('Error fetching sensor data: $msg');
    }
    if (body is List) return body as List<dynamic>;
    if (body is Map && body['items'] is List)
      return body['items'] as List<dynamic>;
    throw Exception('Unexpected sensors response: ${body.runtimeType}');
  }

  // Commands
  static Future<Map<String, dynamic>> createCommand(
    String token,
    Map<String, dynamic> body,
  ) async {
    final resp = await post('/api/commands', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error creating command: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected command response');
  }

  static Future<List<dynamic>> listCommands(
    String token, {
    required String deviceId,
    String? status,
  }) async {
    final q = {'deviceId': deviceId};
    if (status != null) q['status'] = status;
    final resp = await get('/api/commands', token: token, query: q);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error listing commands: $msg');
    }
    if (b is List) return b;
    return [];
  }

  // Alerts
  static Future<List<dynamic>> getAlerts(
    String token, {
    String? deviceId,
    bool? read,
  }) async {
    final q = <String, String>{};
    if (deviceId != null) q['deviceId'] = deviceId;
    if (read != null) q['read'] = read.toString();
    final resp = await get(
      '/api/alerts',
      token: token,
      query: q.isEmpty ? null : q,
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error fetching alerts: $msg');
    }
    if (b is List) return b;
    return [];
  }

  static Future<Map<String, dynamic>> markAlertAsRead(
    String token,
    String alertId,
  ) async {
    final resp = await http.put(
      Uri.parse('$baseUrl/api/alerts/$alertId/read'),
      headers: _authHeaders(token),
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error marking alert as read: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected mark alert response');
  }

  // Sensor ingest (for devices or manual testing)
  static Future<Map<String, dynamic>> ingestSensor(
    String token,
    Map<String, dynamic> body,
  ) async {
    final resp = await post('/api/sensors/ingest', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error ingesting sensor data: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected ingest response');
  }

  // Schedules CRUD
  static Future<List<dynamic>> getSchedules(
    String token, {
    String? deviceId,
  }) async {
    final q = <String, String>{};
    if (deviceId != null) q['deviceId'] = deviceId;
    final resp = await get(
      '/api/schedules',
      token: token,
      query: q.isEmpty ? null : q,
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error fetching schedules: $msg');
    }
    if (b is List) return b;
    return [];
  }

  static Future<Map<String, dynamic>> createSchedule(
    String token,
    Map<String, dynamic> body,
  ) async {
    final resp = await post('/api/schedules', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error creating schedule: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected create schedule response');
  }

  static Future<Map<String, dynamic>> createDevice(
    String token,
    Map<String, dynamic> body,
  ) async {
    final resp = await post('/api/devices', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error creating device: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected create device response');
  }

  /// Update device thresholds for automation (backend endpoint expected).
  static Future<Map<String, dynamic>> updateThresholds(
    String token,
    String deviceId,
    Map<String, dynamic> body,
  ) async {
    final resp = await http.put(
      Uri.parse('$baseUrl/api/devices/$deviceId/thresholds'),
      headers: _authHeaders(token),
      body: jsonEncode(body),
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error updating thresholds: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected update thresholds response');
  }

  static Future<Map<String, dynamic>> updateSchedule(
    String token,
    String id,
    Map<String, dynamic> body,
  ) async {
    final resp = await http.put(
      Uri.parse('$baseUrl/api/schedules/$id'),
      headers: _authHeaders(token),
      body: jsonEncode(body),
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error updating schedule: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected update schedule response');
  }

  // Update device settings (automation thresholds, etc.)
  static Future<Map<String, dynamic>> updateDevice(
    String token,
    String id,
    Map<String, dynamic> body,
  ) async {
    final resp = await http.put(
      Uri.parse('$baseUrl/api/devices/$id'),
      headers: _authHeaders(token),
      body: jsonEncode(body),
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error updating device: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected update device response');
  }

  static Future<void> deleteDevice(String token, String id) async {
    final resp = await http.delete(
      Uri.parse('$baseUrl/api/devices/$id'),
      headers: _authHeaders(token),
    );
    if (resp.statusCode >= 400) {
      final b = _decodeBody(resp);
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error deleting device: $msg');
    }
    return;
  }

  static Future<void> deleteSchedule(String token, String id) async {
    final resp = await http.delete(
      Uri.parse('$baseUrl/api/schedules/$id'),
      headers: _authHeaders(token),
    );
    if (resp.statusCode >= 400) {
      final b = _decodeBody(resp);
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error deleting schedule: $msg');
    }
    return;
  }

  /// Subscribe to server-sent events for a device's stream.
  /// Returns a broadcast stream that emits decoded JSON payloads for 'telemetry' and 'status' events.
  // Alert Rules CRUD
  static Future<List<dynamic>> getAlertRules(
    String token, {
    String? deviceId,
  }) async {
    final q = <String, String>{};
    if (deviceId != null) q['deviceId'] = deviceId;
    final resp = await get(
      '/api/alert-rules',
      token: token,
      query: q.isEmpty ? null : q,
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error fetching alert rules: $msg');
    }
    if (b is List) return b;
    return [];
  }

  static Future<Map<String, dynamic>> createAlertRule(
    String token,
    Map<String, dynamic> body,
  ) async {
    final resp = await post('/api/alert-rules', body, token: token);
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error creating alert rule: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected create alert rule response');
  }

  static Future<Map<String, dynamic>> updateAlertRule(
    String token,
    String id,
    Map<String, dynamic> body,
  ) async {
    final resp = await http.put(
      Uri.parse('$baseUrl/api/alert-rules/$id'),
      headers: _authHeaders(token),
      body: jsonEncode(body),
    );
    final b = _decodeBody(resp);
    if (resp.statusCode >= 400) {
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error updating alert rule: $msg');
    }
    if (b is Map<String, dynamic>) return b;
    throw Exception('Unexpected update alert rule response');
  }

  static Future<void> deleteAlertRule(String token, String id) async {
    final resp = await http.delete(
      Uri.parse('$baseUrl/api/alert-rules/$id'),
      headers: _authHeaders(token),
    );
    if (resp.statusCode >= 400) {
      final b = _decodeBody(resp);
      final msg = b is Map && b['message'] != null
          ? b['message']
          : resp.reasonPhrase;
      throw Exception('Error deleting alert rule: $msg');
    }
    return;
  }

  static Stream<Map<String, dynamic>> subscribeDeviceStream(
    String? token,
    String externalId,
  ) {
    final controller = StreamController<Map<String, dynamic>>.broadcast();
    final uri = Uri.parse(
      '$baseUrl/api/stream/devices/$externalId${token != null && token.isNotEmpty ? '?token=${Uri.encodeComponent(token)}' : ''}',
    );
    final client = http.Client();
    final req = http.Request('GET', uri);
    if (token != null && token.isNotEmpty)
      req.headers['Authorization'] = 'Bearer $token';
    client
        .send(req)
        .then((resp) {
          final stream = resp.stream
              .transform(utf8.decoder)
              .transform(const LineSplitter());
          String? currentEvent;
          final buffer = StringBuffer();
          final sub = stream.listen(
            (line) {
              // SSE framing: lines, empty line denotes dispatch
              if (line.startsWith('event:')) {
                currentEvent = line.substring(6).trim();
              } else if (line.startsWith('data:')) {
                buffer.writeln(line.substring(5).trim());
              } else if (line.trim().isEmpty) {
                // dispatch
                if (currentEvent == 'telemetry' || currentEvent == 'status') {
                  try {
                    final txt = buffer.toString().trim();
                    if (txt.isNotEmpty) {
                      final obj = jsonDecode(txt) as Map<String, dynamic>;
                      controller.add(obj);
                    }
                  } catch (_) {}
                }
                // reset
                currentEvent = null;
                buffer.clear();
              } else {
                // other lines, ignore
              }
            },
            onDone: () {
              controller.close();
            },
            onError: (e) {
              controller.addError(e);
            },
          );

          controller.onCancel = () async {
            await sub.cancel();
            client.close();
          };
        })
        .catchError((e) {
          controller.addError(e);
          controller.close();
        });

    return controller.stream;
  }
}
