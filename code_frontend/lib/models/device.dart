class Device {
  final String id;
  final String name;
  final String? location;
  final String? externalId;
  final String? status;
  final bool autoFanEnabled;
  final bool autoPumpEnabled;
  final bool autoLightEnabled;
  final String? lastFanState;
  final String? lastLightState;
  final String? lastPumpState;

  Device({
    required this.id,
    required this.name,
    this.location,
    this.externalId,
    this.status,
    this.autoFanEnabled = false,
    this.autoPumpEnabled = false,
    this.autoLightEnabled = false,
    this.lastFanState,
    this.lastLightState,
    this.lastPumpState,
  });

  factory Device.fromJson(Map<String, dynamic> j) => Device(
    id: j['_id'] ?? j['id'] ?? '',
    name: j['name'] ?? '',
    location: j['location'],
    externalId: j['externalId'],
    status: j['status'],
    autoFanEnabled: j['autoFanEnabled'] ?? false,
    autoPumpEnabled: j['autoPumpEnabled'] ?? false,
    autoLightEnabled: j['autoLightEnabled'] ?? false,
    lastFanState: j['lastFanState']?.toString(),
    lastLightState: j['lastLightState']?.toString(),
    lastPumpState: j['lastPumpState']?.toString(),
  );

  Device copyWith({
    String? id,
    String? name,
    String? location,
    String? externalId,
    String? status,
    bool? autoFanEnabled,
    bool? autoPumpEnabled,
    bool? autoLightEnabled,
    String? lastFanState,
    String? lastLightState,
    String? lastPumpState,
  }) => Device(
    id: id ?? this.id,
    name: name ?? this.name,
    location: location ?? this.location,
    externalId: externalId ?? this.externalId,
    status: status ?? this.status,
    autoFanEnabled: autoFanEnabled ?? this.autoFanEnabled,
    autoPumpEnabled: autoPumpEnabled ?? this.autoPumpEnabled,
    autoLightEnabled: autoLightEnabled ?? this.autoLightEnabled,
    lastFanState: lastFanState ?? this.lastFanState,
    lastLightState: lastLightState ?? this.lastLightState,
    lastPumpState: lastPumpState ?? this.lastPumpState,
  );
}
