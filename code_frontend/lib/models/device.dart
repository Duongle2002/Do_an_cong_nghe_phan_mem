class Device {
  final String id;
  final String name;
  final String? location;
  final String? externalId;
  final String? status;
  final String? pairedSensorId;

  Device({
    required this.id,
    required this.name,
    this.location,
    this.externalId,
    this.status,
    this.pairedSensorId,
  });

  factory Device.fromJson(Map<String, dynamic> j) => Device(
    id: j['_id'] ?? j['id'] ?? '',
    name: j['name'] ?? '',
    location: j['location'],
    externalId: j['externalId'],
    status: j['status'],
    pairedSensorId: j['pairedSensorId'],
  );

  Device copyWith({
    String? id,
    String? name,
    String? location,
    String? externalId,
    String? status,
    String? pairedSensorId,
  }) => Device(
    id: id ?? this.id,
    name: name ?? this.name,
    location: location ?? this.location,
    externalId: externalId ?? this.externalId,
    status: status ?? this.status,
    pairedSensorId: pairedSensorId ?? this.pairedSensorId,
  );
}
