import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/device.dart';
import '../models/user.dart';
import '../models/sensor_data.dart';
import '../models/schedule.dart';

class ApiService {
  // Dùng 10.0.2.2 cho Android Emulator để trỏ về localhost của máy tính host
  static const String baseUrl = 'http://10.0.2.2:4000/api';

  String _accessToken = '';

  String get accessToken => _accessToken;

  // --- Auth ---
  Future<User> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      _accessToken = data['accessToken'];
      return User.fromJson(data['user']);
    } else {
      final error = jsonDecode(response.body);
      throw Exception(error['message'] ?? 'Login failed');
    }
  }

  // --- Devices ---
  Future<List<Device>> fetchDevices() async {
    final response = await http.get(
      Uri.parse('$baseUrl/devices'),
      headers: {'Authorization': 'Bearer $_accessToken'},
    );

    if (response.statusCode == 200) {
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => Device.fromJson(json)).toList();
    } else if (response.statusCode == 401 || response.statusCode == 403) {
      throw Exception('Unauthorized. Please log in again.');
    } else {
      throw Exception('Failed to load devices');
    }
  }

  // --- Sensor Data ---
  Future<List<SensorData>> fetchSensorData(String deviceId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/sensors?deviceId=$deviceId&limit=20'),
      headers: {'Authorization': 'Bearer $_accessToken'},
    );

    if (response.statusCode == 200) {
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => SensorData.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load sensor data');
    }
  }

  // --- Commands ---
  Future<void> sendCommand(String deviceId, String target, String action) async {
    final response = await http.post(
      Uri.parse('$baseUrl/commands'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_accessToken',
      },
      body: jsonEncode({
        'deviceId': deviceId,
        'target': target,
        'action': action,
      }),
    );

    if (response.statusCode != 201) {
      final error = jsonDecode(response.body);
      throw Exception(error['message'] ?? 'Failed to send command');
    }
  }

  // --- Schedules ---
  Future<List<Schedule>> fetchSchedules() async {
    final response = await http.get(
      Uri.parse('$baseUrl/schedules'),
      headers: {'Authorization': 'Bearer $_accessToken'},
    );

    if (response.statusCode == 200) {
      final List<dynamic> jsonList = jsonDecode(response.body);
      return jsonList.map((json) => Schedule.fromJson(json)).toList();
    } else {
      throw Exception('Failed to load schedules');
    }
  }

  Future<void> createSchedule({
    required String deviceId,
    required String target,
    required String action,
    required String time, // ISO8601 string
    required String repeat,
    bool active = true,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/schedules'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $_accessToken',
      },
      body: jsonEncode({
        'deviceId': deviceId,
        'target': target,
        'action': action,
        'time': time,
        'repeat': repeat,
        'active': active,
      }),
    );

    if (response.statusCode != 201) {
      final error = jsonDecode(response.body);
      throw Exception(error['message'] ?? 'Failed to create schedule');
    }
  }

  Future<void> deleteSchedule(String scheduleId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/schedules/$scheduleId'),
      headers: {'Authorization': 'Bearer $_accessToken'},
    );

    if (response.statusCode != 200) {
      final error = jsonDecode(response.body);
      throw Exception(error['message'] ?? 'Failed to delete schedule');
    }
  }
}