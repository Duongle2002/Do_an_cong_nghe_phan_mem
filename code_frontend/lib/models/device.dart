class Device {
  final String id;
  final String name;
  final String? location;

  Device({required this.id, required this.name, this.location});

  factory Device.fromJson(Map<String, dynamic> j) => Device(
    id: j['_id'] ?? j['id'] ?? '',
    name: j['name'] ?? '',
    location: j['location'],
  );
}
