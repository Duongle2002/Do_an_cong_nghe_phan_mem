class Device {
  final String id;
  final String name;
  final String? location;
  final String? externalId;
  final String? status;
  final String? opMode;
  final bool autoFanEnabled;
  final bool autoPumpEnabled;
  final bool autoLightEnabled;
  final String? lastFanState;
  final String? lastLightState;
  final String? lastPumpState;
  final String? pairedSensorId;

  Device({
    required this.id,
    required this.name,
    this.location,
    this.externalId,
    this.status,
    this.opMode,
    this.autoFanEnabled = false,
    this.autoPumpEnabled = false,
    this.autoLightEnabled = false,
    this.lastFanState,
    this.lastLightState,
    this.lastPumpState,
    this.pairedSensorId,
  });

  factory Device.fromJson(Map<String, dynamic> j) => Device(
    id: j['_id'] ?? j['id'] ?? '',
    name: j['name'] ?? '',
    location: j['location'],
    externalId: j['externalId'],
    status: j['status'],
    opMode: j['opMode'],
    autoFanEnabled: j['autoFanEnabled'] ?? false,
    autoPumpEnabled: j['autoPumpEnabled'] ?? false,
    autoLightEnabled: j['autoLightEnabled'] ?? false,
    lastFanState: j['lastFanState']?.toString(),
    lastLightState: j['lastLightState']?.toString(),
    lastPumpState: j['lastPumpState']?.toString(),
    pairedSensorId: j['pairedSensorId']?.toString(),
  );

  Device copyWith({
    String? id,
    String? name,
    String? location,
    String? externalId,
    String? status,
    String? opMode,
    bool? autoFanEnabled,
    bool? autoPumpEnabled,
    bool? autoLightEnabled,
    String? lastFanState,
    String? lastLightState,
    String? lastPumpState,
    String? pairedSensorId,
  }) => Device(
    id: id ?? this.id,
    name: name ?? this.name,
    location: location ?? this.location,
    externalId: externalId ?? this.externalId,
    status: status ?? this.status,
    opMode: opMode ?? this.opMode,
    autoFanEnabled: autoFanEnabled ?? this.autoFanEnabled,
    autoPumpEnabled: autoPumpEnabled ?? this.autoPumpEnabled,
    autoLightEnabled: autoLightEnabled ?? this.autoLightEnabled,
    lastFanState: lastFanState ?? this.lastFanState,
    lastLightState: lastLightState ?? this.lastLightState,
    lastPumpState: lastPumpState ?? this.lastPumpState,
    pairedSensorId: pairedSensorId ?? this.pairedSensorId,
  );
}
