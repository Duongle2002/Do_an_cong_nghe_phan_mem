import 'dart:async';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Simple notification service to handle toast messages and local notifications
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();

  factory NotificationService() {
    return _instance;
  }

  NotificationService._internal();

  final _controller = StreamController<NotificationMessage>.broadcast();
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  Stream<NotificationMessage> get notifications => _controller.stream;

  Future<void> initialize() async {
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    const DarwinInitializationSettings iosSettings =
        DarwinInitializationSettings();

    final InitializationSettings settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Handle notification tap
      },
    );
  }

  // Stream<NotificationMessage> get notificationStream => _controller.stream;

  void showNotification({
    required String title,
    required String message,
    NotificationType type = NotificationType.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    final notif = NotificationMessage(
      title: title,
      message: message,
      type: type,
      timestamp: DateTime.now(),
    );
    _controller.add(notif);

    // Auto-dismiss after duration
    Future.delayed(duration, () {
      // In real app, would track and remove notification
    });
  }

  Future<void> showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const AndroidNotificationDetails androidDetails =
        AndroidNotificationDetails(
          'alert_channel',
          'Alert Notifications',
          channelDescription: 'Notifications for device alerts',
          importance: Importance.high,
          priority: Priority.high,
          showWhen: true,
        );

    const DarwinNotificationDetails iosDetails = DarwinNotificationDetails();

    const NotificationDetails details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      DateTime.now().millisecondsSinceEpoch ~/ 1000, // Unique ID
      title,
      body,
      details,
      payload: payload,
    );
  }

  void dispose() {
    _controller.close();
  }
}

enum NotificationType { success, error, warning, info }

class NotificationMessage {
  final String title;
  final String message;
  final NotificationType type;
  final DateTime timestamp;

  NotificationMessage({
    required this.title,
    required this.message,
    required this.type,
    required this.timestamp,
  });
}
