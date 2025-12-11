class SensorData {
  final DateTime timestamp;
  final double? temperature;
  final double? humidity;
  final double? soilMoisture;
  final double? lux;

  SensorData({
    required this.timestamp,
    this.temperature,
    this.humidity,
    this.soilMoisture,
    this.lux,
  });

  factory SensorData.fromJson(Map<String, dynamic> j) => SensorData(
    timestamp: DateTime.parse(
      j['timestamp'] ?? j['createdAt'] ?? DateTime.now().toIso8601String(),
    ),
    temperature: j['temperature'] != null
        ? (j['temperature'] as num).toDouble()
        : null,
    humidity: j['humidity'] != null ? (j['humidity'] as num).toDouble() : null,
    soilMoisture: j['soilMoisture'] != null
        ? (j['soilMoisture'] as num).toDouble()
        : null,
    lux: j['lux'] != null ? (j['lux'] as num).toDouble() : null,
  );
}
