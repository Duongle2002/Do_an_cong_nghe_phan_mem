import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/auth_service.dart';
import '../services/api.dart';
import '../models/device.dart';
import '../models/sensor_data.dart';

class HomeOverviewPage extends StatefulWidget {
  const HomeOverviewPage({super.key});

  @override
  State<HomeOverviewPage> createState() => _HomeOverviewPageState();
}

class _HomeOverviewPageState extends State<HomeOverviewPage> {
  bool _loading = true;
  List<Device> _devices = [];
  final Map<String, SensorData?> _latest = {}; // deviceId -> latest reading
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadOverview();
  }

  Future<void> _loadOverview() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final rawDevices = await Api.getDevices(auth.accessToken ?? '');
      _devices = rawDevices.map((e) => Device.fromJson(e as Map<String, dynamic>)).toList();

      // fetch latest sensor data for each device in parallel
      final futures = _devices.map((d) async {
        try {
          final raw = await Api.getSensorData(auth.accessToken ?? '', d.id, limit: 1);
          if (raw.isNotEmpty) {
            final s = SensorData.fromJson(raw.first as Map<String, dynamic>);
            _latest[d.id] = s;
          } else {
            _latest[d.id] = null;
          }
        } catch (_) {
          _latest[d.id] = null;
        }
      }).toList();

      await Future.wait(futures);
    } catch (e) {
      _error = e.toString();
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthService>(context);
    final userName = auth.user != null ? auth.user!['name'] ?? 'User' : 'User';

    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Welcome, $userName', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            const Text('Environment Overview', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(child: Text('Error: $_error'))
                      : _devices.isEmpty
                          ? const Center(child: Text('No devices'))
                          : GridView.count(
                              crossAxisCount: 2,
                              childAspectRatio: 1.05,
                              mainAxisSpacing: 8,
                              crossAxisSpacing: 8,
                              children: _devices.map((d) {
                                final s = _latest[d.id];
                                return GestureDetector(
                                  onTap: () => Navigator.of(context).pushNamed('/devices'),
                                  child: Card(
                                    elevation: 2,
                                    child: Padding(
                                      padding: const EdgeInsets.all(12.0),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(d.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                                          const SizedBox(height: 6),
                                          Text(d.location ?? '', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                                          const Spacer(),
                                          if (s != null) ...[
                                            Text('Temp: ${s.temperature?.toStringAsFixed(1) ?? '—'} °C'),
                                            Text('Hum: ${s.humidity?.toStringAsFixed(1) ?? '—'} %'),
                                            Text('Soil: ${s.soilMoisture?.toStringAsFixed(1) ?? '—'}'),
                                            Text('pH: ${s.pH?.toStringAsFixed(2) ?? '—'}'),
                                            const SizedBox(height: 6),
                                            Text('${s.timestamp.toLocal()}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                                          ] else ...[
                                            const Text('No readings', style: TextStyle(color: Colors.grey)),
                                          ]
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                ElevatedButton.icon(
                  onPressed: _loadOverview,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Refresh'),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: () => Navigator.of(context).pushNamed('/schedules'),
                  child: const Text('Manage Schedules'),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }
}
