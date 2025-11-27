class SensorData {
  final double? temperature;
  final double? humidity;
  final double? soilMoisture;
  final DateTime timestamp;

  SensorData({
    this.temperature,
    this.humidity,
    this.soilMoisture,
    required this.timestamp,
  });

  factory SensorData.fromJson(Map<String, dynamic> json) {
    return SensorData(
      temperature: json['temperature']?.toDouble(),
      humidity: json['humidity']?.toDouble(),
      soilMoisture: json['soilMoisture']?.toDouble(),
      timestamp: DateTime.parse(json['timestamp']),
    );
  }
}