class Schedule {
  final String id;
  final String deviceId;
  final String target;
  final String action;
  final DateTime time;
  final String repeat;
  final bool active;

  Schedule({
    required this.id,
    required this.deviceId,
    required this.target,
    required this.action,
    required this.time,
    required this.repeat,
    required this.active,
  });

  factory Schedule.fromJson(Map<String, dynamic> json) {
    return Schedule(
      id: json['_id'],
      deviceId: json['deviceId'],
      target: json['target'] ?? 'main',
      action: json['action'],
      time: DateTime.parse(json['time']),
      repeat: json['repeat'] ?? 'daily',
      active: json['active'] ?? true,
    );
  }
}