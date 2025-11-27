import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
// chart package removed for compatibility; showing simple list instead
import '../models/device.dart';
import '../models/sensor_data.dart';
import '../services/api.dart';
import '../services/auth_service.dart';

class DeviceDetailPage extends StatefulWidget {
  final Device device;
  const DeviceDetailPage({super.key, required this.device});

  @override
  State<DeviceDetailPage> createState() => _DeviceDetailPageState();
}

class _DeviceDetailPageState extends State<DeviceDetailPage> {
  List<SensorData> _data = [];
  bool _loading = true;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      final raw = await Api.getSensorData(
        auth.accessToken ?? '',
        widget.device.id,
        limit: 100,
      );
        _data = raw.map((e) => SensorData.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      // ignore for now
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _sendCommand(String target, String action) async {
    final auth = Provider.of<AuthService>(context, listen: false);
    try {
      await Api.createCommand(auth.accessToken ?? '', {
        'deviceId': widget.device.id,
        'target': target,
        'action': action,
      });
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Command $action sent to $target')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to send command: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.device.name)),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                children: [
                  Text('Location: ${widget.device.location ?? 'Unknown'}'),
                  const SizedBox(height: 12),
                  Expanded(child: _buildChart()),
                  const SizedBox(height: 12),
                  _buildControls(),
                ],
              ),
            ),
    );
  }

  Widget _buildControls() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('Manual Controls', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ElevatedButton.icon(
              onPressed: () => _sendCommand('pump', 'ON'),
              icon: const Icon(Icons.power),
              label: const Text('Pump ON'),
            ),
            ElevatedButton.icon(
              onPressed: () => _sendCommand('pump', 'OFF'),
              icon: const Icon(Icons.power_off),
              label: const Text('Pump OFF'),
            ),
            ElevatedButton.icon(
              onPressed: () => _sendCommand('fan', 'ON'),
              icon: const Icon(Icons.air),
              label: const Text('Fan ON'),
            ),
            ElevatedButton.icon(
              onPressed: () => _sendCommand('fan', 'OFF'),
              icon: const Icon(Icons.air),
              label: const Text('Fan OFF'),
            ),
            ElevatedButton.icon(
              onPressed: () => _sendCommand('light', 'ON'),
              icon: const Icon(Icons.lightbulb),
              label: const Text('Light ON'),
            ),
            ElevatedButton.icon(
              onPressed: () => _sendCommand('light', 'OFF'),
              icon: const Icon(Icons.lightbulb_outline),
              label: const Text('Light OFF'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildChart() {
    if (_data.isEmpty) return const Center(child: Text('No sensor data'));
    // Fallback: show recent readings in a list (timestamp + values)
    return ListView.separated(
      itemCount: _data.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (ctx, i) {
        final d = _data[i];
        final ts = d.timestamp.toLocal().toString();
        final temp = d.temperature != null
            ? '${d.temperature!.toStringAsFixed(2)} °C'
            : '—';
        final hum = d.humidity != null
            ? '${d.humidity!.toStringAsFixed(1)} %'
            : null;
        final soil = d.soilMoisture != null
            ? d.soilMoisture!.toStringAsFixed(1)
            : null;
        final ph = d.pH != null ? d.pH!.toStringAsFixed(2) : null;
        var parts = <String>['Temp: $temp'];
        if (hum != null) parts.add('Hum: $hum');
        if (soil != null) parts.add('Soil: $soil');
        if (ph != null) parts.add('pH: $ph');
        return ListTile(
          dense: true,
          title: Text(ts, style: const TextStyle(fontSize: 12)),
          subtitle: Text(parts.join(' · ')),
        );
      },
    );
  }
}
