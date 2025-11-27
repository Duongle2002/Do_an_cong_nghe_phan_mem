class Device {
  final String id;
  final String name;
  final String location;
  final String status;
  final String externalId;

  Device({
    required this.id,
    required this.name,
    required this.location,
    required this.status,
    required this.externalId,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['_id'],
      name: json['name'],
      location: json['location'],
      status: json['status'] ?? 'offline',
      externalId: json['externalId'] ?? '',
    );
  }
}